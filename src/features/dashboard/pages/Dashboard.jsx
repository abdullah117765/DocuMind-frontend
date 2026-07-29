import { RevenueChart } from '../components/RevenueChart.jsx'
import { StatsCard } from '../components/StatsCard.jsx'

export function Dashboard() {
  return (
    <main className="page">
      <header>
        <p className="eyebrow">Overview</p>
        <h1>Dashboard</h1>
      </header>
      <section className="stats" aria-label="Key statistics">
        <StatsCard label="Users" trend="+12% this month" value="1,248" />
        <StatsCard label="Revenue" trend="+8% this month" value="$24,500" />
        <StatsCard label="Orders" trend="+16% this month" value="384" />
      </section>
      <RevenueChart />
    </main>
  )
}
