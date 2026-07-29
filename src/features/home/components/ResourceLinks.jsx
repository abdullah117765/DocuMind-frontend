const resources = [
  {
    title: 'React documentation',
    description: 'Learn components, hooks, and application patterns.',
    href: 'https://react.dev/',
  },
  {
    title: 'Vite documentation',
    description: 'Explore development and production configuration.',
    href: 'https://vite.dev/',
  },
]

export function ResourceLinks() {
  return (
    <section className="resources" aria-label="Developer resources">
      {resources.map((resource) => (
        <a
          className="resource-card"
          href={resource.href}
          key={resource.href}
          rel="noreferrer"
          target="_blank"
        >
          <h2>{resource.title}</h2>
          <p>{resource.description}</p>
        </a>
      ))}
    </section>
  )
}
