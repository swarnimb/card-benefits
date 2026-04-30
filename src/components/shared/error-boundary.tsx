"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Catches unhandled client-side errors and renders a recovery UI. */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-4 px-4">
          <p className="text-center text-[#9CA3AF]">Something went wrong</p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-[48px] rounded-full bg-[#1A1917] px-6 py-3 text-sm font-medium text-[#F9F9F8]"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
