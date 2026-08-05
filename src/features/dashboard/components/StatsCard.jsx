export function StatsCard({ label, value, trend }) {
  return (
    <article className="card">
      <p>{label}</p>
      <strong className="stat">{value}</strong>
      {trend && <small>{trend}</small>}
    </article>
  )
}
