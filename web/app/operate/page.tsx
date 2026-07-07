import { OperationsConsole, TopNav } from "../underwrite-ui";

export default function OperatePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] tracking-[-0.02em]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <TopNav />
      <div className="pt-20">
        <OperationsConsole />
      </div>
    </main>
  );
}
