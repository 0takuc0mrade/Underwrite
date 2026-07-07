import { SettlementEvidence, TopNav } from "../underwrite-ui";

export default function EvidencePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] tracking-[-0.02em]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <TopNav />
      <div className="pt-20">
        <SettlementEvidence />
      </div>
    </main>
  );
}
