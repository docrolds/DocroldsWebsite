import { Component } from 'react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-card text-foreground p-8 text-center">
          <i className="fas fa-exclamation-triangle text-5xl text-primary mb-4"></i>
          <h1 className="text-2xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">
            We encountered an unexpected error. Please try reloading the page.
          </p>
          <Button onClick={this.handleReload}>
            Reload Page
          </Button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-8 text-left max-w-[600px]">
              <summary className="cursor-pointer text-primary">Error Details</summary>
              <pre className="bg-muted p-4 rounded overflow-auto text-sm mt-2 text-foreground">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
