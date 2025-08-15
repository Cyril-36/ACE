/**
 * Error Detection Service - Automated error detection and categorization
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { QualityIssue } from './codeQualityPipeline';

const execAsync = promisify(exec);

export interface ErrorCategory {
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  autoFixable: boolean;
  priority: number;
}

export interface CategorizedError {
  issue: QualityIssue;
  category: ErrorCategory;
  fixStrategy?: string;
  relatedErrors?: string[];
}

export interface ErrorDetectionResult {
  totalErrors: number;
  categorizedErrors: CategorizedError[];
  categories: Record<string, ErrorCategory>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    autoFixable: number;
  };
}

export class ErrorDetectionService {
  private projectRoot: string;
  private errorCategories: Map<string, ErrorCategory> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.initializeErrorCategories();
  }

  /**
   * Run comprehensive error detection and categorization
   */
  async detectAndCategorizeErrors(): Promise<ErrorDetectionResult> {
    console.log('🔍 Starting comprehensive error detection...');

    // Run TypeScript compilation to get errors
    const tsErrors = await this.detectTypeScriptErrors();
    console.log(`📝 Found ${tsErrors.length} TypeScript errors`);

    // Run ESLint to get linting issues
    const eslintErrors = await this.detectESLintErrors();
    console.log(`🔧 Found ${eslintErrors.length} ESLint issues`);

    // Combine all errors
    const allErrors = [...tsErrors, ...eslintErrors];

    // Categorize errors
    const categorizedErrors = this.categorizeErrors(allErrors);

    // Generate summary
    const summary = this.generateSummary(categorizedErrors);

    return {
      totalErrors: allErrors.length,
      categorizedErrors,
      categories: Object.fromEntries(this.errorCategories),
      summary
    };
  }

  /**
   * Detect TypeScript compilation errors
   */
  private async detectTypeScriptErrors(): Promise<QualityIssue[]> {
    try {
      await execAsync('npx tsc --noEmit', { cwd: this.projectRoot });
      return []; // No errors
    } catch (error: unknown) {
      const output = (error as { stderr?: string; stdout?: string })?.stderr || (error as { stderr?: string; stdout?: string })?.stdout || '';
      return this.parseTypeScriptOutput(output);
    }
  }

  /**
   * Detect ESLint errors
   */
  private async detectESLintErrors(): Promise<QualityIssue[]> {
    try {
      const { stdout } = await execAsync('npx eslint src --ext .ts,.tsx --format json', { 
        cwd: this.projectRoot 
      });
      return this.parseESLintOutput(stdout);
    } catch (error: unknown) {
      if ((error as { stdout?: string })?.stdout) {
        return this.parseESLintOutput((error as { stdout: string }).stdout);
      }
      console.warn('ESLint detection failed:', (error as Error)?.message || String(error));
      return [];
    }
  }

  /**
   * Parse TypeScript compiler output
   */
  private parseTypeScriptOutput(output: string): QualityIssue[] {
    const errors: QualityIssue[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/);
      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;
        
        errors.push({
          id: `ts-${code}-${file}-${lineNum}-${colNum}`,
          type: 'typescript',
          severity: severity as 'error' | 'warning',
          file: file.replace(this.projectRoot + '/', ''),
          line: parseInt(lineNum),
          column: parseInt(colNum),
          message: message.trim(),
          rule: code,
          fixable: this.isTypeScriptFixable(code),
          autoFixable: this.isTypeScriptAutoFixable(code),
          category: 'compilation'
        });
      }
    }

    return errors;
  }

  /**
   * Parse ESLint JSON output
   */
  private parseESLintOutput(output: string): QualityIssue[] {
    const errors: QualityIssue[] = [];

    try {
      const results = JSON.parse(output);
      
      for (const result of results) {
        for (const message of result.messages) {
          errors.push({
            id: `eslint-${message.ruleId}-${result.filePath}-${message.line}-${message.column}`,
            type: 'eslint',
            severity: message.severity === 2 ? 'error' : 'warning',
            file: result.filePath.replace(this.projectRoot + '/', ''),
            line: message.line,
            column: message.column,
            message: message.message,
            rule: message.ruleId || 'unknown',
            fixable: message.fix !== undefined,
            autoFixable: message.fix !== undefined,
            category: 'linting'
          });
        }
      }
    } catch (error) {
      console.warn('Failed to parse ESLint output:', error);
    }

    return errors;
  }

  /**
   * Categorize errors by type and priority
   */
  private categorizeErrors(errors: QualityIssue[]): CategorizedError[] {
    return errors.map((error: any) => {
      const category = this.getErrorCategory(error);
      const fixStrategy = this.getFixStrategy(error);
      const relatedErrors = this.findRelatedErrors(error, errors);

      return {
        issue: error,
        category,
        fixStrategy,
        relatedErrors
      };
    });
  }

  /**
   * Get error category for an issue
   */
  private getErrorCategory(error: QualityIssue): ErrorCategory {
    // TypeScript error categories
    if (error._type === 'typescript') {
      if (error.rule.startsWith('TS6133') || error.rule.startsWith('TS6196')) {
        return this.errorCategories.get('unused-code')!;
      }
      if (error.rule.startsWith('TS2393')) {
        return this.errorCategories.get('duplicate-implementation')!;
      }
      if (error.rule.startsWith('TS2451')) {
        return this.errorCategories.get('duplicate-declaration')!;
      }
      if (error.rule.startsWith('TS2305') || error.rule.startsWith('TS2307')) {
        return this.errorCategories.get('missing-module')!;
      }
      if (error.rule.startsWith('TS2322') || error.rule.startsWith('TS2345')) {
        return this.errorCategories.get('type-mismatch')!;
      }
      if (error.rule.startsWith('TS2339') || error.rule.startsWith('TS2551')) {
        return this.errorCategories.get('missing-property')!;
      }
      if (error.rule.startsWith('TS2503')) {
        return this.errorCategories.get('namespace-issue')!;
      }
      if (error.rule.startsWith('TS1205')) {
        return this.errorCategories.get('export-issue')!;
      }
      return this.errorCategories.get('typescript-other')!;
    }

    // ESLint error categories
    if (error._type === 'eslint') {
      return this.errorCategories.get('linting')!;
    }

    return this.errorCategories.get('unknown')!;
  }

  /**
   * Get fix strategy for an error
   */
  private getFixStrategy(error: QualityIssue): string {
    if (error.rule.startsWith('TS6133') || error.rule.startsWith('TS6196')) {
      return 'Remove unused variable/import';
    }
    if (error.rule.startsWith('TS2393')) {
      return 'Remove duplicate function implementation';
    }
    if (error.rule.startsWith('TS2451')) {
      return 'Remove duplicate variable declaration';
    }
    if (error.rule.startsWith('TS2305') || error.rule.startsWith('TS2307')) {
      return 'Add missing module or fix import path';
    }
    if (error.rule.startsWith('TS2322') || error.rule.startsWith('TS2345')) {
      return 'Fix type mismatch or add type assertion';
    }
    if (error.rule.startsWith('TS2339') || error.rule.startsWith('TS2551')) {
      return 'Add missing property or fix property name';
    }
    if (error.rule.startsWith('TS2503')) {
      return 'Add missing namespace import';
    }
    if (error.rule.startsWith('TS1205')) {
      return 'Fix export statement for isolated modules';
    }
    
    return 'Manual review required';
  }

  /**
   * Find related errors that might be caused by the same root issue
   */
  private findRelatedErrors(error: QualityIssue, allErrors: QualityIssue[]): string[] {
    const related: string[] = [];

    // Find errors in the same file
    const sameFileErrors = allErrors.filter(e => 
      e.file === error.file && e.id !== error.id
    );

    // Find errors with similar messages or rules
    const similarErrors = allErrors.filter(e => 
      e.rule === error.rule && e.id !== error.id
    );

    // Add related error IDs
    sameFileErrors.slice(0, 3).forEach(e => related.push(e.id));
    similarErrors.slice(0, 2).forEach((e: any) => {
      if (!related.includes(e.id)) {
        related.push(e.id);
      }
    });

    return related;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(categorizedErrors: CategorizedError[]) {
    const summary = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      autoFixable: 0
    };

    categorizedErrors.forEach(({ issue, category }) => {
      summary[category.severity]++;
      if (issue.autoFixable) {
        summary.autoFixable++;
      }
    });

    return summary;
  }

  /**
   * Initialize error categories
   */
  private initializeErrorCategories() {
    const categories: [string, ErrorCategory][] = [
      ['unused-code', {
        name: 'Unused Code',
        description: 'Unused variables, imports, or parameters',
        severity: 'low',
        autoFixable: true,
        priority: 1
      }],
      ['duplicate-implementation', {
        name: 'Duplicate Implementation',
        description: 'Duplicate function or method implementations',
        severity: 'high',
        autoFixable: true,
        priority: 2
      }],
      ['duplicate-declaration', {
        name: 'Duplicate Declaration',
        description: 'Duplicate variable or constant declarations',
        severity: 'high',
        autoFixable: true,
        priority: 3
      }],
      ['missing-module', {
        name: 'Missing Module',
        description: 'Missing module imports or incorrect paths',
        severity: 'critical',
        autoFixable: false,
        priority: 4
      }],
      ['type-mismatch', {
        name: 'Type Mismatch',
        description: 'Type assignment or parameter type mismatches',
        severity: 'medium',
        autoFixable: false,
        priority: 5
      }],
      ['missing-property', {
        name: 'Missing Property',
        description: 'Missing properties or methods on objects',
        severity: 'medium',
        autoFixable: false,
        priority: 6
      }],
      ['namespace-issue', {
        name: 'Namespace Issue',
        description: 'Missing namespace imports (e.g., vi for Vitest)',
        severity: 'medium',
        autoFixable: true,
        priority: 7
      }],
      ['export-issue', {
        name: 'Export Issue',
        description: 'Export statement issues in isolated modules',
        severity: 'medium',
        autoFixable: true,
        priority: 8
      }],
      ['typescript-other', {
        name: 'Other TypeScript',
        description: 'Other TypeScript compilation issues',
        severity: 'medium',
        autoFixable: false,
        priority: 9
      }],
      ['linting', {
        name: 'Linting Issues',
        description: 'ESLint code style and quality issues',
        severity: 'low',
        autoFixable: true,
        priority: 10
      }],
      ['unknown', {
        name: 'Unknown',
        description: 'Uncategorized issues',
        severity: 'medium',
        autoFixable: false,
        priority: 11
      }]
    ];

    categories.forEach(([key, category]) => {
      this.errorCategories.set(key, category);
    });
  }

  /**
   * Check if TypeScript error is fixable
   */
  private isTypeScriptFixable(code: string): boolean {
    const fixableCodes = [
      'TS6133', // Unused variable
      'TS6196', // Unused import
      'TS6192', // All imports unused
      'TS2393', // Duplicate implementation
      'TS2451', // Duplicate declaration
      'TS1205', // Re-export type issue
      'TS2503', // Cannot find namespace
    ];
    
    return fixableCodes.some(fixable => code.startsWith(fixable));
  }

  /**
   * Check if TypeScript error is auto-fixable
   */
  private isTypeScriptAutoFixable(code: string): boolean {
    const autoFixableCodes = [
      'TS6133', // Unused variable
      'TS6196', // Unused import
      'TS6192', // All imports unused
      'TS2393', // Duplicate implementation (can remove)
      'TS2451', // Duplicate declaration (can remove)
      'TS1205', // Re-export type issue
    ];
    
    return autoFixableCodes.some(fixable => code.startsWith(fixable));
  }

  /**
   * Get prioritized list of errors to fix first
   */
  getPrioritizedErrors(categorizedErrors: CategorizedError[]): CategorizedError[] {
    return categorizedErrors.sort((a, b) => {
      // First sort by auto-fixable (auto-fixable first)
      if (a.issue.autoFixable && !b.issue.autoFixable) return -1;
      if (!a.issue.autoFixable && b.issue.autoFixable) return 1;
      
      // Then by priority (lower number = higher priority)
      if (a.category.priority !== b.category.priority) {
        return a.category.priority - b.category.priority;
      }
      
      // Then by severity
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.category.severity] - severityOrder[b.category.severity];
    });
  }

  /**
   * Generate detailed report
   */
  generateDetailedReport(result: ErrorDetectionResult): string {
    const { totalErrors, categorizedErrors, summary } = result;
    
    let report = `
# Code Quality Error Detection Report

## Summary
- **Total Errors**: ${totalErrors}
- **Critical**: ${summary.critical}
- **High**: ${summary.high}
- **Medium**: ${summary.medium}
- **Low**: ${summary.low}
- **Auto-fixable**: ${summary.autoFixable}

## Error Categories
`;

    // Group by category
    const byCategory = new Map<string, CategorizedError[]>();
    categorizedErrors.forEach((error: any) => {
      const key = error.category._name;
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
      }
      byCategory.get(key)!.push(error);
    });

    // Sort categories by priority
    const sortedCategories = Array.from(byCategory.entries()).sort(
      ([, a], [, b]) => a[0].category.priority - b[0].category.priority
    );

    sortedCategories.forEach(([categoryName, errors]) => {
      const category = errors[0].category;
      report += `
### ${categoryName} (${errors.length} errors)
- **Severity**: ${category.severity}
- **Auto-fixable**: ${category.autoFixable ? 'Yes' : 'No'}
- **Description**: ${category.description}

**Examples:**
`;
      errors.slice(0, 3).forEach((error: any) => {
        report += `- \`${error.issue.file}:${error.issue.line}\` - ${error.issue.message}\n`;
      });
      
      if (errors.length > 3) {
        report += `- ... and ${errors.length - 3} more\n`;
      }
    });

    return report;
  }
}

export const errorDetectionService = new ErrorDetectionService();