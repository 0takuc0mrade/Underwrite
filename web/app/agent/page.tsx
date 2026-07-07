import { AgentActivity, HowItWorks, TopNav } from "../underwrite-ui";

export default function AgentPage() {
  return (
    <main className="min-h-screen bg-[#08080c] tracking-[-0.02em]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <TopNav />
      <div className="pt-20">
        <AgentActivity />
        <HowItWorks />
      </div>
    </main>
  );
}
