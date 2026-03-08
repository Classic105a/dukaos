import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Copy, CheckCircle2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });

    // Log to localStorage for debugging
    try {
      const crashLog = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      };
      const logs = JSON.parse(localStorage.getItem('crash_logs') || '[]');
      logs.unshift(crashLog);
      // Keep last 10 crash logs
      localStorage.setItem('crash_logs', JSON.stringify(logs.slice(0, 10)));
    } catch {
      // Ignore storage errors
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined, copied: false });
  };

  private handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const text = [
      `Error: ${error?.message}`,
      `Stack: ${error?.stack}`,
      `Component: ${errorInfo?.componentStack}`,
      `URL: ${window.location.href}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n\n');
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="text-center max-w-lg">
            <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-2 text-sm">
              An unexpected error occurred. Your data is safe — please try again.
            </p>
            {this.state.error && (
              <p className="text-xs text-destructive/80 bg-destructive/5 rounded-lg px-3 py-2 mb-6 font-mono max-w-md mx-auto truncate">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline" onClick={this.handleRetry} size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={() => (window.location.href = '/dashboard')} size="lg">
                <Home className="w-4 h-4 mr-2" />
                Go to POS
              </Button>
            </div>
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={this.handleCopyError}
              >
                {this.state.copied ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1 text-success" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copy error details
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
