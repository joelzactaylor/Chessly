import { Component, type ReactNode } from 'react';

interface State { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page narrow">
        <div className="card summary">
          <div className="big">Something went wrong on this screen</div>
          <p className="muted mono" style={{ fontSize: 13, whiteSpace: 'pre-wrap', textAlign: 'left', maxWidth: '100%' }}>{String(this.state.error?.message ?? this.state.error)}</p>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn primary" onClick={() => location.reload()}>Reload</button>
            <a className="btn" href="#/" onClick={() => this.setState({ error: null })}>Home</a>
          </div>
        </div>
      </div>
    );
  }
}
