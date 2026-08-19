import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Frontend render error', error, info)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="app-error-state">
        <section className="app-error-state__card">
          <p className="eyebrow">Something went wrong</p>
          <h1>We could not load this screen.</h1>
          <p>
            Please refresh the page. If the problem continues, contact your
            administrator.
          </p>
          <button
            className="button button--primary"
            onClick={this.handleReload}
            type="button"
          >
            Refresh page
          </button>
        </section>
      </main>
    )
  }
}
