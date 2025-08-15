/**
 * React Performance Optimizations
 * Collection of hooks and components for optimizing React performance
 */

import React, {
  memo,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useRef,
  ReactNode,
  ComponentType,
  ErrorInfo
} from 'react';
import PropTypes from 'prop-types';

// Re-export React optimization utilities
export { memo, useMemo, useCallback };

// Custom hook for virtual scrolling
export const useVirtualScrolling = <T,>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index
    }));
  }, [items, itemHeight, containerHeight, scrollTop]);
  
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);
  
  return { visibleItems, handleScroll };
};

// Debounced input hook
export const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

// Throttled callback hook
export const useThrottledCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T => {
  const lastRun = useRef(Date.now());
  
  return useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]) as T;
};

// Intersection observer hook for lazy loading
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      setEntry(entry);
    }, options);
    
    observer.observe(element);
    
    return () => {
      observer.unobserve(element);
    };
  }, [options]);
  
  return { elementRef, isIntersecting, entry };
};

// Lazy loading component
interface LazyComponentProps {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  threshold?: number;
}

export const LazyComponent: React.FC<LazyComponentProps> = ({
  children,
  fallback = <div>Loading...</div>,
  rootMargin = '50px',
  threshold = 0.1
}) => {
  const { elementRef, isIntersecting } = useIntersectionObserver({
    rootMargin,
    threshold
  });
  
  return (
    <div ref={elementRef as React.RefObject<HTMLDivElement>}>
      {isIntersecting ? children : fallback}
    </div>
  );
};

// Error boundary with performance tracking
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class OptimizedErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ComponentType<{ error?: Error }> },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback?: ComponentType<{ error?: Error }> }) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Track error performance impact
    console.error('Component error caught:', error, errorInfo);
    
    // Report to analytics if available
    if ('gtag' in window) {
      (window as Window & { gtag: (command: string, action: string, parameters: Record<string, unknown>) => void }).gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  }
  
  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;
      if (FallbackComponent) {
        return <FallbackComponent error={this.state.error} />;
      }
      
      return (
        <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p>An error occurred while rendering this component.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Performance monitoring HOC
export const withPerformanceMonitoring = <P extends object>(
  Component: ComponentType<P>,
  componentName: string
) => {
  const WrappedComponent = memo((props: P) => {
    const renderStart = useRef<number>();
    const mountTime = useRef<number>();
    
    // Track mount time
    useEffect(() => {
      mountTime.current = performance.now();
      
      return () => {
        if (mountTime.current) {
          const unmountTime = performance.now() - mountTime.current;
          console.log(`${componentName} was mounted for ${unmountTime.toFixed(2)}ms`);
        }
      };
    }, []);
    
    // Track render time
    renderStart.current = performance.now();
    
    useEffect(() => {
      if (renderStart.current) {
        const renderTime = performance.now() - renderStart.current;
        if (renderTime > 16) { // More than one frame
          console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`);
        }
      }
    });
    
    return <Component {...props} />;
  });

  WrappedComponent.displayName = `withPerformanceMonitoring(${componentName})`;
  return WrappedComponent;
};

// Add display name to the HOC
withPerformanceMonitoring.displayName = 'withPerformanceMonitoring';

// Optimized list component with virtualization
interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;
  height: number;
  className?: string;
}

export const OptimizedList = <T,>({
  items,
  renderItem,
  itemHeight,
  height,
  className
}: OptimizedListProps<T>) => {
  const { visibleItems, handleScroll } = useVirtualScrolling(
    items,
    itemHeight,
    height
  );
  
  const totalHeight = items.length * itemHeight;
  const offsetY = visibleItems.length > 0 ? visibleItems[0].index * itemHeight : 0;
  
  return (
    <div 
      className={className}
      style={{ height, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map(({ item, index }) => (
            <div key={index} style={{ height: itemHeight }}>
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Memoized component with custom comparison
export const MemoizedComponent = memo(({
  data
}: {
  data: unknown
}) => {
  return (
    <div>
      {JSON.stringify(data)}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison logic
  return (
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  );
});

MemoizedComponent.displayName = 'MemoizedComponent';

// Optimized search input with debouncing
interface OptimizedSearchProps {
  value: string;
  placeholder?: string;
  delay?: number;
  label: string;
  onChange: (value: string) => void;
}

export const OptimizedSearch: React.FC<OptimizedSearchProps> = memo(({
  value,
  placeholder,
  delay = 300,
  label,
  onChange
}) => {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebouncedValue(localValue, delay);
  
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);
  
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  return (
    <div>
      <label htmlFor="optimized-search">{label}</label>
      <input
        id="optimized-search"
        type="text"
        value={localValue}
        placeholder={placeholder}
        onChange={(e) => setLocalValue(e.target.value)}
      />
    </div>
  );
});

OptimizedSearch.displayName = 'OptimizedSearch';

OptimizedSearch.propTypes = {
  value: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  delay: PropTypes.number,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};