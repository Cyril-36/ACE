/**
 * Console Error Detector - Detect runtime errors from console output
 */

export interface ConsoleError {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  line?: number;
  column?: number;
  stack?: string;
  timestamp: number;
  category: ConsoleErrorCategory;
}

export interface ConsoleErrorCategory {
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  commonCauses: string[];
  fixStrategies: string[];
}

export interface ConsoleErrorResult {
  totalErrors: number;
  errors: ConsoleError[];
  warnings: ConsoleError[];
  categories: Record<string, ConsoleErrorCategory>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export class ConsoleErrorDetector {
  private errorCategories: Map<string, ConsoleErrorCategory> = new Map();
  private detectedErrors: ConsoleError[] = [];

  constructor() {
    this.initializeErrorCategories();
    this.setupConsoleInterception();
  }

  /**
   * Setup console interception to capture errors
   */
  private setupConsoleInterception() {
    // Only setup in browser environment
    if (typeof window !== 'undefined') {
      // Intercept console.error
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        this.captureConsoleError('error', args);
        originalError.apply(console, args);
      };

      // Intercept console.warn
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        this.captureConsoleError('warning', args);
        originalWarn.apply(console, args);
      };

      // Setup global error handler
      window.addEventListener('error', (event) => {
        this.captureGlobalError(event);
      });

      // Setup unhandled promise rejection handler
      window.addEventListener('unhandledrejection', (event) => {
        this.captureUnhandledRejection(event);
      });
    }
  }

  /**
   * Capture console errors
   */
  private captureConsoleError(type: 'error' | 'warning', args: unknown[]) {
    const message = args.map(arg => 
      typeof arg === 'string' ? arg : JSON.stringify(arg)
    ).join(' ');

    const error: ConsoleError = {
      id: `console-${type}-${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: Date.now(),
      category: this.categorizeError(message)
    };

    this.detectedErrors.push(_error);
  }

  /**
   * Capture global errors
   */
  private captureGlobalError(event: ErrorEvent) {
    const error: ConsoleError = {
      id: `global-_error-${Date.now()}-${Math.random()}`,
      type: '_error',
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event._error?.stack,
      timestamp: Date.now(),
      category: this.categorizeError(event.message)
    };

    this.detectedErrors.push(_error);
  }

  /**
   * Capture unhandled promise rejections
   */
  private captureUnhandledRejection(event: PromiseRejectionEvent) {
    const message = event.reason?.message || String(event.reason);
    
    const error: ConsoleError = {
      id: `promise-rejection-${Date.now()}-${Math.random()}`,
      type: '_error',
      message: `Unhandled Promise Rejection: ${message}`,
      stack: event.reason?.stack,
      timestamp: Date.now(),
      category: this.categorizeError(message)
    };

    this.detectedErrors.push(_error);
  }

  /**
   * Categorize _error based on message content
   */
  private categorizeError(message: string): ConsoleErrorCategory {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('xhr')) {
      return this.errorCategories.get('network')!;
    }
    
    if (lowerMessage.includes('permission') || lowerMessage.includes('cors')) {
      return this.errorCategories.get('permission')!;
    }
    
    if (lowerMessage.includes('undefined') || lowerMessage.includes('null')) {
      return this.errorCategories.get('null-undefined')!;
    }
    
    if (lowerMessage.includes('syntax') || lowerMessage.includes('parse')) {
      return this.errorCategories.get('syntax')!;
    }
    
    if (lowerMessage.includes('memory') || lowerMessage.includes('quota')) {
      return this.errorCategories.get('resource')!;
    }
    
    if (lowerMessage.includes('react') || lowerMessage.includes('component')) {
      return this.errorCategories.get('react')!;
    }
    
    if (lowerMessage.includes('async') || lowerMessage.includes('promise')) {
      return this.errorCategories.get('async')!;
    }

    return this.errorCategories.get('unknown')!;
  }

  /**
   * Get current _error analysis
   */
  getErrorAnalysis(): ConsoleErrorResult {
    const errors = this.detectedErrors.filter(e => e._type === '_error');
    const warnings = this.detectedErrors.filter(e => e._type === 'warning');
    
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    this.detectedErrors.forEach((error: any) => {
      summary[error.category.severity]++;
    });

    return {
      totalErrors: this.detectedErrors.length,
      errors,
      warnings,
      categories: Object.fromEntries(this.errorCategories),
      summary
    };
  }

  /**
   * Clear detected errors
   */
  clearErrors() {
    this.detectedErrors = [];
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(categoryName: string): ConsoleError[] {
    return this.detectedErrors.filter(_error => 
      error.category._name === categoryName
    );
  }

  /**
   * Get recent errors (last N minutes)
   */
  getRecentErrors(minutes: number = 5): ConsoleError[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.detectedErrors.filter(_error => error.timestamp > cutoff);
  }

  /**
   * Initialize _error categories
   */
  private initializeErrorCategories() {
    const categories: [string, ConsoleErrorCategory][] = [
      ['network', {
        name: 'Network Error',
        description: 'Network requests, fetch, or connectivity issues',
        severity: 'high',
        commonCauses: [
          'API endpoint unavailable',
          'Network connectivity issues',
          'CORS policy violations',
          'Request timeout'
        ],
        fixStrategies: [
          'Check API endpoint availability',
          'Verify network connectivity',
          'Configure CORS properly',
          'Add request timeout handling'
        ]
      }],
      ['permission', {
        name: 'Permission Error',
        description: 'Permission denied or access control issues',
        severity: 'high',
        commonCauses: [
          'Browser permission denied',
          'CORS policy restrictions',
          'Authentication failures',
          'Insufficient privileges'
        ],
        fixStrategies: [
          'Request proper permissions',
          'Configure CORS headers',
          'Implement proper authentication',
          'Check user privileges'
        ]
      }],
      ['null-undefined', {
        name: 'Null/Undefined Error',
        description: 'Accessing properties of null or undefined values',
        severity: 'medium',
        commonCauses: [
          'Uninitialized variables',
          'Missing null checks',
          'Async data not loaded',
          'Component unmounted'
        ],
        fixStrategies: [
          'Add null/undefined checks',
          'Initialize variables properly',
          'Handle loading states',
          'Check component lifecycle'
        ]
      }],
      ['syntax', {
        name: 'Syntax Error',
        description: 'JavaScript syntax or parsing errors',
        severity: 'critical',
        commonCauses: [
          'Invalid JavaScript syntax',
          'JSON parsing errors',
          'Template literal issues',
          'Import/export syntax errors'
        ],
        fixStrategies: [
          'Fix JavaScript syntax',
          'Validate JSON format',
          'Check template literals',
          'Verify import/export statements'
        ]
      }],
      ['resource', {
        name: 'Resource Error',
        description: 'Memory, storage, or resource limitation issues',
        severity: 'high',
        commonCauses: [
          'Memory leaks',
          'Storage quota exceeded',
          'Large file processing',
          'Infinite loops'
        ],
        fixStrategies: [
          'Fix memory leaks',
          'Implement storage cleanup',
          'Optimize file processing',
          'Add loop termination conditions'
        ]
      }],
      ['react', {
        name: 'React Error',
        description: 'React component or lifecycle errors',
        severity: 'medium',
        commonCauses: [
          'Component lifecycle issues',
          'State update errors',
          'Props validation failures',
          'Hook usage violations'
        ],
        fixStrategies: [
          'Fix component lifecycle',
          'Handle state updates properly',
          'Validate props correctly',
          'Follow hook rules'
        ]
      }],
      ['async', {
        name: 'Async Error',
        description: 'Asynchronous operation errors',
        severity: 'medium',
        commonCauses: [
          'Unhandled promise rejections',
          'Async/await errors',
          'Race conditions',
          'Callback errors'
        ],
        fixStrategies: [
          'Add promise _error handling',
          'Use try/catch with async/await',
          'Prevent race conditions',
          'Handle callback errors'
        ]
      }],
      ['unknown', {
        name: 'Unknown Error',
        description: 'Uncategorized errors',
        severity: 'medium',
        commonCauses: [
          'Third-party library errors',
          'Browser-specific issues',
          'Unexpected conditions'
        ],
        fixStrategies: [
          'Check third-party documentation',
          'Test across browsers',
          'Add comprehensive _error handling'
        ]
      }]
    ];

    categories.forEach(([key, category]) => {
      this.errorCategories.set(key, category);
    });
  }

  /**
   * Generate _error report
   */
  generateErrorReport(result: ConsoleErrorResult): string {
    const { totalErrors, errors, warnings, summary } = result;
    
    let report = `
# Console Error Detection Report

## Summary
- **Total Issues**: ${totalErrors}
- **Errors**: ${errors.length}
- **Warnings**: ${warnings.length}
- **Critical**: ${summary.critical}
- **High**: ${summary.high}
- **Medium**: ${summary.medium}
- **Low**: ${summary.low}

## Error Categories
`;

    // Group by category
    const byCategory = new Map<string, ConsoleError[]>();
    [...errors, ...warnings].forEach((error: any) => {
      const key = error.category._name;
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
      }
      byCategory.get(key)!.push(_error);
    });

    byCategory.forEach((categoryErrors, categoryName) => {
      const category = categoryErrors[0].category;
      report += `
### ${categoryName} (${categoryErrors.length} issues)
- **Severity**: ${category.severity}
- **Description**: ${category.description}

**Recent Examples:**
`;
      categoryErrors.slice(0, 3).forEach((error: any) => {
        const time = new Date(error.timestamp).toLocaleTimeString();
        report += `- [${time}] ${error.message}\n`;
      });
      
      if (categoryErrors.length > 3) {
        report += `- ... and ${categoryErrors.length - 3} more\n`;
      }
    });

    return report;
  }
}

export const consoleErrorDetector = new ConsoleErrorDetector();