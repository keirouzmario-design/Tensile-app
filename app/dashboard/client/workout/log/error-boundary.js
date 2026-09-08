"use client";

import { Component } from "react";

export default class LogErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="card"
          style={{ padding: 16, borderColor: "var(--rust)", color: "var(--rust)" }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Something broke on this page. Here's the exact error:
          </div>
          <div style={{ fontSize: 13, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
            {this.state.error.message}
          </div>
          <div style={{ fontSize: 13, fontFamily: "monospace", whiteSpace: "pre-wrap", marginTop: 8 }}>
            {this.state.error.stack}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
