#!/usr/bin/env node

/**
 * Run Error Analysis - Comprehensive error detection and categorization
 */

const { spawn } = require('child_process');
const { writeFile } = require('fs/promises');
const { join } = require('path');

class ErrorAnalysisRunner {
  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Run comprehensive error analysis
   */
  async run() {
    console.log('🔍 Starting Comprehensive Error Analysis...\n');

    try {
      // Step 1: TypeScript Analysis
      console.log('📝 Analyzing TypeScript compilation errors...');
      const tsResults = await this.runTypeScriptAnalysis();
      
      // Step 2: ESLint Analysis
      console.log('🔧 Analyzing ESLint issues...');
      const eslintResults = await this.runESLintAnalysis();
      
      // Step 3: Test Analysis
      console.log('🧪 Analyzing test failures...');
      const testResults = await this.runTestAnalysis();

      // Step 4: Generate comprehensive report
      console.log('📊 Generating comprehensive analysis...');
      const analysis = this.generateComprehensiveAnalysis(tsResults, eslintResults, testResults);

      // Step 5: Generate prioritized action plan
      const actionPlan = this.generateActionPlan(analysis);

      // Step 6: Save reports
      await this.saveReports(analysis, actionPlan);

      // Step 7: Display summary
      this.displaySummary(analysis);

      return analysis;

    } catch (error) {
      console.error('❌ Error analysis failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run TypeScript compilation analysis
   */
  async runTypeScriptAnalysis() {
    return new Promise((resolve) => {
      const tsc = spawn('npx', ['tsc', '--noEmit'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stderr = '';
      tsc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tsc.on('close', (code) => {
        const errors = this.parseTypeScriptOutput(stderr);
        resolve({
          success: code === 0,
          errorCount: errors.length,
          errors: errors,
          output: stderr
        });
      });
    });
  }

  /**
   * Run ESLint analysis
   */
  async runESLintAnalysis() {
    return new Promise((resolve) => {
      const eslint = spawn('npx', ['eslint', 'src', '--ext', '.ts,.tsx', '--format', 'json'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      eslint.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      eslint.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      eslint.on('close', (code) => {
        if (stderr && stderr.includes('config')) {
          resolve({
            success: false,
            errorCount: 0,
            configError: true,
            errors: [],
            output: stderr
          });
          return;
        }

        try {
          const results = stdout ? JSON.parse(stdout) : [];
          const errors = this.parseESLintOutput(results);
          
          resolve({
            success: code === 0,
            errorCount: errors.length,
            errors: errors,
            output: stdout
          });
        } catch (error) {
          resolve({
            success: false,
            errorCount: 0,
            errors: [],
            parseError: error.message,
            output: stdout || stderr
          });
        }
      });
    });
  }

  /**
   * Run test analysis
   */
  async runTestAnalysis() {
    return new Promise((resolve) => {
      const vitest = spawn('npm', ['test'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      vitest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      vitest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      vitest.on('close', (code) => {
        const output = stdout + stderr;
        const testResults = this.parseTestOutput(output);
        
        resolve({
          success: code === 0,
          ...testResults,
          output: output
        });
      });
    });
  }

  /**
   * Parse TypeScript compiler output
   */
  parseTypeScriptOutput(output) {
    const errors = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/);
      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;
        errors.push({
          file: file.replace(this.projectRoot + '/', ''),
          line: parseInt(lineNum),
          column: parseInt(colNum),
          severity,
          code,
          message: message.trim(),
          category: this.categorizeTypeScriptError(code)
        });
      }
    }

    return errors;
  }

  /**
   * Parse ESLint JSON output
   */
  parseESLintOutput(results) {
    const errors = [];

    for (const result of results) {
      for (const message of result.messages) {
        errors.push({
          file: result.filePath.replace(this.projectRoot + '/', ''),
          line: message.line,
          column: message.column,
          severity: message.severity === 2 ? 'error' : 'warning',
          rule: message.ruleId || 'unknown',
          message: message.message,
          fixable: message.fix !== undefined
        });
      }
    }

    return errors;
  }

  /**
   * Parse test output
   */
  parseTestOutput(output) {
    const results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testFiles: 0,
      failedFiles: 0,
      failures: []
    };

    // Parse Vitest output
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

    // Extract compilation errors from test output
    if (output.includes('Transform failed')) {
      results.failures.push({
        type: 'compilation',
        message: 'Test compilation failed',
        category: 'critical'
      });
    }

    return results;
  }

  /**
   * Categorize TypeScript errors
   */
  categorizeTypeScriptError(code) {
    if (code.startsWith('TS6133') || code.startsWith('TS6196')) {
      return { name: 'Unused Code', severity: 'low', autoFixable: true };
    }
    if (code.startsWith('TS2393')) {
      return { name: 'Duplicate Implementation', severity: 'high', autoFixable: true };
    }
    if (code.startsWith('TS2451')) {
      return { name: 'Duplicate Declaration', severity: 'high', autoFixable: true };
    }
    if (code.startsWith('TS2305') || code.startsWith('TS2307')) {
      return { name: 'Missing Module', severity: 'critical', autoFixable: false };
    }
    if (code.startsWith('TS2322') || code.startsWith('TS2345')) {
      return { name: 'Type Mismatch', severity: 'medium', autoFixable: false };
    }
    return { name: 'Other', severity: 'medium', autoFixable: false };
  }

  /**
   * Generate comprehensive analysis
   */
  generateComprehensiveAnalysis(tsResults, eslintResults, testResults) {
    const totalIssues = tsResults.errorCount + eslintResults.errorCount + testResults.failedTests;
    
    // Categorize errors
    const categories = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      autoFixable: 0
    };

    // Count TypeScript errors by category
    tsResults.errors.forEach(error => {
      categories[error.category.severity]++;
      if (error.category.autoFixable) {
        categories.autoFixable++;
      }
    });

    // Count ESLint errors
    eslintResults.errors.forEach(error => {
      categories.low++;
      if (error.fixable) {
        categories.autoFixable++;
      }
    });

    // Count test failures
    if (testResults.failedTests > 0) {
      categories.high += testResults.failedTests;
    }
    if (testResults.failures.some(f => f.type === 'compilation')) {
      categories.critical++;
    }

    const testPassRate = testResults.totalTests > 0 
      ? (testResults.passedTests / testResults.totalTests) * 100 
      : 100;

    const codeQualityScore = Math.max(0, Math.min(100, 100 - (totalIssues / 10)));

    return {
      timestamp: new Date().toISOString(),
      totalIssues,
      categories,
      testPassRate: Math.round(testPassRate * 10) / 10,
      codeQualityScore: Math.round(codeQualityScore * 10) / 10,
      details: {
        typescript: tsResults,
        eslint: eslintResults,
        tests: testResults
      }
    };
  }

  /**
   * Generate action plan
   */
  generateActionPlan(analysis) {
    const actions = [];

    // Critical issues first
    if (analysis.categories.critical > 0) {
      actions.push({
        priority: 1,
        title: 'Fix Critical Compilation Errors',
        description: `Resolve ${analysis.categories.critical} critical errors preventing compilation`,
        estimatedTime: '1-2 hours',
        autoFixable: false,
        steps: [
          'Review TypeScript compilation errors',
          'Fix missing modules and imports',
          'Resolve type definition issues',
          'Test compilation success'
        ]
      });
    }

    // Auto-fixable issues
    if (analysis.categories.autoFixable > 0) {
      actions.push({
        priority: 2,
        title: 'Apply Automated Fixes',
        description: `Fix ${analysis.categories.autoFixable} auto-fixable issues`,
        estimatedTime: '15-30 minutes',
        autoFixable: true,
        steps: [
          'Run ESLint auto-fix',
          'Remove unused imports and variables',
          'Apply Prettier formatting',
          'Review and commit changes'
        ]
      });
    }

    // Test failures
    if (analysis.details.tests.failedTests > 0) {
      actions.push({
        priority: 3,
        title: 'Fix Failing Tests',
        description: `Resolve ${analysis.details.tests.failedTests} failing tests`,
        estimatedTime: '2-4 hours',
        autoFixable: false,
        steps: [
          'Review test failure messages',
          'Fix component implementations',
          'Update test expectations',
          'Verify all tests pass'
        ]
      });
    }

    // High priority issues
    if (analysis.categories.high > 0) {
      actions.push({
        priority: 4,
        title: 'Resolve High Priority Issues',
        description: `Fix ${analysis.categories.high} high priority code issues`,
        estimatedTime: '1-3 hours',
        autoFixable: false,
        steps: [
          'Review duplicate implementations',
          'Fix type mismatches',
          'Resolve property access issues',
          'Test changes thoroughly'
        ]
      });
    }

    return actions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Save reports to files
   */
  async saveReports(analysis, actionPlan) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save detailed analysis
    const analysisReport = this.generateDetailedReport(analysis);
    await writeFile(
      join(this.projectRoot, `error-analysis-${timestamp}.md`),
      analysisReport,
      'utf-8'
    );

    // Save action plan
    const actionReport = this.generateActionReport(actionPlan);
    await writeFile(
      join(this.projectRoot, `action-plan-${timestamp}.md`),
      actionReport,
      'utf-8'
    );

    console.log(`📄 Reports saved:`);
    console.log(`   - error-analysis-${timestamp}.md`);
    console.log(`   - action-plan-${timestamp}.md`);
  }

  /**
   * Generate detailed report
   */
  generateDetailedReport(analysis) {
    return `# Code Quality Error Analysis Report

Generated: ${analysis.timestamp}

## Executive Summary
- **Total Issues**: ${analysis.totalIssues}
- **Critical**: ${analysis.categories.critical}
- **High**: ${analysis.categories.high}
- **Medium**: ${analysis.categories.medium}
- **Low**: ${analysis.categories.low}
- **Auto-fixable**: ${analysis.categories.autoFixable}
- **Test Pass Rate**: ${analysis.testPassRate}%
- **Code Quality Score**: ${analysis.codeQualityScore}/100

## TypeScript Analysis
- **Total Errors**: ${analysis.details.typescript.errorCount}
- **Compilation Status**: ${analysis.details.typescript.success ? 'Success' : 'Failed'}

### Top TypeScript Issues:
${analysis.details.typescript.errors.slice(0, 10).map(error => 
  `- \`${error.file}:${error.line}\` - ${error.message}`
).join('\n')}

## ESLint Analysis
- **Total Issues**: ${analysis.details.eslint.errorCount}
- **Fixable Issues**: ${analysis.details.eslint.errors.filter(e => e.fixable).length}

## Test Analysis
- **Total Tests**: ${analysis.details.tests.totalTests}
- **Passed**: ${analysis.details.tests.passedTests}
- **Failed**: ${analysis.details.tests.failedTests}
- **Test Files**: ${analysis.details.tests.testFiles}
- **Failed Files**: ${analysis.details.tests.failedFiles}

## Recommendations
${this.generateRecommendations(analysis).map(rec => `- ${rec}`).join('\n')}
`;
  }

  /**
   * Generate action report
   */
  generateActionReport(actionPlan) {
    return `# Prioritized Action Plan

## Overview
This action plan prioritizes fixes based on impact and effort required.

${actionPlan.map((action, index) => `
## ${index + 1}. ${action.title}
- **Priority**: ${action.priority}
- **Estimated Time**: ${action.estimatedTime}
- **Auto-fixable**: ${action.autoFixable ? 'Yes' : 'No'}
- **Description**: ${action.description}

### Steps:
${action.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
`).join('\n')}
`;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.categories.autoFixable > 0) {
      recommendations.push(`🔧 **Quick Win**: ${analysis.categories.autoFixable} issues can be auto-fixed immediately`);
    }

    if (analysis.categories.critical > 0) {
      recommendations.push(`🚨 **Urgent**: ${analysis.categories.critical} critical errors must be fixed first`);
    }

    if (analysis.testPassRate < 90) {
      recommendations.push(`🧪 **Testing**: Test pass rate is ${analysis.testPassRate}%. Aim for >90%`);
    }

    if (analysis.codeQualityScore < 70) {
      recommendations.push(`📊 **Quality**: Code quality score is ${analysis.codeQualityScore}/100. Focus on reducing error count`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ **Great Job**: Code quality looks good! Consider adding more comprehensive tests');
    }

    return recommendations;
  }

  /**
   * Display summary
   */
  displaySummary(analysis) {
    console.log('\n📊 Analysis Summary:');
    console.log(`  • Total Issues: ${analysis.totalIssues}`);
    console.log(`  • Critical: ${analysis.categories.critical}`);
    console.log(`  • Auto-fixable: ${analysis.categories.autoFixable}`);
    console.log(`  • Test Pass Rate: ${analysis.testPassRate}%`);
    console.log(`  • Quality Score: ${analysis.codeQualityScore}/100`);

    console.log('\n🎯 Next Steps:');
    if (analysis.categories.critical > 0) {
      console.log('  1. 🚨 Fix critical compilation errors first');
    }
    if (analysis.categories.autoFixable > 0) {
      console.log('  2. 🔧 Run automated fixes for quick wins');
    }
    if (analysis.details.tests.failedTests > 0) {
      console.log('  3. 🧪 Address failing tests');
    }
    console.log('  4. 📊 Review detailed reports for complete action plan');
  }
}

// CLI interface
if (require.main === module) {
  const runner = new ErrorAnalysisRunner();
  runner.run().then(() => {
    console.log('\n✅ Error analysis complete!');
    process.exit(0);
  }).catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
}

module.exports = ErrorAnalysisRunner;