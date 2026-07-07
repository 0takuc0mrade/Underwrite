export type Evidence = {
  network: string;
  chainName: string;
  nodeAddress: string;
  underwriteContract: string;
  settlementToken: string;
  vault: string;
  coverageTemplate: string;
  policyId: string;
  coveredSubject: string;
  riskEvent: string;
  triggerMetric: string;
  triggerValue: number;
  agentAccount: string;
  claimantAccount: string;
  oraclePublicKey: string;
  validClaimAttestationHash: string;
  validClaimDeployHash: string;
  duplicateClaimDeployHash: string;
  staleClaimDeployHash: string;
  validClaimStatus: string;
  duplicateClaimStatus: string;
  staleClaimStatus: string;
  payoutAmountMinor: number;
  payoutPercentage: number;
  settlementTokenDeployHash: string;
  underwriteContractDeployHash: string;
  vaultFundingDeployHash: string;
  policyRegistrationDeployHash: string;
  timestamp?: string;
  updatedAt?: string;
  explorerLinks: Record<string, string>;
};

export const evidence: Evidence = {
  network: "casper-testnet",
  chainName: "casper-test",
  nodeAddress: "https://node.testnet.casper.network/rpc",
  underwriteContract: "hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f",
  settlementToken: "hash-1f2857fd127ffe3014d06734b5df882cf084fdd50bfab36c1e4020533c56793d",
  vault: "hash-cc9065bf2ddf323697c42fccb015fdd170832557ddc455fb9f3217820b09a36f",
  coverageTemplate: "cargo_delay",
  policyId: "MRC-CRG-2026-00481",
  coveredSubject: "MAEU-784239160",
  riskEvent: "cargo_delay",
  triggerMetric: "delay_hours",
  triggerValue: 75,
  agentAccount: "account-hash-587b30d9c606eb99899eea6456271175931533250b442f15c0a168a726629f3a",
  claimantAccount: "account-hash-587b30d9c606eb99899eea6456271175931533250b442f15c0a168a726629f3a", // The connected wallet account
  oraclePublicKey: "01fd1724385aa0c75b64fb78cd602fa1d991fdebf76b13c58ed702eac835e9f618", // Agent key with 01 tag
  validClaimAttestationHash: "5dfed6de94ff168ca9064557ffb4cef99da95fa63223a19657c66a9f053ceccc", // From Agent Request mode
  validClaimDeployHash: "e20fde64cf6bc114f99bdb6f5294080122ad4bb30cde58fcfec336553beb806b", // Agent Request settlement
  duplicateClaimDeployHash: "9a4d4fa5700e0c19b5450a77618a01b1eef7945b42fa427d2a56ad6870d5ec3f", // Previous Operator mode rejection
  staleClaimDeployHash: "941dc7fbfc16936a442628dd2200f7b9b7d2f00a5b334b6e3f7171fb181c1b2f", // Previous Operator mode rejection
  validClaimStatus: "submitted",
  duplicateClaimStatus: "rejected_or_failed",
  staleClaimStatus: "rejected_or_failed",
  payoutAmountMinor: 6250000,
  payoutPercentage: 50,
  settlementTokenDeployHash: "51a8fd05cbbe39a8f2ec318c490f545d9fdaa7eed187a93abaa5c1fe6079e1c6",
  underwriteContractDeployHash: "7cfce69b88f8455285403344e7b7b8af56cd079910da721f66b392311a728daf",
  vaultFundingDeployHash: "1c7802aa06e69d52ca3c30c97766f44f38a4fc01e1e0a10caa9bffa82a16ce18",
  policyRegistrationDeployHash: "8779d088e9aa4bc70ed416c08805c778b2bdc4ff36b4be90c9e9589dfe52c6aa", // Wallet Mode registration
  timestamp: "2026-07-06T23:28:56.000Z",
  updatedAt: "2026-07-06T23:30:27.000Z",
  explorerLinks: {
    underwriteContract: "https://testnet.cspr.live/transaction/7cfce69b88f8455285403344e7b7b8af56cd079910da721f66b392311a728daf",
    settlementToken: "https://testnet.cspr.live/transaction/51a8fd05cbbe39a8f2ec318c490f545d9fdaa7eed187a93abaa5c1fe6079e1c6",
    validClaim: "https://testnet.cspr.live/transaction/e20fde64cf6bc114f99bdb6f5294080122ad4bb30cde58fcfec336553beb806b",
    duplicateClaim: "https://testnet.cspr.live/transaction/9a4d4fa5700e0c19b5450a77618a01b1eef7945b42fa427d2a56ad6870d5ec3f",
    staleClaim: "https://testnet.cspr.live/transaction/941dc7fbfc16936a442628dd2200f7b9b7d2f00a5b334b6e3f7171fb181c1b2f",
    vaultFunding: "https://testnet.cspr.live/transaction/1c7802aa06e69d52ca3c30c97766f44f38a4fc01e1e0a10caa9bffa82a16ce18",
    policyRegistration: "https://testnet.cspr.live/transaction/8779d088e9aa4bc70ed416c08805c778b2bdc4ff36b4be90c9e9589dfe52c6aa"
  }
};

export const shortHash = (value: string, start = 14, end = 10) =>
  value.length > start + end + 3 ? `${value.slice(0, start)}...${value.slice(-end)}` : value;
