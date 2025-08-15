/**
 * Error Categorization System - Comprehensive error analysis and categorization
 */

import { ErrorDetectionService, ErrorDetectionResult, CategorizedError } from './errorDetectionService';
import { TestFailureAnalyzer, TestAnalysisResult } from './testFailureAnalyzer';
import { ConsoleErrorDetector, ConsoleErrorResult } from './consoleErrorDetector';
// QualityIssue type would be imported when needed

export interface ComprehensiveErrorAnalysis {
  timestamp: number;
  codeErrors: ErrorDetectionResult;
  testErrors: TestAnalysisResult;
  runtimeErrors: ConsoleErrorResult;
  overallSummary: {
    totalIssues: number;
    criticalIssues: number;
    autoFixableIssues: number;
    testPassRate: number;
    codeQualityScore: number;
  };
  prioritizedActions: PrioritizedAction[];
  recommendations: string[];
}

export interface PrioritizedAction {
  id: string;
  title: string;
  description: string;
  category: 'critical' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  autoFixable: boolean;
  estimatedTime: string;
  steps: string[];
  relatedIssues: string[];
}

export class ErrorCategorizationSystem {
  private errorDetectionService: ErrorDetectionService;
  private testFailureAnalyzer: TestFailureAnalyzer;
  private consoleErrorDetector: ConsoleErrorDetector;

  constructor(projectRoot: string = process.cwd()) {
    this.errorDetectionService = new ErrorDetectionService(projectRoot);
    this.testFailureAnalyzer = new TestFailureAnalyzer(projectRoot);
    this.consoleErrorDetector = new ConsoleErrorDetector();
  }

  /**
   * Run comprehensive error analysis
   */
  async runComprehensiveAnalysis(): Promise<ComprehensiveErrorAnalysis> {
    console.log('🔍 Starting comprehensive error analysis...');

    // Run all analysis in parallel
    const [codeErrors, testErrors, runtimeErrors] = await Promise.all([
      this.errorDetectionService.detectAndCategorizeErrors(),
      this.testFailureAnalyzer.analyzeTestFailures(),
      Promise.resolve(this.consoleErrorDetector.getErrorAnalysis())
    ]);

    // Generate overall summary
    const overallSummary = this.generateOverallSummary(codeErrors, testErrors, runtimeErrors);

    // Generate prioritized actions
    const prioritizedActions = this.generatePrioritizedActions(codeErrors, testErrors, runtimeErrors);

    // Generate recommendations
    const recommendations = this.generateRecommendations(codeErrors, testErrors, runtimeErrors);

    return {
      timestamp: Date.now(),
      codeErrors,
      testErrors,
      runtimeErrors,
      overallSummary,
      prioritizedActions,
      recommendations
    };
  }

  /**
   * Generate overall summary
   */
  private generateOverallSummary(
    codeErrors: ErrorDetectionResult,
    testErrors: TestAnalysisResult,
    runtimeErrors: ConsoleErrorResult
  ) {
    const totalIssues = codeErrors.totalErrors + testErrors.failedTests + runtimeErrors.totalErrors;
    
    const criticalIssues = 
      codeErrors.summary.critical + 
      testErrors.summary.compilationErrors + 
      runtimeErrors.summary.critical;

    const autoFixableIssues = codeErrors.summary.autoFixable;

    const testPassRate = testErrors.totalTests > 0 
      ? (testErrors.passedTests / testErrors.totalTests) * 100 
      : 100;

    // Calculate code quality score (0-100)
    const maxPossibleIssues = 1000; // Arbitrary baseline
    const qualityScore = Math.max(0, Math.min(100, 
      100 - ((totalIssues / maxPossibleIssues) * 100)
    ));

    return {
      totalIssues,
      criticalIssues,
      autoFixableIssues,
      testPassRate: Math.round(testPassRate * 10) / 10,
      codeQualityScore: Math.round(qualityScore * 10) / 10
    };
  }

  /**
   * Generate prioritized actions
   */
  private generatePrioritizedActions(
    codeErrors: ErrorDetectionResult,
    testErrors: TestAnalysisResult,
    runtimeErrors: ConsoleErrorResult
  ): PrioritizedAction[] {
    const actions: PrioritizedAction[] = [];

    // Add code error actions
    const prioritizedCodeErrors = this.errorDetectionService.getPrioritizedErrors(codeErrors.categorizedErrors);
    actions.push(...this.createCodeErrorActions(prioritizedCodeErrors));

    // Add test error actions
    actions.push(...this.createTestErrorActions(testErrors));

    // Add runtime error actions
    actions.push(...this.createRuntimeErrorActions(runtimeErrors));

    // Sort by priority and impact
    return actions.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const impactOrder = { high: 0, medium: 1, low: 2 };
      
      if (a.category !== b.category) {
        return priorityOrder[a.category] - priorityOrder[b.category];
      }
      
      return impactOrder[a.impact] - impactOrder[b.impact];
    });
  }

  /**
   * Create actions for code errors
   */
  private createCodeErrorActions(categorizedErrors: CategorizedError[]): PrioritizedAction[] {
    const actions: PrioritizedAction[] = [];
    const errorGroups = new Map<string, CategorizedError[]>();

    // Group errors by category
    categorizedErrors.forEach(error => {
      const key = error.category.name;
      if (!errorGroups.has(key)) {
        errorGroups.set(key, []);
      }
      errorGroups.get(key)!.push(error);
    });

    // Create actions for each group
    errorGroups.forEach((errors, categoryName) => {
      const category = errors[0].category;
      const autoFixable = errors.every(e => e.issue.autoFixable);
      
      actions.push({
        id: `code-${categoryName.toLowerCase().replace(/\s+/g, '-')}`,
        title: `Fix ${categoryName} Issues`,
        description: `Resolve ${errors.length} ${categoryName.toLowerCase()} issues`,
        category: this.mapSeverityToCategory(category.severity),
        effort: autoFixable ? 'low' : 'medium',
        impact: this.mapSeverityToImpact(category.severity),
        autoFixable,
        estimatedTime: autoFixable ? '5-15 minutes' : '30-60 minutes',
        steps: this.generateCodeErrorSteps(errors, autoFixable),
        relatedIssues: errors.map(e => e.issue.id)
      });
    });

    return actions;
  }

  /**
   * Create actions for test errors
   */
  private createTestErrorActions(testErrors: TestAnalysisResult): PrioritizedAction[] {
    const actions: PrioritizedAction[] = [];

    if (testErrors.summary.compilationErrors > 0) {
      actions.push({
        id: 'test-compilation-errors',
        title: 'Fix Test Compilation Errors',
        description: `Resolve ${testErrors.summary.compilationErrors} compilation errors preventing tests from running`,
        category: 'critical',
        effort: 'high',
        impact: 'high',
        autoFixable: false,
        estimatedTime: '1-2 hours',
        steps: [
          'Review TypeScript compilation errors in test files',
          'Fix import statements and type definitions',
          'Update test configuration if needed',
          'Verify all dependencies are properly installed'
        ],
        relatedIssues: testErrors.failures.map(f => f.id)
      });
    }

    if (testErrors.failedTests > 0) {
      actions.push({
        id: 'test-failures',
        title: 'Fix Failing Tests',
        description: `Fix ${testErrors.failedTests} failing tests to improve test coverage`,
        category: 'high',
        effort: 'medium',
        impact: 'medium',
        autoFixable: false,
        estimatedTime: '2-4 hours',
        steps: [
          'Review failing test cases',
          'Update test expectations if needed',
          'Fix component implementations',
          'Add missing mocks or setup'
        ],
        relatedIssues: testErrors.failures.map(f => f.id)
      });
    }

    return actions;
  }

  /**
   * Create actions for runtime errors
   */
  private createRuntimeErrorActions(runtimeErrors: ConsoleErrorResult): PrioritizedAction[] {
    const actions: PrioritizedAction[] = [];

    if (runtimeErrors.summary.critical > 0) {
      actions.push({
        id: 'runtime-critical-errors',
        title: 'Fix Critical Runtime Errors',
        description: `Resolve ${runtimeErrors.summary.critical} critical runtime errors`,
        category: 'critical',
        effort: 'high',
        impact: 'high',
        autoFixable: false,
        estimatedTime: '1-3 hours',
        steps: [
          'Review console error logs',
          'Fix syntax and parsing errors',
          'Add proper error handling',
          'Test in browser environment'
        ],
        relatedIssues: runtimeErrors.errors.map(e => e.id)
      });
    }

    return actions;
  }

  /**
   * Generate code error fix steps
   */
  private generateCodeErrorSteps(errors: CategorizedError[], autoFixable: boolean): string[] {
    if (autoFixable) {
      return [
        'Run automated fix tools',
        'Review changes before committing',
        'Run tests to verify fixes',
        'Commit changes'
      ];
    }

    const category = errors[0].category.name;
    switch (category) {
      case 'Missing Module':
        return [
          'Review import statements',
          'Check file paths and module names',
          'Install missing dependencies',
          'Update import paths'
        ];
      case 'Type Mismatch':
        return [
          'Review type definitions',
          'Add proper type assertions',
          'Update interface definitions',
          'Fix parameter types'
        ];
      case 'Missing Property':
        return [
          'Review object interfaces',
          'Add missing properties',
          'Update method signatures',
          'Check API responses'
        ];
      default:
        return [
          'Review error messages',
          'Apply appropriate fixes',
          'Test changes',
          'Update documentation if needed'
        ];
    }
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    codeErrors: ErrorDetectionResult,
    testErrors: TestAnalysisResult,
    runtimeErrors: ConsoleErrorResult
  ): string[] {
    const recommendations: string[] = [];

    // Code quality recommendations
    if (codeErrors.summary.autoFixable > 0) {
      recommendations.push(
        `🔧 **Quick Win**: ${codeErrors.summary.autoFixable} issues can be auto-fixed. Run automated fixes first.`
      );
    }

    if (codeErrors.summary.critical > 0) {
      recommendations.push(
        `🚨 **Critical**: Address ${codeErrors.summary.critical} critical compilation errors immediately.`
      );
    }

    // Test recommendations
    if (testErrors.totalTests === 0) {
      recommendations.push(
        `🧪 **Testing**: No tests detected. Consider adding unit tests for better code quality.`
      );
    } else if (testErrors.passedTests / testErrors.totalTests < 0.8) {
      recommendations.push(
        `🧪 **Test Quality**: Test pass rate is ${Math.round((testErrors.passedTests / testErrors.totalTests) * 100)}%. Aim for >90%.`
      );
    }

    // Runtime error recommendations
    if (runtimeErrors.summary.critical > 0) {
      recommendations.push(
        `⚡ **Runtime**: ${runtimeErrors.summary.critical} critical runtime errors detected. Test in browser.`
      );
    }

    // General recommendations
    const totalIssues = codeErrors.totalErrors + testErrors.failedTests + runtimeErrors.totalErrors;
    if (totalIssues > 100) {
      recommendations.push(
        `📊 **Strategy**: ${totalIssues} total issues detected. Focus on auto-fixable issues first, then critical errors.`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ **Great Job**: Code quality looks good! Consider adding more tests and documentation.');
    }

    return recommendations;
  }

  /**
   * Map severity to category
   */
  private mapSeverityToCategory(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  /**
   * Map severity to impact
   */
  private mapSeverityToImpact(severity: string): 'high' | 'medium' | 'low' {
    switch (severity) {
      case 'critical': return 'high';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  /**
   * Generate comprehensive report
   */
  generateComprehensiveReport(analysis: ComprehensiveErrorAnalysis): string {
    const { overallSummary, prioritizedActions, recommendations } = analysis;
    
    let report = `
# Comprehensive Code Quality Analysis Report

## Executive Summary
- **Total Issues**: ${overallSummary.totalIssues}
- **Critical Issues**: ${overallSummary.criticalIssues}
- **Auto-fixable Issues**: ${overallSummary.autoFixableIssues}
- **Test Pass Rate**: ${overallSummary.testPassRate}%
- **Code Quality Score**: ${overallSummary.codeQualityScore}/100

## Key Recommendations
${recommendations.map(rec => `- ${rec}`).join('\n')}

## Prioritized Action Plan
`;

    prioritizedActions.slice(0, 10).forEach((action, index) => {
      const priority = action.category.toUpperCase();
      const effort = action.effort.charAt(0).toUpperCase() + action.effort.slice(1);
      const impact = action.impact.charAt(0).toUpperCase() + action.impact.slice(1);
      
      report += `
### ${index + 1}. ${action.title}
- **Priority**: ${priority}
- **Effort**: ${effort} | **Impact**: ${impact} | **Time**: ${action.estimatedTime}
- **Auto-fixable**: ${action.autoFixable ? 'Yes' : 'No'}
- **Description**: ${action.description}

**Steps:**
${action.steps.map(step => `  1. ${step}`).join('\n')}
`;
    });

    return report;
  }
}

export const errorCategorizationSystem = new ErrorCategorizationSystem();