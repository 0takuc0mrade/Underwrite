// @ts-ignore
import { DeployUtil, RuntimeArgs, CLValueBuilder, CLPublicKey, CLAccountHash } from "casper-js-sdk";

export function createRegisterPolicySelfDeploy({
  senderPublicKeyHex,
  contractHashHex,
  policyNumber,
  insuredValueMinor,
  currency,
  oraclePublicKeyHex,
  networkName,
  gasPayment = 50000000000 // 50 CSPR
}: {
  senderPublicKeyHex: string;
  contractHashHex: string;
  policyNumber: string;
  insuredValueMinor: number;
  currency: string;
  oraclePublicKeyHex: string;
  networkName: string;
  gasPayment?: number;
}) {
  const senderPublicKey = CLPublicKey.fromHex(senderPublicKeyHex);
  
  // Odra maps Address to a Casper Key (usually an Account Hash for users).
  const accountHash = senderPublicKey.toAccountHash();
  const claimantArg = CLValueBuilder.key(new CLAccountHash(accountHash));

  const args = RuntimeArgs.fromMap({
    policy_number: CLValueBuilder.string(policyNumber),
    claimant: claimantArg,
    insured_value_minor: CLValueBuilder.u64(insuredValueMinor),
    currency: CLValueBuilder.string(currency),
    oracle_public_key: CLValueBuilder.string(oraclePublicKeyHex),
  });

  const hashString = contractHashHex.replace(/^hash-/, "");
  const contractHashArray = Uint8Array.from(Buffer.from(hashString, "hex"));

  // Odra returns contract-package hashes, not contract hashes.
  // Use newStoredVersionContractByHash with version=null to call the latest version.
  const session = DeployUtil.ExecutableDeployItem.newStoredVersionContractByHash(
    contractHashArray,
    null, // latest version
    "register_policy_self",
    args
  );

  const payment = DeployUtil.standardPayment(gasPayment);

  const deployParams = new DeployUtil.DeployParams(
    senderPublicKey,
    networkName
  );

  return DeployUtil.makeDeploy(deployParams, session, payment);
}

export async function requestWalletSignature(
  deploy: DeployUtil.Deploy,
  senderPublicKeyHex: string,
  provider: any
): Promise<DeployUtil.Deploy> {
  if (typeof provider.signDeploy !== "function" && typeof provider.sign !== "function") {
    throw new Error("Wallet provider does not support sign or signDeploy.");
  }

  const deployJson = DeployUtil.deployToJson(deploy);

  // Attempt signDeploy (standard for modern casper-wallet)
  if (typeof provider.signDeploy === "function") {
    const result = await provider.signDeploy(deployJson, senderPublicKeyHex);
    if (result.cancelled) {
      throw new Error("User rejected the signature request.");
    }
    // Result might contain deploy object or signature. The modern standard returns the signed deploy.
    if (result.deploy) {
      return DeployUtil.deployFromJson(result.deploy).unwrap();
    }
    if (result.signature) {
       // Append signature manually if it's returned separately
       return DeployUtil.setSignature(deploy, result.signature, CLPublicKey.fromHex(senderPublicKeyHex));
    }
    // Try to parse the result itself if it's the deploy json
    return DeployUtil.deployFromJson(result).unwrap();
  }

  // Fallback to older `sign` method if signDeploy doesn't exist
  const result = await provider.sign(JSON.stringify(deployJson), senderPublicKeyHex);
  if (result.cancelled) {
    throw new Error("User rejected the signature request.");
  }
  if (result.signature) {
    return DeployUtil.setSignature(deploy, result.signature, CLPublicKey.fromHex(senderPublicKeyHex));
  }
  return DeployUtil.deployFromJson(result).unwrap();
}

export async function requestWalletMessageSignature(
  message: string,
  publicKeyHex: string,
  provider: any
): Promise<string> {
  if (typeof provider.signMessage !== "function") {
    throw new Error("Wallet provider does not support message signing (signMessage).");
  }

  const result = await provider.signMessage(message, publicKeyHex);
  if (result.cancelled) {
    throw new Error("User rejected the message signature request.");
  }

  return normalizeWalletMessageSignature(result);
}

export function normalizeWalletMessageSignature(result: unknown): string {
  const signature = extractWalletSignature(result);
  const normalized = signature.replace(/^0x/i, "").trim();

  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Wallet returned a signature in an unsupported format.");
  }

  return normalized.toLowerCase();
}

function extractWalletSignature(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") {
    throw new Error("Wallet did not return a valid signature.");
  }

  const candidate = result as {
    signature?: unknown;
    signatureHex?: unknown;
    signatureBytes?: unknown;
  };

  if (typeof candidate.signatureHex === "string") return candidate.signatureHex;
  if (typeof candidate.signature === "string") return candidate.signature;
  if (typeof candidate.signatureBytes === "string") return candidate.signatureBytes;

  const bytes =
    bytesFromUnknown(candidate.signature) ??
    bytesFromUnknown(candidate.signatureBytes);
  if (bytes) return bytesToHex(bytes);

  if (candidate.signature && typeof candidate.signature === "object") {
    return extractWalletSignature(candidate.signature);
  }

  throw new Error("Wallet did not return a valid signature.");
}

function bytesFromUnknown(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item))) {
    return Uint8Array.from(value as number[]);
  }
  return null;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
