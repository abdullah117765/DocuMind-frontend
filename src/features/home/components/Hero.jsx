import reactLogo from '../../../assets/react.svg'
import viteLogo from '../../../assets/vite.svg'

export function Hero() {
  return (
    <header className="hero">
      <div className="hero__logos" aria-hidden="true">
        <img className="hero__logo" src={reactLogo} alt="" />
        <img className="hero__logo" src={viteLogo} alt="" />
      </div>
      <h1>React + Vite</h1>
      <p>A clean, feature-based project ready for API integration.</p>
    </header>
  )
}
