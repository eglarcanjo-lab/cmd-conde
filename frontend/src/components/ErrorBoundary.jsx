import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || String(err) };
  }

  componentDidCatch(err, info) {
    console.error("[ErrorBoundary]", err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          background: "#0c1410",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Poppins', 'Segoe UI', system-ui, sans-serif",
          gap: "16px",
          padding: "32px",
        }}>
          <span style={{ fontSize: "2.5rem" }}>⚠️</span>
          <h2 style={{ color: "#f87171", margin: 0, fontSize: "1.1rem" }}>Erro ao carregar a página</h2>
          <p style={{ color: "rgba(255,255,255,0.4)", margin: 0, fontSize: "0.85rem", textAlign: "center", maxWidth: "400px" }}>
            {this.state.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: "rgba(125,186,61,0.12)",
              border: "1px solid rgba(125,186,61,0.3)",
              color: "#7DBA3D",
              padding: "10px 20px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.9rem",
              fontFamily: "inherit",
              marginTop: "8px",
            }}
          >
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
