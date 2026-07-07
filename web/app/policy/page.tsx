import { PolicyAndInfrastructure, TopNav } from "../underwrite-ui";

export default function PolicyPage() {
  return (
    <main className="min-h-screen bg-[#07070a] tracking-[-0.02em]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <TopNav />
      <div className="pt-20">
        <PolicyAndInfrastructure />
      </div>
    </main>
  );
}
