import { Hero, HowItWorks, OverviewDashboard } from "./underwrite-ui";

export default function Home() {
  return (
    <main className="min-h-screen bg-black tracking-[-0.02em]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Hero />
      <OverviewDashboard />
      <HowItWorks />
    </main>
  );
}
