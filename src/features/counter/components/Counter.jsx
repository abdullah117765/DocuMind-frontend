import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <section className="counter-card" aria-labelledby="counter-title">
      <h2 id="counter-title">Component state example</h2>
      <p aria-live="polite">Current count: {count}</p>
      <button
        className="button"
        onClick={() => setCount((currentCount) => currentCount + 1)}
        type="button"
      >
        Increase count
      </button>
    </section>
  )
}
