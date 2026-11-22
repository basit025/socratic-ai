import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/** Last line of defence: a crash shows a friendly recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Socratic AI crashed:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-24 max-w-md px-4 text-center">
        <AlertTriangle className="mx-auto size-9 text-danger" aria-hidden />
        <h1 className="mt-3 text-xl font-bold">Something went wrong on this page</h1>
        <p className="mt-2 text-ink-2">Your saved work is safe. Reload the page to continue.</p>
        <button onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-lg bg-action px-5 font-semibold text-white hover:bg-action-hover">
          Reload the page
        </button>
      </div>
    );
  }
}
