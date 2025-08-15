#!/usr/bin/env node

/**
 * Detect Current Errors - Working error detection script
 */

const { spawn } = require('child_process');
const { writeFile } = require('fs/promises');

class CurrentErrorDetector {
  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Run comprehensive error detection
   */
  async detectAllErrors() {
    console.log('🔍 Detecting Current Errors...\n');

    const results = {
      typescript: await this.detectTypeScriptErrors(),
      eslint: await this.detectESLintErrors(),
      tests: await this.detectTestErrors()
    };

    // Categorize and prioritize errors
    const analysis = this.analyzeErrors(results);
    
    // Generate actionable report
    const report = this.generateActionableReport(analysis);
    
    // Save report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await writeFile(`current-errors-${timestamp}.md`, report, 'utf-8');
    
    console.log(`📄 Report saved: current-errors-${timestamp}.md\n`);
    
    // Display summary
    this.displaySummary(analysis);
    
    return analysis;
  }

  /**
   * Detect TypeScript compilation errors
   */
  async detectTypeScriptErrors() {
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
        const errors = this.parseTypeScriptErrors(stderr);
        resolve({
          success: code === 0,
          errorCount: errors.length,
          errors: errors
        });
      });
    });
  }

  /**
   * Detect ESLint errors
   */
  async detectESLintErrors() {
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
            errors: []
          });
          return;
        }

        try {
          const results = stdout ? JSON.parse(stdout) : [];
          const errors = this.parseESLintErrors(results);
          
          resolve({
            success: code === 0,
            errorCount: errors.length,
            errors: errors
          });
        } catch (error) {
          resolve({
            success: false,
            errorCount: 0,
            errors: [],
            parseError: error.message
          });
        }
      });
    });
  }

  /**
   * Detect test errors
   */
  async detectTestErrors() {
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
        const testResults = this.parseTestErrors(output);
        
        resolve({
          success: code === 0,
          ...testResults
        });
      });
    });
  }

  /**
   * Parse TypeScript errors with detailed categorization
   */
  parseTypeScriptErrors(output) {
    const errors = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/);
      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;
        
        const error = {
          file: file.replace(this.projectRoot + '/', ''),
          line: parseInt(lineNum),
          column: parseInt(colNum),
          severity,
          code,
          message: message.trim(),
          category: this.categorizeTypeScriptError(code, message),
          fixable: this.isFixable(code, message),
          autoFixable: this.isAutoFixable(code, message)
        };
        
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Parse ESLint errors
   */
  parseESLintErrors(results) {
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
          fixable: message.fix !== undefined,
          autoFixable: message.fix !== undefined,
          category: { name: 'ESLint', severity: 'low', autoFixable: true }
        });
      }
    }

    return errors;
  }

  /**
   * Parse test errors
   */
  parseTestErrors(output) {
    const results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testFiles: 0,
      failedFiles: 0,
      compilationErrors: []
    };

    // Parse test counts
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

    // Extract compilation errors
    if (output.includes('Transform failed')) {
      const errorMatches = output.match(/ERROR: (.+)/g);
      if (errorMatches) {
        results.compilationErrors = errorMatches.map(match => ({
          type: 'compilation',
          message: match.replace('ERROR: ', ''),
          category: { name: 'Test Compilation', severity: 'critical', autoFixable: false }
        }));
      }
    }

    return results;
  }

  /**
   * Categorize TypeScript errors
   */
  categorizeTypeScriptError(code, message) {
    const categories = {
      'TS6133': { name: 'Unused Variable', severity: 'low', autoFixable: true, priority: 1 },
      'TS6196': { name: 'Unused Import', severity: 'low', autoFixable: true, priority: 1 },
      'TS6192': { name: 'All Imports Unused', severity: 'low', autoFixable: true, priority: 1 },
      'TS2393': { name: 'Duplicate Implementation', severity: 'high', autoFixable: true, priority: 2 },
      'TS2451': { name: 'Duplicate Declaration', severity: 'high', autoFixable: true, priority: 2 },
      'TS2305': { name: 'Missing Module', severity: 'critical', autoFixable: false, priority: 3 },
      'TS2307': { name: 'Cannot Find Module', severity: 'critical', autoFixable: false, priority: 3 },
      'TS2322': { name: 'Type Assignment', severity: 'medium', autoFixable: false, priority: 4 },
      'TS2345': { name: 'Argument Type', severity: 'medium', autoFixable: false, priority: 4 },
      'TS2339': { name: 'Property Missing', severity: 'medium', autoFixable: false, priority: 5 },
      'TS2551': { name: 'Property Missing', severity: 'medium', autoFixable: false, priority: 5 },
      'TS2552': { name: 'Cannot Find Name', severity: 'medium', autoFixable: false, priority: 5 },
      'TS2503': { name: 'Cannot Find Namespace', severity: 'medium', autoFixable: true, priority: 6 },
      'TS1205': { name: 'Re-export Type Issue', severity: 'medium', autoFixable: true, priority: 6 },
      'TS2689': { name: 'Cannot Extend Interface', severity: 'medium', autoFixable: false, priority: 7 },
      'TS2741': { name: 'Property Missing in Type', severity: 'medium', autoFixable: false, priority: 7 },
      'TS2561': { name: 'Object Literal Property', severity: 'low', autoFixable: false, priority: 8 },
      'TS18046': { name: 'Unknown Type', severity: 'low', autoFixable: false, priority: 8 },
      'TS2683': { name: 'Implicit Any Type', severity: 'low', autoFixable: false, priority: 9 },
      'TS7006': { name: 'Implicit Any Parameter', severity: 'low', autoFixable: false, priority: 9 }
    };

    return categories[code] || { name: 'Other TypeScript', severity: 'medium', autoFixable: false, priority: 10 };
  }

  /**
   * Check if error is fixable
   */
  isFixable(code, message) {
    const fixableCodes = [
      'TS6133', 'TS6196', 'TS6192', // Unused code
      'TS2393', 'TS2451', // Duplicates
      'TS2503', 'TS1205', // Namespace/export issues
      'TS2561' // Object literal issues
    ];
    
    return fixableCodes.some(fixable => code.startsWith(fixable));
  }

  /**
   * Check if error is auto-fixable
   */
  isAutoFixable(code, message) {
    const autoFixableCodes = [
      'TS6133', 'TS6196', 'TS6192', // Unused code - can be removed
      'TS2393', 'TS2451', // Duplicates - can remove duplicates
      'TS1205' // Re-export - can fix with 'export type'
    ];
    
    return autoFixableCodes.some(fixable => code.startsWith(fixable));
  }

  /**
   * Analyze all errors and create action plan
   */
  analyzeErrors(results) {
    const allErrors = [
      ...results.typescript.errors,
      ...results.eslint.errors,
      ...results.tests.compilationErrors
    ];

    // Group by category
    const byCategory = new Map();
    allErrors.forEach(error => {
      const key = error.category.name;
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
      }
      byCategory.get(key).push(error);
    });

    // Create prioritized actions
    const actions = [];
    
    // Sort categories by priority and severity
    const sortedCategories = Array.from(byCategory.entries()).sort((a, b) => {
      const aPriority = a[1][0].category.priority || 10;
      const bPriority = b[1][0].category.priority || 10;
      return aPriority - bPriority;
    });

    sortedCategories.forEach(([categoryName, errors]) => {
      const category = errors[0].category;
      actions.push({
        category: categoryName,
        errorCount: errors.length,
        severity: category.severity,
        autoFixable: category.autoFixable,
        priority: category.priority || 10,
        errors: errors.slice(0, 5), // Show first 5 examples
        fixStrategy: this.getFixStrategy(categoryName, errors)
      });
    });

    return {
      totalErrors: allErrors.length,
      actions: actions,
      summary: {
        critical: allErrors.filter(e => e.category.severity === 'critical').length,
        high: allErrors.filter(e => e.category.severity === 'high').length,
        medium: allErrors.filter(e => e.category.severity === 'medium').length,
        low: allErrors.filter(e => e.category.severity === 'low').length,
        autoFixable: allErrors.filter(e => e.category.autoFixable).length
      },
      testStatus: {
        passRate: results.tests.totalTests > 0 ? 
          (results.tests.passedTests / results.tests.totalTests * 100).toFixed(1) : '100.0',
        failedTests: results.tests.failedTests,
        compilationErrors: results.tests.compilationErrors.length
      }
    };
  }

  /**
   * Get fix strategy for category
   */
  getFixStrategy(categoryName, errors) {
    const strategies = {
      'Unused Variable': 'Remove unused variables and imports automatically',
      'Unused Import': 'Remove unused import statements automatically',
      'All Imports Unused': 'Remove entire unused import declarations',
      'Duplicate Implementation': 'Remove duplicate function implementations',
      'Duplicate Declaration': 'Remove duplicate variable declarations',
      'Missing Module': 'Fix import paths or install missing dependencies',
      'Cannot Find Module': 'Check file paths and module names',
      'Type Assignment': 'Fix type mismatches or add type assertions',
      'Property Missing': 'Add missing properties or fix property names',
      'Cannot Find Name': 'Fix variable names or add missing declarations',
      'Cannot Find Namespace': 'Add missing namespace imports (e.g., import { vi } from "vitest")',
      'Re-export Type Issue': 'Change exports to "export type" for isolated modules',
      'Test Compilation': 'Fix TypeScript errors preventing test compilation',
      'ESLint': 'Apply ESLint auto-fixes'
    };

    return strategies[categoryName] || 'Manual review and fix required';
  }

  /**
   * Generate actionable report
   */
  generateActionableReport(analysis) {
    const { totalErrors, actions, summary, testStatus } = analysis;
    
    let report = `# Current Error Detection Report

Generated: ${new Date().toISOString()}

## Executive Summary
- **Total Errors**: ${totalErrors}
- **Critical**: ${summary.critical} (must fix first)
- **High**: ${summary.high} (important)
- **Medium**: ${summary.medium} (moderate priority)
- **Low**: ${summary.low} (cleanup)
- **Auto-fixable**: ${summary.autoFixable} (quick wins)

## Test Status
- **Pass Rate**: ${testStatus.passRate}%
- **Failed Tests**: ${testStatus.failedTests}
- **Compilation Errors**: ${testStatus.compilationErrors}

## Prioritized Action Plan

`;

    actions.forEach((action, index) => {
      const urgency = action.severity === 'critical' ? '🚨 URGENT' : 
                     action.severity === 'high' ? '⚠️ HIGH' :
                     action.severity === 'medium' ? '📋 MEDIUM' : '🔧 LOW';
      
      const autoFix = action.autoFixable ? '✅ Auto-fixable' : '🔧 Manual fix';
      
      report += `### ${index + 1}. ${action.category} (${action.errorCount} errors)
- **Priority**: ${urgency}
- **Fix Type**: ${autoFix}
- **Strategy**: ${action.fixStrategy}

**Examples:**
${action.errors.map(error => 
  `- \`${error.file}:${error.line}\` - ${error.message}`
).join('\n')}

`;
    });

    // Add immediate action recommendations
    report += `## Immediate Actions

`;

    if (summary.critical > 0) {
      report += `🚨 **CRITICAL**: Fix ${summary.critical} critical errors immediately - these prevent compilation\n`;
    }

    if (summary.autoFixable > 0) {
      report += `🔧 **QUICK WINS**: ${summary.autoFixable} errors can be auto-fixed with tools\n`;
    }

    if (testStatus.compilationErrors > 0) {
      report += `🧪 **TESTS**: ${testStatus.compilationErrors} test compilation errors need fixing\n`;
    }

    // Add specific commands to run
    report += `
## Commands to Run

### 1. Fix Auto-fixable Issues
\`\`\`bash
# Remove unused imports and variables
npx eslint src --ext .ts,.tsx --fix

# Format code
npx prettier --write "src/**/*.{ts,tsx}"
\`\`\`

### 2. Check Progress
\`\`\`bash
# Check TypeScript compilation
npm run type-check

# Run tests
npm test
\`\`\`

### 3. Manual Fixes Needed
${actions.filter(a => !a.autoFixable).map(action => 
  `- **${action.category}**: ${action.fixStrategy}`
).join('\n')}
`;

    return report;
  }

  /**
   * Display summary
   */
  displaySummary(analysis) {
    const { totalErrors, summary, testStatus } = analysis;
    
    console.log('📊 Error Detection Summary:');
    console.log(`  • Total Errors: ${totalErrors}`);
    console.log(`  • Critical: ${summary.critical} 🚨`);
    console.log(`  • High: ${summary.high} ⚠️`);
    console.log(`  • Medium: ${summary.medium} 📋`);
    console.log(`  • Low: ${summary.low} 🔧`);
    console.log(`  • Auto-fixable: ${summary.autoFixable} ✅`);
    console.log(`  • Test Pass Rate: ${testStatus.passRate}%`);

    console.log('\n🎯 Immediate Actions:');
    
    if (summary.critical > 0) {
      console.log(`  1. 🚨 Fix ${summary.critical} critical errors (prevents compilation)`);
    }
    
    if (summary.autoFixable > 0) {
      console.log(`  2. 🔧 Auto-fix ${summary.autoFixable} issues with: npx eslint src --fix`);
    }
    
    if (testStatus.compilationErrors > 0) {
      console.log(`  3. 🧪 Fix ${testStatus.compilationErrors} test compilation errors`);
    }
    
    console.log('  4. 📋 Review detailed report for complete action plan');
  }
}

// CLI interface
if (require.main === module) {
  const detector = new CurrentErrorDetector();
  detector.detectAllErrors().then(() => {
    console.log('\n✅ Error detection complete!');
  }).catch(error => {
    console.error('❌ Detection failed:', error);
    process.exit(1);
  });
}

module.exports = CurrentErrorDetector;