import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app, #f9f9fb)',
          padding: 24,
          fontFamily: 'var(--font-family, sans-serif)'
        }}>
          <div style={{
            maxWidth: 480,
            width: '100%',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 20,
            padding: 28,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
            border: '1px solid var(--border, #e4e4eb)',
            textAlign: 'center'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#991b1b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-main, #121117)' }}>
              Application Display Notice
            </h2>

            <p style={{ fontSize: 13, color: 'var(--text-muted, #64748b)', margin: '0 0 20px', lineHeight: 1.5 }}>
              A view encountered an issue while loading data. You can refresh to restore the latest synced state.
            </p>

            {this.state.error && (
              <div style={{
                background: 'var(--bg-subtle, #f2f2f6)',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 12,
                color: '#ef4444',
                fontFamily: 'monospace',
                textAlign: 'left',
                marginBottom: 20,
                maxHeight: 100,
                overflowY: 'auto'
              }}>
                {this.state.error.message}
              </div>
            )}

            <button
              onClick={this.handleReset}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: 12,
                background: 'var(--primary, #ff9e01)',
                color: '#ffffff',
                border: 'none',
                fontSize: 14,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
