/**
 * Test Failure Analyzer - Analyze and categorize test failures
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TestFailure {
  id: string;
  testFile: string;
  testName: string;
  errorMessage: string;
  errorType: string;
  stackTrace?: string;
  category: TestFailureCategory;
  fixSuggestion?: string;
}

export interface TestFailureCategory {
  name: string;
  description: string;
  commonCauses: string[];
  fixStrategies: string[];
}

export interface TestAnalysisResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testFiles: number;
  failedFiles: number;
  failures: TestFailure[];
  categories: Record<string, TestFailureCategory>;
  summary: {
    compilationErrors: number;
    runtimeErrors: number;
    assertionErrors: number;
    configurationErrors: number;
  };
}

export class TestFailureAnalyzer {
  private projectRoot: string;
  private failureCategories: Map<string, TestFailureCategory> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.initializeFailureCategories();
  }

  /**
   * Analyze test failures
   */
  async analyzeTestFailures(): Promise<TestAnalysisResult> {
    console.log('🧪 Analyzing test failures...');

    try {
      // Run tests and capture output
      const testOutput = await this.runTests();
      
      // Parse test results
      const testResults = this.parseTestOutput(testOutput);
      
      // Analyze failures
      const failures = this.analyzeFailures(testOutput);
      
      // Generate summary
      const summary = this.generateFailureSummary(failures);

      return {
        ...testResults,
        failures,
        categories: Object.fromEntries(this.failureCategories),
        summary
      };

    } catch (error: unknown) {
      console.error('Test analysis failed:', (error as Error)?.message || String(error));
      return this.createEmptyResult();
    }
  }

  /**
   * Run tests and capture output
   */
  private async runTests(): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync('npm test', { 
        cwd: this.projectRoot,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });
      return stdout + stderr;
    } catch (error: unknown) {
      // Tests may fail, but we still want the output
      return ((error as { stdout?: string; stderr?: string })?.stdout || '') + ((error as { stdout?: string; stderr?: string })?.stderr || '');
    }
  }

  /**
   * Parse test output to extract basic metrics
   */
  private parseTestOutput(output: string): Omit<TestAnalysisResult, 'failures' | 'categories' | 'summary'> {
    const results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testFiles: 0,
      failedFiles: 0
    };

    // Parse Vitest output patterns
    const testMatch = output.match(/Tests\s+(\d+)\s+passed/);
    if (testMatch) {
      results.passedTests = parseInt(testMatch[1]);
    }

    const failMatch = output.match(/(\d+)\s+failed/);
    if (failMatch) {
      results.failedTests = parseInt(failMatch[1]);
    }

    const fileMatch = output.match(/Test Files\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed/);
    if (fileMatch) {
      results.failedFiles = parseInt(fileMatch[1] || '0');
      results.testFiles = parseInt(fileMatch[2]) + results.failedFiles;
    }

    results.totalTests = results.passedTests + results.failedTests;

    return results;
  }

  /**
   * Analyze test failures from output
   */
  private analyzeFailures(output: string): TestFailure[] {
    const failures: TestFailure[] = [];
    
    // Look for compilation errors first
    const compilationErrors = this.extractCompilationErrors(output);
    failures.push(...compilationErrors);

    // Look for test failures
    const testFailures = this.extractTestFailures(output);
    failures.push(...testFailures);

    return failures;
  }

  /**
   * Extract compilation errors from test output
   */
  private extractCompilationErrors(output: string): TestFailure[] {
    const failures: TestFailure[] = [];
    const lines = output.split('\n');

    let currentError: Partial<TestFailure> | null = null;
    let inErrorSection = false;

    for (const line of lines) {
      // Check for compilation error patterns
      if (line.includes('Transform failed') || line.includes('ERROR:')) {
        inErrorSection = true;
        currentError = {
          id: `compilation-${Date.now()}-${Math.random()}`,
          errorType: 'compilation',
          category: this.failureCategories.get('compilation')!
        };
      }

      // Extract file information
      if (inErrorSection && line.includes('.tsx') || line.includes('.ts')) {
        const fileMatch = line.match(/([^/\s]+\.tsx?)/);
        if (fileMatch && currentError) {
          currentError.testFile = fileMatch[1];
        }
      }

      // Extract error message
      if (inErrorSection && line.includes('ERROR:')) {
        const errorMatch = line.match(/ERROR:\s*(.+)/);
        if (errorMatch && currentError) {
          currentError.errorMessage = errorMatch[1];
          currentError.testName = 'Compilation Error';
        }
      }

      // End of error section
      if (inErrorSection && line.trim() === '') {
        if (currentError && currentError.errorMessage) {
          failures.push(currentError as TestFailure);
        }
        currentError = null;
        inErrorSection = false;
      }
    }

    return failures;
  }

  /**
   * Extract test failures from output
   */
  private extractTestFailures(_output: string): TestFailure[] {
    const failures: TestFailure[] = [];
    
    // This is a simplified implementation
    // In a real scenario, you'd parse the specific test runner output format
    
    return failures;
  }

  /**
   * Generate failure summary
   */
  private generateFailureSummary(failures: TestFailure[]) {
    const summary = {
      compilationErrors: 0,
      runtimeErrors: 0,
      assertionErrors: 0,
      configurationErrors: 0
    };

    failures.forEach(failure => {
      switch (failure.category.name) {
        case 'Compilation Error':
          summary.compilationErrors++;
          break;
        case 'Runtime Error':
          summary.runtimeErrors++;
          break;
        case 'Assertion Error':
          summary.assertionErrors++;
          break;
        case 'Configuration Error':
          summary.configurationErrors++;
          break;
      }
    });

    return summary;
  }

  /**
   * Create empty result for error cases
   */
  private createEmptyResult(): TestAnalysisResult {
    return {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testFiles: 0,
      failedFiles: 0,
      failures: [],
      categories: Object.fromEntries(this.failureCategories),
      summary: {
        compilationErrors: 0,
        runtimeErrors: 0,
        assertionErrors: 0,
        configurationErrors: 0
      }
    };
  }

  /**
   * Initialize failure categories
   */
  private initializeFailureCategories() {
    const categories: [string, TestFailureCategory][] = [
      ['compilation', {
        name: 'Compilation Error',
        description: 'TypeScript compilation errors preventing tests from running',
        commonCauses: [
          'Syntax errors in test files',
          'Type errors in components being tested',
          'Missing imports or dependencies',
          'Configuration issues'
        ],
        fixStrategies: [
          'Fix TypeScript compilation errors first',
          'Check import statements',
          'Verify type definitions',
          'Update test configuration'
        ]
      }],
      ['runtime', {
        name: 'Runtime Error',
        description: 'Errors that occur during test execution',
        commonCauses: [
          'Undefined variables or functions',
          'Missing mock implementations',
          'Async operation issues',
          'DOM manipulation errors'
        ],
        fixStrategies: [
          'Add proper mocking',
          'Handle async operations correctly',
          'Check variable initialization',
          'Verify DOM setup'
        ]
      }],
      ['assertion', {
        name: 'Assertion Error',
        description: 'Test assertions that fail',
        commonCauses: [
          'Incorrect expected values',
          'Component behavior changes',
          'Timing issues with async operations',
          'State management issues'
        ],
        fixStrategies: [
          'Update expected values',
          'Fix component implementation',
          'Add proper async handling',
          'Check state management logic'
        ]
      }],
      ['configuration', {
        name: 'Configuration Error',
        description: 'Test setup and configuration issues',
        commonCauses: [
          'Missing test setup files',
          'Incorrect test environment configuration',
          'Missing dependencies',
          'Path resolution issues'
        ],
        fixStrategies: [
          'Check test configuration files',
          'Verify test environment setup',
          'Install missing dependencies',
          'Fix path mappings'
        ]
      }]
    ];

    categories.forEach(([key, category]) => {
      this.failureCategories.set(key, category);
    });
  }

  /**
   * Generate detailed test report
   */
  generateTestReport(result: TestAnalysisResult): string {
    const { totalTests, passedTests, failedTests, testFiles, failedFiles, failures, summary } = result;
    
    let report = `
# Test Analysis Report

## Test Summary
- **Total Tests**: ${totalTests}
- **Passed**: ${passedTests}
- **Failed**: ${failedTests}
- **Test Files**: ${testFiles}
- **Failed Files**: ${failedFiles}
- **Pass Rate**: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0}%

## Failure Summary
- **Compilation Errors**: ${summary.compilationErrors}
- **Runtime Errors**: ${summary.runtimeErrors}
- **Assertion Errors**: ${summary.assertionErrors}
- **Configuration Errors**: ${summary.configurationErrors}
`;

    if (failures.length > 0) {
      report += `
## Detailed Failures

`;
      failures.forEach((failure, index) => {
        report += `### ${index + 1}. ${failure.testName || 'Unknown Test'}
- **File**: ${failure.testFile || 'Unknown'}
- **Type**: ${failure.errorType}
- **Category**: ${failure.category.name}
- **Error**: ${failure.errorMessage}
`;
        if (failure.fixSuggestion) {
          report += `- **Fix Suggestion**: ${failure.fixSuggestion}\n`;
        }
        report += '\n';
      });
    }

    return report;
  }

  /**
   * Get recommended fixes for test failures
   */
  getRecommendedFixes(failures: TestFailure[]): string[] {
    const fixes: string[] = [];
    const categoryCounts = new Map<string, number>();

    // Count failures by category
    failures.forEach(failure => {
      const category = failure.category.name;
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    });

    // Generate recommendations based on most common issues
    const sortedCategories = Array.from(categoryCounts.entries())
      .sort(([, a], [, b]) => b - a);

    sortedCategories.forEach(([categoryName, count]) => {
      const category = this.failureCategories.get(categoryName.toLowerCase());
      if (category) {
        fixes.push(`**${categoryName}** (${count} issues):`);
        category.fixStrategies.forEach(strategy => {
          fixes.push(`  - ${strategy}`);
        });
        fixes.push('');
      }
    });

    return fixes;
  }
}

export const testFailureAnalyzer = new TestFailureAnalyzer();