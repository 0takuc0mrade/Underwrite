"use client";

import { ArrowUpRight, Ban, CheckCircle2, Copy, Menu, ShieldCheck, Vault } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { evidence, shortHash } from "./evidence";

const SPOTLIGHT_R = 260;
const BG_IMAGE_1 =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_195923_b0ba8ace-1d1d-4f2c-9a28-1ab84b330680.png&w=1280&q=85";
const BG_IMAGE_2 =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_201152_bba90a12-bf12-459f-91f0-51f237dbaf3b.png&w=1280&q=85";

const trustBadges = [
  "Casper Testnet live state",
  "Agent-verified evidence",
  "Policy enforced by contract",
  "Vault-backed settlement",
  "Unsafe claims rejected"
];

const metricCards = [
  { label: "Network", value: "Casper", note: evidence.chainName, tone: "blue" },
  { label: "Policy", value: "1", note: evidence.policyId, tone: "violet" },
  { label: "Valid payout", value: `${evidence.payoutPercentage}%`, note: `${evidence.payoutAmountMinor.toLocaleString()} minor units`, tone: "green" },
  { label: "Rejected attempts", value: "2", note: "duplicate + stale", tone: "rose" }
] as const;

const statusCards = [
  {
    title: "Wallet policy registered",
    mode: "Wallet Mode",
    body: "The cargo-delay policy was registered by the claimant wallet through register_policy_self.",
    hash: evidence.policyRegistrationDeployHash,
    href: evidence.explorerLinks.policyRegistration,
    timestamp: evidence.updatedAt ?? evidence.timestamp,
    status: "success"
  },
  {
    title: "Vault funded",
    mode: "Operator Mode",
    body: "The settlement vault received test token liquidity through the admin/operator deployment path.",
    hash: evidence.vaultFundingDeployHash,
    href: evidence.explorerLinks.vaultFunding,
    timestamp: evidence.updatedAt ?? evidence.timestamp,
    status: "success"
  },
  {
    title: "Agent request settled",
    mode: "Agent Request Mode",
    body: "A wallet-signed request triggered agent verification and a Casper settlement submission.",
    hash: evidence.validClaimDeployHash,
    href: evidence.explorerLinks.validClaim,
    timestamp: evidence.updatedAt ?? evidence.timestamp,
    status: "paid"
  },
  {
    title: "Duplicate blocked",
    mode: "Operator Mode rejection evidence",
    body: "A replay attempt was blocked by the contract.",
    hash: evidence.duplicateClaimDeployHash,
    href: evidence.explorerLinks.duplicateClaim,
    timestamp: evidence.updatedAt ?? evidence.timestamp,
    status: "rejected"
  },
  {
    title: "Expired/stale blocked",
    mode: "Operator Mode rejection evidence",
    body: "Old evidence was rejected by freshness checks.",
    hash: evidence.staleClaimDeployHash,
    href: evidence.explorerLinks.staleClaim,
    timestamp: evidence.updatedAt ?? evidence.timestamp,
    status: "rejected"
  }
] as const;

const infrastructureRows = [
  ["Network", evidence.network],
  ["Chain name", evidence.chainName],
  ["RPC node", evidence.nodeAddress],
  ["Settlement contract", evidence.underwriteContract],
  ["Settlement token", evidence.settlementToken],
  ["Vault", evidence.vault],
  ["Agent account", evidence.agentAccount],
  ["Claimant account", evidence.claimantAccount],
  ["Oracle public key", evidence.oraclePublicKey],
  ["Payout rule", "72-119 delay hours -> 50% payout"],
  ["Payout amount", `${evidence.payoutAmountMinor.toLocaleString()} minor units`]
] as const;

const policyRows = [
  ["Policy ID", evidence.policyId],
  ["Covered shipment", evidence.coveredSubject],
  ["Risk event", "Cargo delay"],
  ["Trigger metric", evidence.triggerMetric],
  ["Observed delay", `${evidence.triggerValue} hours`],
  ["Payout rule hit", `${evidence.payoutPercentage}% tier`],
  ["Payout amount", `${evidence.payoutAmountMinor.toLocaleString()} minor units`],
  ["Attestation hash", evidence.validClaimAttestationHash]
] as const;

const agentActivity = [
  ["Evidence received", `Shipment ${evidence.coveredSubject} reported a ${evidence.triggerValue}-hour delay.`],
  ["Signature verified", `Oracle key ${shortHash(evidence.oraclePublicKey, 12, 8)} authorized the observation.`],
  ["Payout tier calculated", `${evidence.triggerValue} hours matched the ${evidence.payoutPercentage}% policy tier.`],
  ["Claim attestation produced", `Attestation hash ${shortHash(evidence.validClaimAttestationHash, 14, 8)}.`],
  ["Claim submitted", shortHash(evidence.validClaimDeployHash, 18, 10)],
  ["Casper result confirmed", "Valid claim accepted; duplicate and stale attempts rejected."]
] as const;

const productModel = [
  ["Wallet", "Connects to Casper Wallet. Owns the policy and authorizes user actions."],
  ["Agent", "Verifies signed evidence and calculates the deterministic payout tier."],
  ["Contract", "Enforces policy, claimant, oracle, freshness, replay, and payout rules."],
  ["Vault", "Holds CEP-18 settlement tokens. Pays valid claims automatically."],
  ["Operator", "Server-side fallback for local administration and privileged operations."]
] as const;

const operationMeta = {
  register_policy: {
    label: "Register policy",
    script: "scripts/register-policy.sh",
    backend: "POST /api/operations/run",
    output: "Policy transaction hash and operator fixture path",
    meaning: "Creates policy state that tells Casper who can claim and which evidence key is trusted."
  },
  run_agent: {
    label: "Run agent verification",
    script: "scripts/run-agent.sh",
    backend: "POST /api/operations/run",
    output: "deployments/latest-attestation.json",
    meaning: "Checks the signed evidence and produces the claim attestation used by settlement."
  },
  submit_claim: {
    label: "Submit claim attestation",
    script: "scripts/submit-valid-claim.sh",
    backend: "POST /api/operations/run",
    output: "Casper transaction hash and explorer link when available",
    meaning: "Sends the verified claim to Casper, where the contract decides whether payout is allowed."
  }
} as const;

const pipeline = [
  ["Trusted evidence comes in", "A signed report describes the insured cargo event."],
  ["Agent verifies it", "The Rust agent checks the signature, freshness, policy, and payout."],
  ["Contract enforces rules", "Casper validates claimant, oracle, replay state, and payout bounds."],
  ["Vault pays valid claims", "A qualifying claim can release the configured payout."],
  ["Bad claims are blocked", "Duplicate and stale attempts produce public rejection evidence."]
] as const;

type OperationAction = "register_policy" | "run_agent" | "submit_claim";

type OperationResult = {
  action?: OperationAction;
  status: "success" | "not_configured" | "error";
  message: string;
  deployHash?: string;
  explorerUrl?: string;
  outputPath?: string;
  outputTail?: string;
  timestamp?: string;
};

type CasperWalletLike = {
  requestConnection?: () => Promise<unknown>;
  connect?: () => Promise<unknown>;
  disconnect?: () => Promise<unknown>;
  getActivePublicKey?: () => Promise<string> | string;
  getPublicKey?: () => Promise<string> | string;
  isConnected?: () => Promise<boolean> | boolean;
  sign?: (...args: unknown[]) => Promise<unknown>;
  signDeploy?: (...args: unknown[]) => Promise<unknown>;
};

// Removed Window interface declaration to avoid conflicts with casper-js-sdk

type WalletStepStatus = "implemented" | "coming-next" | "agent-handled" | "requires-wallet" | "requires-deployment";

type RuntimeConfig = {
  contractHash: string;
  rpcUrl: string;
  chainName: string;
  explorerBaseUrl: string;
};

const walletModeSteps: { number: string; title: string; status: WalletStepStatus; detail: string }[] = [
  {
    number: "1",
    title: "Connect Casper Wallet",
    status: "implemented",
    detail: "Your wallet identifies you as the policy owner. The app reads your public key but never accesses private keys."
  },
  {
    number: "2",
    title: "Review policy terms",
    status: "implemented",
    detail: "Review coverage template, insured value, currency, and authorized oracle key before committing."
  },
  {
    number: "3",
    title: "Register policy with your wallet",
    status: "implemented",
    detail: "Browser wallet-signed deploy support is live. You can now register policies directly onto the Casper Testnet using your wallet extension."
  },
  {
    number: "4",
    title: "Fund vault",
    status: "coming-next",
    detail: "Transfer CEP-18 settlement tokens to the vault. Requires wallet signing and a token distribution or faucet model."
  },
  {
    number: "5",
    title: "Request agent verification",
    status: "agent-handled",
    detail: "The Underwrite agent verifies signed evidence, calculates deterministic payout, and creates the claim attestation."
  },
  {
    number: "6",
    title: "Track claim result",
    status: "implemented",
    detail: "View the settlement outcome, explorer links, and rejection evidence for duplicate or expired attempts."
  }
];

function RevealLayer({
  image,
  cursorX,
  cursorY
}: {
  image: string;
  cursorX: number;
  cursorY: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reveal = revealRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !reveal || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createRadialGradient(cursorX, cursorY, 0, cursorX, cursorY, SPOTLIGHT_R);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.4, "rgba(255,255,255,1)");
    gradient.addColorStop(0.6, "rgba(255,255,255,0.75)");
    gradient.addColorStop(0.75, "rgba(255,255,255,0.4)");
    gradient.addColorStop(0.88, "rgba(255,255,255,0.12)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    context.fillStyle = gradient;
    context.beginPath();
    context.arc(cursorX, cursorY, SPOTLIGHT_R, 0, Math.PI * 2);
    context.fill();

    const mask = `url(${canvas.toDataURL()})`;
    reveal.style.maskImage = mask;
    reveal.style.webkitMaskImage = mask;
  }, [cursorX, cursorY]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ display: "none" }} />
      <div
        ref={revealRef}
        className="absolute inset-0 z-30 bg-center bg-cover bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.42)), url(${image})`,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%"
        }}
      />
    </>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 256 256" fill="#ffffff" aria-hidden="true">
      <path d="M 256 256 L 128 256 L 0 128 L 128 128 Z M 256 128 L 128 128 L 0 0 L 128 0 Z" />
    </svg>
  );
}

export function TopNav() {
  const links = [
    ["Overview", "/"],
    ["Operate", "/operate"],
    ["Evidence", "/evidence"],
    ["Policy", "/policy"],
    ["Agent", "/agent"]
  ] as const;

  return (
    <nav className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-between p-4 sm:p-5">
      <a href="/" className="flex items-center gap-2">
        <Logo />
        <span className="text-2xl font-playfair italic text-white">Underwrite</span>
      </a>
      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/30 bg-white/20 px-2 py-2 backdrop-blur-md md:flex">
        {links.map(([item, href]) => (
          <a
            key={item}
            href={href}
            className="rounded-full px-4 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            {item}
          </a>
        ))}
      </div>
      <a
        className="hidden rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:scale-[1.03] hover:bg-gray-100 active:scale-95 md:block"
        href="/operate"
      >
        Operate
      </a>
      <button className="rounded-full border border-white/25 bg-white/10 p-2 text-white backdrop-blur-md md:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
    </nav>
  );
}

function ExplorerButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:border-ember/60 hover:bg-ember/15"
    >
      {children}
      <ArrowUpRight className="h-4 w-4" />
    </a>
  );
}

function CopyableValue({ value, compact = true }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const shown = compact ? shortHash(value, 18, 12) : value;

  async function copy() {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={value}
      className="group inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-300 transition hover:border-white/25 hover:text-white"
    >
      <span className="truncate">{shown}</span>
      <Copy className="h-3.5 w-3.5 text-zinc-500 group-hover:text-white" />
      {copied ? <span className="text-signal">copied</span> : null}
    </button>
  );
}

function getCasperWalletProvider() {
  if (typeof window === "undefined") return null;
  const win = window as any;

  if (win.CasperWalletProvider) {
    return typeof win.CasperWalletProvider === "function"
      ? win.CasperWalletProvider()
      : win.CasperWalletProvider;
  }

  return win.casperlabsHelper ?? win.casperWallet ?? null;
}

async function readWalletPublicKey(provider: any) {
  const publicKey =
    typeof provider.getActivePublicKey === "function"
      ? await provider.getActivePublicKey()
      : typeof provider.getPublicKey === "function"
        ? await provider.getPublicKey()
        : "";

  return typeof publicKey === "string" ? publicKey : "";
}

function WalletConnectCard({
  publicKey,
  walletStatus,
  onConnect,
  onUseAccount
}: {
  publicKey: string;
  walletStatus: string;
  onConnect: () => void;
  onUseAccount: () => void;
}) {
  return (
    <article className="glass-card rounded-[2rem] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Casper wallet
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.06em] text-white">
            Connect as the claimant or operator.
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            The wallet identifies who is using Underwrite. Contract execution is
            still routed through the local server operator so private deployment
            keys never touch the browser.
          </p>
        </div>
        <button
          type="button"
          onClick={onConnect}
          className="rounded-full bg-white px-5 py-3 text-sm font-black text-gray-950 transition hover:scale-[1.02] hover:bg-gray-100"
        >
          {publicKey ? "Refresh Wallet" : "Connect Wallet"}
        </button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 font-mono text-[11px] font-black uppercase ${
            publicKey ? "bg-signal/10 text-signal" : "bg-amber-500/10 text-amber-300"
          }`}
        >
          {walletStatus}
        </span>
        {publicKey ? (
          <>
            <CopyableValue value={publicKey} />
            <button
              type="button"
              onClick={onUseAccount}
              className="rounded-full border border-ember/35 bg-ember/10 px-4 py-2 text-sm font-black text-ember transition hover:bg-ember/15"
            >
              Use as claimant
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function statusClass(status: "ready" | "running" | "success" | "failed" | "disabled") {
  if (status === "success") return "bg-signal/10 text-signal border-signal/20";
  if (status === "running") return "bg-sky-500/10 text-sky-300 border-sky-400/20";
  if (status === "failed") return "bg-ember/10 text-ember border-ember/20";
  if (status === "disabled") return "bg-amber-500/10 text-amber-300 border-amber-400/20";
  return "bg-white/10 text-zinc-300 border-white/10";
}

function formatTimestamp(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function ProductModelStrip() {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {productModel.map(([title, body]) => (
        <article key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="font-mono text-[11px] font-black uppercase tracking-[0.16em] text-ember">{title}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
        </article>
      ))}
    </div>
  );
}

function WorkflowStepCard({
  number,
  title,
  status,
  mapping,
  expectedOutput,
  meaning
}: {
  number: string;
  title: string;
  status: "ready" | "running" | "success" | "failed" | "disabled";
  mapping: string;
  expectedOutput: string;
  meaning: string;
}) {
  return (
    <article className="glass-card rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-xs font-black text-white">
            {number}
          </span>
          <div>
            <h3 className="text-xl font-black tracking-[-0.05em] text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{meaning}</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 font-mono text-[11px] font-black uppercase ${statusClass(status)}`}>
          {status}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Maps to</p>
          <p className="mt-2 font-mono text-xs text-zinc-300">{mapping}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Expected output</p>
          <p className="mt-2 text-sm text-zinc-300">{expectedOutput}</p>
        </div>
      </div>
    </article>
  );
}

function OperationResultPanel({ result }: { result: OperationResult | null }) {
  if (!result) {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-3xl font-black tracking-[-0.06em] text-white">Operator actions are intentionally guarded.</p>
        <p className="text-sm leading-7 text-zinc-400">
          Hosted deployments may disable operator actions for key safety. You
          can still inspect real Testnet proof on the Evidence page. To execute
          actions, run locally with your own funded Testnet key and set{" "}
          <span className="font-mono text-zinc-200">UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true</span>.
        </p>
      </div>
    );
  }

  const action = result.action ? operationMeta[result.action] : null;
  const status =
    result.status === "success" ? "success" : result.status === "not_configured" ? "disabled" : "failed";

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex rounded-full border px-3 py-1 font-mono text-[11px] font-black uppercase ${statusClass(status)}`}>
          {result.status.replace("_", " ")}
        </span>
        <span className="font-mono text-xs text-zinc-500">{formatTimestamp(result.timestamp)}</span>
      </div>
      <div>
        <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Operation</p>
        <p className="mt-2 text-xl font-black tracking-[-0.05em] text-white">{action?.label ?? "Underwrite operation"}</p>
      </div>
      <p className="text-sm font-semibold leading-7 text-white">{result.message}</p>
      {result.deployHash ? (
        <div>
          <p className="mb-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Deploy hash</p>
          <div className="flex flex-wrap items-center gap-3">
            <CopyableValue value={result.deployHash} />
            {result.explorerUrl ? <ExplorerButton href={result.explorerUrl}>Explorer</ExplorerButton> : null}
          </div>
        </div>
      ) : null}
      {result.outputPath ? (
        <div>
          <p className="mb-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Output file</p>
          <CopyableValue value={result.outputPath} compact={false} />
        </div>
      ) : null}
      {result.outputTail ? (
        <pre className="max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/45 p-4 text-xs leading-6 text-zinc-400">
          {result.outputTail}
        </pre>
      ) : null}
    </div>
  );
}

export function Hero() {
  const mouse = useRef({ x: -999, y: -999 });
  const smooth = useRef({ x: -999, y: -999 });
  const rafRef = useRef<number | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      mouse.current = { x: event.clientX, y: event.clientY };
    };

    const tick = () => {
      smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1;
      smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1;
      setCursorPos({ x: smooth.current.x, y: smooth.current.y });
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section className="relative h-screen min-h-[760px] w-full overflow-hidden bg-black" style={{ height: "100dvh" }}>
      <div
        className="absolute inset-0 z-10 bg-center bg-cover bg-no-repeat hero-zoom"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.42)), url(${BG_IMAGE_1})`
        }}
      />
      <RevealLayer image={BG_IMAGE_2} cursorX={cursorPos.x} cursorY={cursorPos.y} />
      <div className="absolute inset-0 z-40 bg-[radial-gradient(circle_at_50%_48%,transparent_0_42%,rgba(0,0,0,0.62)_100%),linear-gradient(180deg,rgba(0,0,0,0.25),transparent_42%,rgba(0,0,0,0.64))] pointer-events-none" />

      <TopNav />

      <div className="absolute left-0 right-0 top-[13%] z-50 flex flex-col items-center px-5 text-center">
        <p className="hero-anim hero-fade font-mono text-xs font-black uppercase tracking-[0.22em] text-white/70" style={{ animationDelay: "0.1s" }}>
          Real Testnet settlement evidence
        </p>
        <h1 className="mt-4 text-white leading-[0.95]">
          <span
            className="block font-playfair italic font-normal text-5xl sm:text-7xl md:text-8xl hero-anim hero-reveal"
            style={{ letterSpacing: "-0.05em", animationDelay: "0.25s" }}
          >
            Verified claims
          </span>
          <span
            className="block -mt-1 font-normal text-5xl sm:text-7xl md:text-8xl hero-anim hero-reveal"
            style={{ letterSpacing: "-0.08em", animationDelay: "0.42s" }}
          >
            paid by code
          </span>
        </h1>
        <p className="hero-anim hero-fade mt-5 max-w-2xl text-base leading-8 text-white/80 sm:text-lg" style={{ animationDelay: "0.62s" }}>
          Underwrite is a Casper-native risk settlement engine. It lets apps, users, and AI agents automatically pay valid claims using trusted evidence and clear rules.
        </p>
        <div className="hero-anim hero-fade mt-7 flex flex-wrap justify-center gap-3" style={{ animationDelay: "0.76s" }}>
          <a href="/operate" className="rounded-full bg-[#e8702a] px-7 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.03] hover:bg-[#d2611f] hover:shadow-lg hover:shadow-[#e8702a]/30">
            Open Operator Console
          </a>
          <a href="/policy" className="rounded-full border border-white/25 bg-white/10 px-7 py-3 text-sm font-semibold text-white backdrop-blur-md transition-all hover:scale-[1.03] hover:bg-white/20">
            See Policy & Vault
          </a>
        </div>
      </div>

      <div className="hero-anim hero-fade absolute bottom-14 left-5 right-5 z-50 flex flex-wrap justify-center gap-2 sm:left-10 sm:right-10" style={{ animationDelay: "0.9s" }}>
        {trustBadges.map((badge) => (
          <span key={badge} className="rounded-full border border-white/15 bg-black/20 px-3 py-2 text-xs font-semibold text-white/80 backdrop-blur-md">
            {badge}
          </span>
        ))}
      </div>
    </section>
  );
}

function MetricCard({ label, value, note, tone }: (typeof metricCards)[number]) {
  const toneClass =
    tone === "green"
      ? "text-signal bg-signal/10 border-signal/25"
      : tone === "rose"
        ? "text-ember bg-ember/10 border-ember/25"
        : tone === "violet"
          ? "text-violet-300 bg-violet-500/10 border-violet-400/20"
          : "text-sky-300 bg-sky-500/10 border-sky-400/20";

  return (
    <article className="glass-card rounded-[1.5rem] p-5">
      <p className="text-sm font-semibold text-zinc-400">{label}</p>
      <div className="mt-5 flex items-end justify-between gap-4">
        <strong className="text-5xl font-black tracking-[-0.08em] text-white">{value}</strong>
        <span className={`max-w-[13rem] truncate rounded-full border px-3 py-1 font-mono text-[11px] font-black uppercase ${toneClass}`}>
          {note}
        </span>
      </div>
    </article>
  );
}

export function OverviewDashboard() {
  return (
    <section id="overview" className="relative overflow-hidden bg-[#07070a] px-5 py-20 sm:px-8">
      <div className="absolute inset-0 evidence-grid opacity-30" />
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-ember">Operations snapshot</p>
            <h2 className="mt-4 max-w-3xl text-[clamp(2.4rem,5vw,4.8rem)] font-black leading-[0.94] tracking-[-0.07em] text-white">
              Settlement operations for parametric risk on Casper.
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-zinc-400">
            Underwrite turns trusted risk evidence into automatic Casper payouts.
            It is the settlement layer underneath DeFi protection, RWA invoice defaults, 
            SLA guarantees, and agent-driven workflows.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
        <div className="mt-8">
          <ProductModelStrip />
        </div>
      </div>
    </section>
  );
}

function WalletStepStatusBadge({ status }: { status: WalletStepStatus }) {
  const map: Record<WalletStepStatus, { label: string; cls: string }> = {
    "implemented": { label: "Implemented", cls: "bg-signal/10 text-signal border-signal/20" },
    "coming-next": { label: "Coming next", cls: "bg-amber-500/10 text-amber-300 border-amber-400/20" },
    "agent-handled": { label: "Agent-handled", cls: "bg-violet-500/10 text-violet-200 border-violet-400/20" },
    "requires-wallet": { label: "Requires wallet", cls: "bg-sky-500/10 text-sky-300 border-sky-400/20" },
    "requires-deployment": { label: "Requires deployment", cls: "bg-ember/10 text-ember border-ember/20" }
  };
  const { label, cls } = map[status];
  return <span className={`rounded-full border px-3 py-1 font-mono text-[11px] font-black uppercase ${cls}`}>{label}</span>;
}

function WalletModeStepCard({ step, children }: { step: (typeof walletModeSteps)[number]; children?: React.ReactNode }) {
  return (
    <article className="glass-card rounded-[1.5rem] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 font-mono text-xs font-black text-white">
            {step.number}
          </span>
          <div className="w-full">
            <h3 className="text-xl font-black tracking-[-0.05em] text-white">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{step.detail}</p>
            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>
        <WalletStepStatusBadge status={step.status} />
      </div>
    </article>
  );
}

function WalletCapabilityPanel({
  publicKey,
  walletStatus,
  signingDetected,
  onConnect
}: {
  publicKey: string;
  walletStatus: string;
  signingDetected: boolean;
  onConnect: () => void;
}) {
  return (
    <article className="glass-card gradient-border rounded-[2rem] p-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-500/10 text-violet-200">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <h3 className="text-xl font-black tracking-[-0.05em] text-white">Wallet capabilities</h3>
      </div>
      <div className="grid gap-3">
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center">
          <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Status</p>
          <span className={`w-fit rounded-full px-3 py-1 font-mono text-[11px] font-black uppercase ${publicKey ? "bg-signal/10 text-signal" : "bg-amber-500/10 text-amber-300"}`}>
            {walletStatus}
          </span>
        </div>
        {publicKey ? (
          <>
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center">
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Public key</p>
              <CopyableValue value={publicKey} />
            </div>
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center">
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Claimant identity</p>
              <p className="text-sm font-semibold text-white sm:text-right">Your connected wallet</p>
            </div>
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center">
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Network</p>
              <p className="text-sm font-semibold text-white sm:text-right">Casper Testnet</p>
            </div>
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center">
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Signing support</p>
              <span className={`w-fit rounded-full px-3 py-1 font-mono text-[11px] font-black uppercase ${signingDetected ? "bg-signal/10 text-signal" : "bg-amber-500/10 text-amber-300"}`}>
                {signingDetected ? "Detected" : "Not detected"}
              </span>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="mt-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-gray-950 transition hover:scale-[1.02] hover:bg-gray-100"
          >
            Connect Wallet
          </button>
        )}
      </div>
    </article>
  );
}

function WalletModeValueProp() {
  const props = [
    ["Your wallet owns the policy", "You register policies from your own Casper account."],
    ["The agent checks the evidence", "Signed risk attestations are verified by a deterministic Rust agent."],
    ["Casper enforces the payout", "Contract rules control claimant, oracle, freshness, replay, and bounds."],
    ["Valid claims get paid", "Qualifying claims release the configured payout from the vault."],
    ["Bad claims are blocked", "Duplicate, stale, or unauthorized attempts are rejected on-chain."]
  ] as const;
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {props.map(([title, body]) => (
        <article key={title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="font-mono text-[11px] font-black uppercase tracking-[0.16em] text-signal">{title}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
        </article>
      ))}
    </div>
  );
}

export function OperationsConsole() {
  const [form, setForm] = useState({
    policyId: evidence.policyId,
    claimantAccount: evidence.claimantAccount,
    insuredValueMinor: "12500000",
    currency: "USD",
    signedRiskPath: "fixtures/signed-risk-attestation.cargo-delay.json",
    outputPath: "deployments/latest-attestation.json",
    attestationPath: "deployments/latest-attestation.json"
  });
  const [runningAction, setRunningAction] = useState<OperationAction | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [walletPublicKey, setWalletPublicKey] = useState("");
  const [walletStatus, setWalletStatus] = useState("not connected");
  const [activeMode, setActiveMode] = useState<"wallet" | "operator">("wallet");
  const [signingDetected, setSigningDetected] = useState(false);
  const [walletDeployState, setWalletDeployState] = useState<"idle" | "signing" | "submitting">("idle");
  const [walletDeployHash, setWalletDeployHash] = useState<string | null>(null);
  const [walletDeployError, setWalletDeployError] = useState<string | null>(null);

  const [agentRequestState, setAgentRequestState] = useState<"idle" | "signing" | "verifying" | "submitting" | "done">("idle");
  const [agentRequestError, setAgentRequestError] = useState<string | null>(null);
  const [agentRequestResult, setAgentRequestResult] = useState<{ deployHash?: string, explorerUrl?: string, message?: string } | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig>({
    contractHash: "",
    rpcUrl: "",
    chainName: "casper-test",
    explorerBaseUrl: "https://testnet.cspr.live"
  });

  useEffect(() => {
    let cancelled = false;
    async function loadRuntimeConfig() {
      try {
        const response = await fetch("/api/config", { cache: "no-store" });
        if (!response.ok) return;
        const config = (await response.json()) as Partial<RuntimeConfig>;
        if (!cancelled) {
          setRuntimeConfig((current) => ({
            contractHash: config.contractHash || current.contractHash,
            rpcUrl: config.rpcUrl || current.rpcUrl,
            chainName: config.chainName || current.chainName,
            explorerBaseUrl: config.explorerBaseUrl || current.explorerBaseUrl
          }));
        }
      } catch {
        // Keep the default config; button actions will show a precise error.
      }
    }
    loadRuntimeConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function runOperation(action: OperationAction) {
    setRunningAction(action);
    setResult(null);

    const payload =
      action === "register_policy"
        ? {
            action,
            policyId: form.policyId,
            claimantAccount: form.claimantAccount,
            insuredValueMinor: Number(form.insuredValueMinor),
            currency: form.currency
          }
        : action === "run_agent"
          ? {
              action,
              signedRiskPath: form.signedRiskPath,
              outputPath: form.outputPath
            }
          : {
              action,
              attestationPath: form.attestationPath
            };

    try {
      const response = await fetch("/api/operations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = (await response.json()) as OperationResult;
      setResult(body);
    } catch (error) {
      setResult({
        status: "error",
        message: error instanceof Error ? error.message : "Could not reach the Underwrite operator."
      });
    } finally {
      setRunningAction(null);
    }
  }

  async function connectWallet() {
    const provider = getCasperWalletProvider();
    if (!provider) {
      setWalletStatus("wallet extension not found");
      return;
    }

    try {
      if (typeof provider.requestConnection === "function") {
        await provider.requestConnection();
      } else if (typeof provider.connect === "function") {
        await provider.connect();
      }

      const publicKey = await readWalletPublicKey(provider);
      if (!publicKey) {
        setWalletStatus("connected, no public key returned");
        return;
      }

      setWalletPublicKey(publicKey);
      setWalletStatus("connected");
      setSigningDetected(
        typeof provider.sign === "function" || typeof provider.signDeploy === "function"
      );
    } catch (error) {
      setWalletStatus(error instanceof Error ? error.message : "connection rejected");
    }
  }

  async function registerPolicyWithWallet() {
    setWalletDeployState("signing");
    setWalletDeployError(null);
    setWalletDeployHash(null);

    try {
      const contractHash = runtimeConfig.contractHash;
      const rpcUrl = runtimeConfig.rpcUrl;
      const chainName = runtimeConfig.chainName || "casper-test";
      
      if (!contractHash) {
        throw new Error("Contract hash is missing. Set UNDERWRITE_CONTRACT_ADDRESS or NEXT_PUBLIC_UNDERWRITE_CONTRACT_HASH in Railway variables, then redeploy.");
      }
      if (!rpcUrl) {
        throw new Error("RPC URL is missing. Set CASPER_NODE_ADDRESS or NEXT_PUBLIC_CASPER_RPC_URL in Railway variables, then redeploy.");
      }

      const provider = getCasperWalletProvider();
      if (!provider) throw new Error("Casper wallet not found.");

      const { createRegisterPolicySelfDeploy, requestWalletSignature } = await import("../lib/casper-wallet-deploy");
      
      const deploy = createRegisterPolicySelfDeploy({
        senderPublicKeyHex: walletPublicKey,
        contractHashHex: contractHash,
        policyNumber: form.policyId,
        insuredValueMinor: Number(form.insuredValueMinor),
        currency: form.currency,
        oraclePublicKeyHex: "01fd1724385aa0c75b64fb78cd602fa1d991fdebf76b13c58ed702eac835e9f618", // using the demo oracle key with 01 ed25519 tag
        networkName: chainName,
      });

      const signedDeploy = await requestWalletSignature(deploy, walletPublicKey, provider);
      
      setWalletDeployState("submitting");
      // @ts-ignore
      const { DeployUtil } = await import("casper-js-sdk");
      const deployJson = DeployUtil.deployToJson(signedDeploy);
      
      const res = await fetch("/api/operations/submit-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployJson })
      });
      
      const data = await res.json();
      if (!res.ok || data.status === "error") {
        throw new Error(data.message || "Failed to submit deploy to the network.");
      }
      
      setWalletDeployHash(data.deployHash);
    } catch (err) {
      setWalletDeployError(err instanceof Error ? err.message : String(err));
    } finally {
      setWalletDeployState("idle");
    }
  }

  async function requestAgentVerification() {
    setAgentRequestState("signing");
    setAgentRequestError(null);
    setAgentRequestResult(null);

    try {
      const contractHash = runtimeConfig.contractHash;
      const chainName = runtimeConfig.chainName || "casper-test";
      
      if (!contractHash) throw new Error("Contract hash missing. Set UNDERWRITE_CONTRACT_ADDRESS or NEXT_PUBLIC_UNDERWRITE_CONTRACT_HASH in Railway variables, then redeploy.");
      
      const provider = getCasperWalletProvider();
      if (!provider) throw new Error("Casper wallet not found.");

      const nonce = `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const issuedAt = Date.now();
      const expiresAt = issuedAt + 15 * 60 * 1000; // 15 mins
      const evidenceHash = "demo-scenario-cargo-delay"; // Hardcoded for MVP demo

      const messageString = [
        `Underwrite Agent Verification Request`,
        `Chain: ${chainName}`,
        `Contract: ${contractHash}`,
        `Policy: ${form.policyId}`,
        `Claimant: ${walletPublicKey}`,
        `Evidence: ${evidenceHash}`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
        `Expires At: ${expiresAt}`
      ].join("\n");

      const { requestWalletMessageSignature } = await import("../lib/casper-wallet-deploy");
      const signature = await requestWalletMessageSignature(messageString, walletPublicKey, provider);

      setAgentRequestState("verifying");

      const res = await fetch("/api/agent/request-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimantPublicKey: walletPublicKey,
          policyId: form.policyId,
          evidenceHash,
          nonce,
          issuedAt,
          expiresAt,
          chainName,
          contractHash,
          signature
        })
      });

      const data = await res.json();
      if (!res.ok || data.status === "error") {
        throw new Error(data.message || "Failed to submit request.");
      }

      setAgentRequestState("done");
      setAgentRequestResult({
        deployHash: data.deployHash,
        explorerUrl: data.explorerUrl,
        message: data.message
      });

    } catch (err) {
      setAgentRequestState("idle");
      setAgentRequestError(err instanceof Error ? err.message : String(err));
    }
  }

  function operationStatus(action: OperationAction): "ready" | "running" | "success" | "failed" | "disabled" {
    if (runningAction === action) return "running";
    if (result?.action !== action) return "ready";
    if (result.status === "success") return "success";
    if (result.status === "not_configured") return "disabled";
    return "failed";
  }

  const walletStepStatus = walletPublicKey ? "success" : "ready";

  return (
    <section id="operate" className="relative overflow-hidden bg-[#0a0a0f] px-5 py-24 sm:px-8">
      <div className="absolute left-0 top-0 h-[460px] w-[460px] rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-ember">Underwrite</p>
            <h2 className="mt-4 max-w-4xl text-[clamp(2.4rem,5vw,5rem)] font-black leading-[0.94] tracking-[-0.07em] text-white">
              Own your policy. Let the agent handle claims.
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-zinc-400">
            Underwrite lets apps create automatic protection policies. If trusted evidence proves something went wrong, an agent checks the evidence and Casper releases the payout by rule.
          </p>
        </div>

        <div className="mt-8">
          <ProductModelStrip />
        </div>

        {/* Mode toggle */}
        <div className="mt-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMode("wallet")}
            className={`rounded-full px-5 py-2.5 text-sm font-black transition ${activeMode === "wallet" ? "bg-white text-gray-950" : "border border-white/15 bg-white/10 text-white hover:bg-white/15"}`}
          >
            Wallet Mode
          </button>
          <button
            type="button"
            onClick={() => setActiveMode("operator")}
            className={`rounded-full px-5 py-2.5 text-sm font-black transition ${activeMode === "operator" ? "bg-white text-gray-950" : "border border-white/15 bg-white/10 text-white hover:bg-white/15"}`}
          >
            Operator Mode
          </button>
        </div>

        {/* ─── WALLET MODE ─── */}
        {activeMode === "wallet" && (
          <div className="mt-8">
            <WalletModeValueProp />

            <div className="mt-8 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="grid gap-4">
                {walletModeSteps.map((step) => (
                  <WalletModeStepCard key={step.number} step={step}>
                    {step.number === "3" && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        {walletDeployHash ? (
                          <div className="rounded-2xl border border-signal/20 bg-signal/10 p-4">
                            <p className="text-sm font-semibold text-signal">Registration submitted</p>
                            <a 
                              href={`${runtimeConfig.explorerBaseUrl}/transaction/${walletDeployHash}`}
                              target="_blank" rel="noreferrer"
                              className="mt-1 block font-mono text-xs text-signal/80 underline hover:text-signal break-all"
                            >
                              {walletDeployHash}
                            </a>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={registerPolicyWithWallet}
                              disabled={!walletPublicKey || walletDeployState !== "idle"}
                              className="rounded-2xl bg-[#e8702a] px-5 py-3 text-sm font-black text-white transition hover:bg-[#d2611f] disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {walletDeployState === "signing" ? "Requesting Signature..." :
                               walletDeployState === "submitting" ? "Submitting Deploy..." :
                               "Register Policy With Wallet"}
                            </button>
                            {walletDeployError && (
                              <p className="mt-3 text-sm text-ember">{walletDeployError}</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {step.number === "5" && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        {agentRequestState === "done" && agentRequestResult?.deployHash ? (
                          <div className="rounded-2xl border border-signal/20 bg-signal/10 p-4">
                            <p className="text-sm font-semibold text-signal">Verification Complete</p>
                            <p className="mt-1 text-xs text-signal/80">Agent verified evidence and submitted the settlement.</p>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={requestAgentVerification}
                              disabled={!walletPublicKey || !walletDeployHash || agentRequestState !== "idle"}
                              className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {agentRequestState === "signing" ? "Requesting Signature..." :
                               agentRequestState === "verifying" ? "Verifying Evidence & Submitting Settlement..." :
                               agentRequestState === "submitting" ? "Submitting Settlement..." :
                               !walletDeployHash ? "Register Policy First" :
                               "Request Agent Verification"}
                            </button>
                            {agentRequestError && (
                              <p className="mt-3 text-sm text-ember">{agentRequestError}</p>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {step.number === "6" && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        {agentRequestResult?.deployHash ? (
                          <div className="rounded-2xl border border-signal/20 bg-signal/10 p-4">
                            <p className="text-sm font-semibold text-signal">Settlement submitted</p>
                            <a 
                              href={agentRequestResult.explorerUrl || `${runtimeConfig.explorerBaseUrl}/transaction/${agentRequestResult.deployHash}`}
                              target="_blank" rel="noreferrer"
                              className="mt-1 block font-mono text-xs text-signal/80 underline hover:text-signal break-all"
                            >
                              {agentRequestResult.deployHash}
                            </a>
                            <p className="mt-2 text-xs text-zinc-400">{agentRequestResult.message}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-500 italic">Waiting for verification request...</p>
                        )}
                      </div>
                    )}
                  </WalletModeStepCard>
                ))}
              </div>
              <div className="grid gap-5 content-start">
                <WalletCapabilityPanel
                  publicKey={walletPublicKey}
                  walletStatus={walletStatus}
                  signingDetected={signingDetected}
                  onConnect={connectWallet}
                />
                <article className="glass-card rounded-[2rem] p-5">
                  <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Your policy details</p>
                  <div className="mt-4 grid gap-3">
                    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <label className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Policy ID</label>
                      <input 
                        type="text" 
                        value={form.policyId} 
                        onChange={(e) => setForm(f => ({ ...f, policyId: e.target.value }))}
                        className="bg-transparent text-sm font-semibold text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <label className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Coverage Type</label>
                      <input 
                        type="text" 
                        defaultValue="Cargo delay" 
                        readOnly
                        className="bg-transparent text-sm font-semibold text-white/50 focus:outline-none cursor-not-allowed"
                      />
                    </div>
                    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <label className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Insured value (minor units)</label>
                      <input 
                        type="number" 
                        value={form.insuredValueMinor} 
                        onChange={(e) => setForm(f => ({ ...f, insuredValueMinor: e.target.value }))}
                        className="bg-transparent text-sm font-semibold text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <label className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Currency</label>
                      <input 
                        type="text" 
                        value={form.currency} 
                        onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}
                        className="bg-transparent text-sm font-semibold text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <label className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Payout rule</label>
                      <input 
                        type="text" 
                        defaultValue="48–240 hour delay tiers" 
                        readOnly
                        className="bg-transparent text-sm font-semibold text-white/50 focus:outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        )}

        {/* ─── OPERATOR MODE ─── */}
        {activeMode === "operator" && (
          <div className="mt-8">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 mb-8">
              <p className="text-sm font-semibold text-amber-300">
                Operator Mode is for local administration. Operations execute through
                server-side scripts and require <span className="font-mono text-amber-200">UNDERWRITE_ENABLE_OPERATOR_ACTIONS=true</span>.
              </p>
            </div>

            <div className="grid gap-4">
              <WorkflowStepCard
                number="1"
                title="Connect wallet or use configured claimant"
                status={walletStepStatus}
                mapping="Casper wallet provider / configured claimant"
                expectedOutput="Public key or account-hash used as claimant identity"
                meaning="The wallet tells Underwrite who the claimant or operator is. It does not expose private keys to the app."
              />
              <WorkflowStepCard
                number="2"
                title="Register policy"
                status={operationStatus("register_policy")}
                mapping={`${operationMeta.register_policy.backend} -> ${operationMeta.register_policy.script}`}
                expectedOutput={operationMeta.register_policy.output}
                meaning={operationMeta.register_policy.meaning}
              />
              <WorkflowStepCard
                number="3"
                title="Run agent verification"
                status={operationStatus("run_agent")}
                mapping={`${operationMeta.run_agent.backend} -> ${operationMeta.run_agent.script}`}
                expectedOutput={operationMeta.run_agent.output}
                meaning={operationMeta.run_agent.meaning}
              />
              <WorkflowStepCard
                number="4"
                title="Submit claim attestation"
                status={operationStatus("submit_claim")}
                mapping={`${operationMeta.submit_claim.backend} -> ${operationMeta.submit_claim.script}`}
                expectedOutput={operationMeta.submit_claim.output}
                meaning={operationMeta.submit_claim.meaning}
              />
              <WorkflowStepCard
                number="5"
                title="View result and explorer proof"
                status={
                  result?.status === "success"
                    ? "success"
                    : result?.status === "error"
                      ? "failed"
                      : result?.status === "not_configured"
                        ? "disabled"
                        : "ready"
                }
                mapping="Operation result panel"
                expectedOutput="Status, timestamp, output file, deploy hash, and explorer link when available"
                meaning="No deploy hash is invented. The result panel only shows hashes returned by the server-side operation."
              />
            </div>

            <div className="mt-10 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-5">
                <WalletConnectCard
                  publicKey={walletPublicKey}
                  walletStatus={walletStatus}
                  onConnect={connectWallet}
                  onUseAccount={() => {
                    if (walletPublicKey) updateField("claimantAccount", walletPublicKey);
                  }}
                />

                <article className="glass-card gradient-border rounded-[2rem] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                        Operation 01
                      </p>
                      <h3 className="mt-2 text-2xl font-black tracking-[-0.06em] text-white">Register policy</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        Create or update a policy for a claimant, insured value, and
                        authorized evidence key.
                      </p>
                    </div>
                    <span className="rounded-full bg-violet-500/10 px-3 py-1 font-mono text-[11px] font-black uppercase text-violet-200">
                      Contract call
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <input
                      value={form.policyId}
                      onChange={(event) => updateField("policyId", event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-sm text-white outline-none focus:border-ember/60"
                      placeholder="Policy ID"
                    />
                    <input
                      value={form.insuredValueMinor}
                      onChange={(event) => updateField("insuredValueMinor", event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-sm text-white outline-none focus:border-ember/60"
                      placeholder="Insured value minor units"
                    />
                    <input
                      value={form.claimantAccount}
                      onChange={(event) => updateField("claimantAccount", event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-sm text-white outline-none focus:border-ember/60 md:col-span-2"
                      placeholder="Claimant account-hash or public key"
                    />
                    <input
                      value={form.currency}
                      onChange={(event) => updateField("currency", event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-sm text-white outline-none focus:border-ember/60"
                      placeholder="Currency"
                    />
                    <button
                      type="button"
                      onClick={() => runOperation("register_policy")}
                      disabled={runningAction !== null}
                      className="rounded-2xl bg-[#e8702a] px-5 py-3 text-sm font-black text-white transition hover:bg-[#d2611f] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {runningAction === "register_policy" ? "Submitting..." : "Register Policy"}
                    </button>
                  </div>
                </article>

                <div className="grid gap-5 lg:grid-cols-2">
                  <article className="glass-card rounded-[2rem] p-5">
                    <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Operation 02</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.06em] text-white">Verify evidence</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Run the Rust agent against a signed risk attestation and write
                      the claim report used for settlement.
                    </p>
                    <div className="mt-5 grid gap-3">
                      <input
                        value={form.signedRiskPath}
                        onChange={(event) => updateField("signedRiskPath", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-sm text-white outline-none focus:border-ember/60"
                        placeholder="fixtures/signed-risk-attestation.cargo-delay.json"
                      />
                      <input
                        value={form.outputPath}
                        onChange={(event) => updateField("outputPath", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-sm text-white outline-none focus:border-ember/60"
                        placeholder="deployments/latest-attestation.json"
                      />
                      <button
                        type="button"
                        onClick={() => runOperation("run_agent")}
                        disabled={runningAction !== null}
                        className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {runningAction === "run_agent" ? "Verifying..." : "Run Agent Verification"}
                      </button>
                    </div>
                  </article>

                  <article className="glass-card rounded-[2rem] p-5">
                    <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Operation 03</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.06em] text-white">Submit claim</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      Submit a verified claim attestation to the settlement contract
                      and return the Testnet transaction hash.
                    </p>
                    <div className="mt-5 grid gap-3">
                      <input
                        value={form.attestationPath}
                        onChange={(event) => updateField("attestationPath", event.target.value)}
                        className="rounded-2xl border border-white/10 bg-black/35 px-4 py-3 font-mono text-sm text-white outline-none focus:border-ember/60"
                        placeholder="deployments/latest-attestation.json"
                      />
                      <button
                        type="button"
                        onClick={() => runOperation("submit_claim")}
                        disabled={runningAction !== null}
                        className="rounded-2xl border border-signal/30 bg-signal/10 px-5 py-3 text-sm font-black text-signal transition hover:bg-signal/15 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {runningAction === "submit_claim" ? "Submitting..." : "Submit Claim"}
                      </button>
                    </div>
                  </article>
                </div>
              </div>

              <aside className="glass-card rounded-[2rem] p-5">
                <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Operator result</p>
                <OperationResultPanel result={result} />
              </aside>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function SettlementEvidence() {
  return (
    <section id="evidence" className="relative overflow-hidden bg-[#0a0a0f] px-5 py-24 sm:px-8">
      <div className="absolute right-0 top-0 h-[440px] w-[440px] rounded-full bg-signal/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-ember">Settlement Audit Trail</p>
            <h2 className="mt-4 text-[clamp(2.4rem,5vw,5rem)] font-black leading-[0.94] tracking-[-0.07em] text-white">
              A readable audit log for every critical action.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-zinc-400">
              Each row is a real Casper Testnet event: policy registration,
              valid claim payment, duplicate replay rejection, and stale or
              expired evidence rejection. Use the explorer links to verify the
              transaction yourself.
            </p>
            <div className="mt-8 glass-card gradient-border rounded-[2rem] p-5">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-signal/10 text-signal">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-white">Network state</p>
                  <p className="font-mono text-xs text-zinc-500">{evidence.network} / {evidence.chainName}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <ExplorerButton href={evidence.explorerLinks.underwriteContract}>Contract deploy</ExplorerButton>
                <ExplorerButton href={evidence.explorerLinks.settlementToken}>Token deploy</ExplorerButton>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {statusCards.map((card) => {
              const rejected = card.status === "rejected";
              return (
                <article key={card.title} className="glass-card rounded-[1.45rem] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-4">
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${
                          rejected ? "bg-ember/10 text-ember" : "bg-signal/10 text-signal"
                        }`}
                      >
                        {rejected ? <Ban className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                      </span>
                      <div>
                        <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-ember">{card.mode}</p>
                        <p className="text-lg font-black tracking-[-0.04em] text-white">{card.title}</p>
                        <p className="mt-1 text-sm leading-6 text-zinc-400">{card.body}</p>
                        <p className="mt-2 font-mono text-xs text-zinc-600">{formatTimestamp(card.timestamp)}</p>
                      </div>
                    </div>
                    <span
                      className={`w-fit rounded-full px-3 py-1 font-mono text-[11px] font-black uppercase ${
                        rejected ? "bg-ember/10 text-ember" : "bg-signal/10 text-signal"
                      }`}
                    >
                      {card.status}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <CopyableValue value={card.hash} />
                    <ExplorerButton href={card.href}>Explorer</ExplorerButton>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function DataGrid({
  title,
  icon,
  rows
}: {
  title: string;
  icon: ReactNode;
  rows: readonly (readonly [string, string])[];
}) {
  return (
    <article className="glass-card rounded-[2rem] p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-violet-500/10 text-violet-200">{icon}</div>
        <h3 className="text-xl font-black tracking-[-0.05em] text-white">{title}</h3>
      </div>
      <div className="mt-6 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center">
            <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
            {value.startsWith("hash-") || value.startsWith("account-hash-") || /^https?:\/\//i.test(value) || /^[0-9a-f]{64}$/i.test(value) ? (
              <CopyableValue value={value} compact={!/^https?:\/\//i.test(value)} />
            ) : (
              <p className="text-sm font-semibold text-white sm:text-right">{value}</p>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

export function PolicyAndInfrastructure() {
  return (
    <section id="policy" className="bg-[#07070a] px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-ember">Policy & Infrastructure</p>
            <h2 className="mt-4 max-w-3xl text-[clamp(2.3rem,5vw,4.7rem)] font-black leading-[0.94] tracking-[-0.07em] text-white">
              Policy, vault, token, and account state at a glance.
            </h2>
          </div>
          <div className="glass-card flex items-center gap-4 rounded-2xl p-4 text-signal">
            <Vault className="h-6 w-6" />
            <div>
              <p className="font-semibold text-white">Vault settlement path</p>
              <p className="text-sm text-zinc-500">Active on Casper Testnet</p>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Policy admin", "Defines the claimant, insured value, currency, and trusted evidence key."],
            ["Vault admin", "Tracks the settlement contract, token, and vault used to pay valid claims."],
            ["Network admin", "Shows the Casper network and public hashes operators need for verification."]
          ].map(([title, body]) => (
            <article key={title} className="glass-card rounded-2xl p-5">
              <p className="font-mono text-[11px] font-black uppercase tracking-[0.18em] text-ember">{title}</p>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{body}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 grid gap-5 xl:grid-cols-2">
          <DataGrid title="Protocol infrastructure" icon={<Vault className="h-5 w-5" />} rows={infrastructureRows} />
          <DataGrid title="Policy terms and claim result" icon={<ShieldCheck className="h-5 w-5" />} rows={policyRows} />
        </div>
      </div>
    </section>
  );
}

export function AgentActivity() {
  return (
    <section id="agent" className="bg-[#08080c] px-5 py-24 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-ember">Agent Activity</p>
          <h2 className="mt-4 text-[clamp(2.3rem,5vw,4.6rem)] font-black leading-[0.95] tracking-[-0.07em] text-white">
            The agent turns evidence into a claim package.
          </h2>
          <p className="mt-6 max-w-md text-base leading-8 text-zinc-400">
            Underwrite is agentic, but not vague. The agent verifies signed
            evidence and prepares the claim attestation. Casper still enforces
            the final payout decision with deterministic contract rules.
          </p>
        </div>
        <div className="grid gap-3">
          {agentActivity.map(([title, detail], index) => (
            <article key={title} className="glass-card flex items-start gap-4 rounded-2xl p-5">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-violet-400/20 bg-violet-500/10 font-mono text-xs font-black text-violet-200">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold text-white">{title}</p>
                <p className="font-mono text-sm text-zinc-500">{detail}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {[
                    "The evidence source reports what happened to the insured shipment.",
                    "The agent checks that the evidence was signed by the authorized oracle key.",
                    "The delay is mapped to a payout tier by deterministic code, not AI judgment.",
                    "The agent writes the structured claim package the contract can understand.",
                    "The server-side relayer submits the claim to Casper without exposing browser keys.",
                    "The dashboard links to the accepted claim and rejected unsafe attempts."
                  ][index]}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="bg-black px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-ember">How Underwrite Works</p>
            <h2 className="mt-4 max-w-3xl text-[clamp(2.3rem,5vw,4.8rem)] font-black leading-[0.94] tracking-[-0.07em] text-white">
              Trusted evidence in. Safe settlement out.
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-zinc-400">
            Underwrite does not sell insurance or ask AI to decide claims. The
            agent checks evidence; deterministic contract rules decide whether a
            payout can happen.
          </p>
        </div>
        <div className="mt-10 grid gap-3 lg:grid-cols-5">
          {pipeline.map(([title, body], index) => (
            <article key={title} className="glass-card relative rounded-[1.5rem] p-5">
              <div className="mb-8 flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 font-mono text-xs font-black text-white">{index + 1}</span>
                {index < pipeline.length - 1 ? <ArrowUpRight className="hidden h-4 w-4 text-zinc-600 lg:block" /> : null}
              </div>
              <h3 className="text-lg font-black tracking-[-0.04em] text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-500">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
