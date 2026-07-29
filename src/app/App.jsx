import { Counter } from '../features/counter/components/Counter.jsx'
import { ResourceLinks } from '../features/home/components/ResourceLinks.jsx'
import { Hero } from '../features/home/components/Hero.jsx'
import './App.css'

export function App() {
  return (
    <main className="app-shell">
      <Hero />
      <Counter />
      <ResourceLinks />
    </main>
  )
}
