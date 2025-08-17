#!/usr/bin/env node

/**
 * Enhanced Error Detection - Improved error detection with search capabilities
 */

const { spawn } = require('child_process');
const { writeFile, readFile } = require('fs/promises');
const path = require('path');

class EnhancedErrorDetector {
  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Run comprehensive error detection with timeout protection
   */
  async detectAllErrors() {
    console.log('🔍 Enhanced Error Detection Starting...\n');

    const results = await Promise.allSettled([
      this.detectTypeScriptErrorsWithTimeout(60000), // 1 minute timeout
      this.detectESLintErrorsWithTimeout(30000),     // 30 second timeout
      this.detectTestErrorsWithTimeout(120000)       // 2 minute timeout
    ]);

    const processedResults = {
      typescript: results[0].status === 'fulfilled' ? results[0].value : this.getErrorResult('TypeScript detection failed', results[0].reason),
      eslint: results[1].status === 'fulfilled' ? results[1].value : this.getErrorResult('ESLint detection failed', results[1].reason),
      tests: results[2].status === 'fulfilled' ? results[2].value : this.getErrorResult('Test detection failed', results[2].reason)
    };

    // Categorize and prioritize errors
    const analysis = this.analyzeErrors(processedResults);
    
    // Generate enhanced report with search capabilities
    const report = this.generateEnhancedReport(analysis);
    
    // Save report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `enhanced-error-report-${timestamp}.md`;
    await writeFile(reportPath, report, 'utf-8');
    
    console.log(`📄 Enhanced Report saved: ${reportPath}\n`);
    
    // Display summary
    this.displayEnhancedSummary(analysis);
    
    return analysis;
  }

  /**
   * Detect TypeScript errors with timeout
   */
  async detectTypeScriptErrorsWithTimeout(timeout = 60000) {
    return this.withTimeout(this.detectTypeScriptErrors(), timeout, 'TypeScript detection');
  }

  /**
   * Detect ESLint errors with timeout
   */
  async detectESLintErrorsWithTimeout(timeout = 30000) {
    return this.withTimeout(this.detectESLintErrors(), timeout, 'ESLint detection');
  }

  /**
   * Detect test errors with timeout
   */
  async detectTestErrorsWithTimeout(timeout = 120000) {
    return this.withTimeout(this.detectTestErrors(), timeout, 'Test detection');
  }

  /**
   * Add timeout protection to promises
   */
  async withTimeout(promise, timeoutMs, operationName) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Detect TypeScript compilation errors
   */
  async detectTypeScriptErrors() {
    return new Promise((resolve, reject) => {
      console.log('🔧 Checking TypeScript errors...');
      
      const tsc = spawn('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      tsc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      tsc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tsc.on('error', (error) => {
        reject(new Error(`TypeScript process error: ${error.message}`));
      });

      tsc.on('close', (code) => {
        const output = stdout + stderr;
        const errors = this.parseTypeScriptErrors(output);
        
        resolve({
          success: code === 0,
          errorCount: errors.length,
          errors: errors,
          rawOutput: output
        });
      });
    });
  }

  /**
   * Detect ESLint errors
   */
  async detectESLintErrors() {
    return new Promise((resolve, reject) => {
      console.log('📋 Checking ESLint errors...');

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

      eslint.on('error', (error) => {
        reject(new Error(`ESLint process error: ${error.message}`));
      });

      eslint.on('close', (code) => {
        try {
          const results = stdout ? JSON.parse(stdout) : [];
          const errors = this.parseESLintErrors(results);
          
          resolve({
            success: code === 0,
            errorCount: errors.length,
            errors: errors,
            rawOutput: stdout
          });
        } catch (error) {
          resolve({
            success: false,
            errorCount: 0,
            errors: [],
            parseError: error.message,
            rawOutput: stdout
          });
        }
      });
    });
  }

  /**
   * Detect test errors with explicit run flag
   */
  async detectTestErrors() {
    return new Promise((resolve, reject) => {
      console.log('🧪 Checking test errors...');

      // Use vitest directly with --run flag to ensure it doesn't hang
      const vitest = spawn('npx', ['vitest', '--run', '--reporter=verbose'], {
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

      vitest.on('error', (error) => {
        reject(new Error(`Test process error: ${error.message}`));
      });

      vitest.on('close', (code) => {
        const output = stdout + stderr;
        const testResults = this.parseTestErrors(output);
        
        resolve({
          success: code === 0,
          ...testResults,
          rawOutput: output
        });
      });
    });
  }

  /**
   * Create error result for failed operations
   */
  getErrorResult(message, error) {
    return {
      success: false,
      errorCount: 0,
      errors: [],
      systemError: message,
      details: error?.message || String(error)
    };
  }

  /**
   * Parse TypeScript errors with enhanced categorization
   */
  parseTypeScriptErrors(output) {
    const errors = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // Match TypeScript error format: file.ts(line,col): error TSxxxx: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;
        
        errors.push({
          id: `ts-${code}-${file}-${lineNum}-${colNum}`,
          type: 'typescript',
          severity,
          file: file.replace(this.projectRoot + '/', ''),
          line: parseInt(lineNum),
          column: parseInt(colNum),
          message: message.trim(),
          rule: code,
          category: this.categorizeTypeScriptError(code, message),
          fixable: this.isTypeScriptFixable(code),
          autoFixable: this.isTypeScriptAutoFixable(code),
          searchTerms: this.extractSearchTerms(message, file)
        });
      }
    }

    return errors;
  }

  /**
   * Parse ESLint errors with enhanced data
   */
  parseESLintErrors(results) {
    const errors = [];

    for (const result of results) {
      for (const message of result.messages) {
        errors.push({
          id: `eslint-${message.ruleId || 'unknown'}-${result.filePath}-${message.line}-${message.column}`,
          type: 'eslint',
          severity: message.severity === 2 ? 'error' : 'warning',
          file: result.filePath.replace(this.projectRoot + '/', ''),
          line: message.line,
          column: message.column,
          message: message.message,
          rule: message.ruleId || 'unknown',
          fixable: Boolean(message.fix),
          autoFixable: Boolean(message.fix),
          category: this.categorizeESLintError(message.ruleId, message.message),
          searchTerms: this.extractSearchTerms(message.message, result.filePath)
        });
      }
    }

    return errors;
  }

  /**
   * Parse test errors
   */
  parseTestErrors(output) {
    const result = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      compilationErrors: [],
      testFailures: []
    };

    // Extract test summary
    const summaryMatch = output.match(/Tests\s+(\d+)\s+passed.*?(\d+)\s+failed/);
    if (summaryMatch) {
      result.passedTests = parseInt(summaryMatch[1]);
      result.failedTests = parseInt(summaryMatch[2]);
      result.totalTests = result.passedTests + result.failedTests;
    }

    // Extract compilation errors from test output
    const errorLines = output.split('\n').filter(line => 
      line.includes('error TS') || line.includes('Error:') || line.includes('Failed')
    );

    errorLines.forEach((line, index) => {
      if (line.includes('error TS')) {
        const match = line.match(/(.+?)\((\d+),(\d+)\).*?(TS\d+):\s+(.+)$/);
        if (match) {
          const [, file, lineNum, colNum, code, message] = match;
          result.compilationErrors.push({
            id: `test-ts-${code}-${index}`,
            type: 'compilation',
            file: file.replace(this.projectRoot + '/', ''),
            line: parseInt(lineNum),
            column: parseInt(colNum),
            message: message.trim(),
            rule: code
          });
        }
      }
    });

    return result;
  }

  /**
   * Enhanced error analysis with search capabilities
   */
  analyzeErrors(results) {
    const allErrors = [
      ...(results.typescript.errors || []),
      ...(results.eslint.errors || []),
      ...(results.tests.compilationErrors || [])
    ];

    // Group by category for better organization
    const byCategory = new Map();
    const byFile = new Map();
    const byType = new Map();
    const bySearchTerm = new Map();

    allErrors.forEach(error => {
      // Group by category
      const categoryKey = error.category?.name || 'Unknown';
      if (!byCategory.has(categoryKey)) {
        byCategory.set(categoryKey, []);
      }
      byCategory.get(categoryKey).push(error);

      // Group by file
      if (!byFile.has(error.file)) {
        byFile.set(error.file, []);
      }
      byFile.get(error.file).push(error);

      // Group by type
      if (!byType.has(error.type)) {
        byType.set(error.type, []);
      }
      byType.get(error.type).push(error);

      // Index by search terms
      if (error.searchTerms) {
        error.searchTerms.forEach(term => {
          if (!bySearchTerm.has(term)) {
            bySearchTerm.set(term, []);
          }
          bySearchTerm.get(term).push(error);
        });
      }
    });

    // Create prioritized actions
    const actions = [];
    const sortedCategories = Array.from(byCategory.entries()).sort((a, b) => {
      const aPriority = a[1][0].category?.priority || 10;
      const bPriority = b[1][0].category?.priority || 10;
      return aPriority - bPriority;
    });

    sortedCategories.forEach(([categoryName, errors]) => {
      const category = errors[0].category;
      actions.push({
        category: categoryName,
        errorCount: errors.length,
        severity: category?.severity || 'low',
        autoFixable: category?.autoFixable || false,
        priority: category?.priority || 10,
        errors: errors.slice(0, 5), // Show first 5 examples
        fixStrategy: this.getFixStrategy(categoryName, errors)
      });
    });

    return {
      totalErrors: allErrors.length,
      actions: actions,
      groupings: {
        byCategory: Object.fromEntries(byCategory),
        byFile: Object.fromEntries(byFile),
        byType: Object.fromEntries(byType),
        bySearchTerm: Object.fromEntries(bySearchTerm)
      },
      summary: {
        critical: allErrors.filter(e => e.category?.severity === 'critical').length,
        high: allErrors.filter(e => e.category?.severity === 'high').length,
        medium: allErrors.filter(e => e.category?.severity === 'medium').length,
        low: allErrors.filter(e => e.category?.severity === 'low').length,
        autoFixable: allErrors.filter(e => e.category?.autoFixable).length
      },
      testStatus: {
        passRate: results.tests.totalTests > 0 ? 
          (results.tests.passedTests / results.tests.totalTests * 100).toFixed(1) : '100.0',
        failedTests: results.tests.failedTests || 0,
        compilationErrors: results.tests.compilationErrors?.length || 0
      }
    };
  }

  /**
   * Extract search terms from error messages and file paths
   */
  extractSearchTerms(message, filePath) {
    const terms = new Set();
    
    // Extract file name without path
    const fileName = path.basename(filePath, path.extname(filePath));
    terms.add(fileName);
    
    // Extract directory name
    const dirName = path.basename(path.dirname(filePath));
    if (dirName !== '.') terms.add(dirName);
    
    // Extract common error terms
    const commonTerms = message.match(/\b(undefined|null|not found|missing|duplicate|invalid|type|property|import|export|function|class|interface)\b/gi);
    if (commonTerms) {
      commonTerms.forEach(term => terms.add(term.toLowerCase()));
    }
    
    // Extract quoted strings (often property names, types, etc.)
    const quotedTerms = message.match(/'([^']+)'/g);
    if (quotedTerms) {
      quotedTerms.forEach(quoted => terms.add(quoted.slice(1, -1)));
    }
    
    return Array.from(terms);
  }

  /**
   * Categorize TypeScript errors
   */
  categorizeTypeScriptError(code, message) {
    const categories = {
      'TS2300': { name: 'Duplicate Identifier', severity: 'high', autoFixable: true, priority: 2 },
      'TS2551': { name: 'Property Access', severity: 'high', autoFixable: true, priority: 3 },
      'TS2561': { name: 'Object Property', severity: 'high', autoFixable: true, priority: 3 },
      'TS2724': { name: 'Import/Export', severity: 'critical', autoFixable: true, priority: 1 },
      'TS2345': { name: 'Type Assignment', severity: 'high', autoFixable: false, priority: 4 },
      'TS7006': { name: 'Implicit Any', severity: 'medium', autoFixable: false, priority: 6 },
      'TS6133': { name: 'Unused Variable', severity: 'low', autoFixable: true, priority: 8 },
      'TS2339': { name: 'Property Missing', severity: 'high', autoFixable: false, priority: 5 },
      'TS2315': { name: 'Generic Type', severity: 'medium', autoFixable: false, priority: 7 }
    };

    return categories[code] || { name: 'Other TypeScript', severity: 'medium', autoFixable: false, priority: 9 };
  }

  /**
   * Categorize ESLint errors
   */
  categorizeESLintError(ruleId, message) {
    if (!ruleId) return { name: 'ESLint Unknown', severity: 'low', autoFixable: false, priority: 10 };

    const categories = {
      '@typescript-eslint/no-unused-vars': { name: 'Unused Variables', severity: 'low', autoFixable: true, priority: 8 },
      '@typescript-eslint/no-explicit-any': { name: 'Explicit Any', severity: 'medium', autoFixable: false, priority: 6 },
      '@typescript-eslint/no-unsafe-assignment': { name: 'Unsafe Assignment', severity: 'high', autoFixable: false, priority: 4 },
      '@typescript-eslint/no-unsafe-call': { name: 'Unsafe Call', severity: 'high', autoFixable: false, priority: 4 },
      '@typescript-eslint/no-unsafe-member-access': { name: 'Unsafe Member Access', severity: 'high', autoFixable: false, priority: 4 },
      'react-hooks/exhaustive-deps': { name: 'React Hooks', severity: 'medium', autoFixable: false, priority: 7 },
      'prefer-const': { name: 'Prefer Const', severity: 'low', autoFixable: true, priority: 9 }
    };

    return categories[ruleId] || { name: 'ESLint Other', severity: 'low', autoFixable: false, priority: 10 };
  }

  /**
   * Check if TypeScript error is fixable
   */
  isTypeScriptFixable(code) {
    const fixable = ['TS2300', 'TS2551', 'TS2561', 'TS2724', 'TS6133'];
    return fixable.includes(code);
  }

  /**
   * Check if TypeScript error is auto-fixable
   */
  isTypeScriptAutoFixable(code) {
    const autoFixable = ['TS2300', 'TS2551', 'TS2561', 'TS6133'];
    return autoFixable.includes(code);
  }

  /**
   * Get fix strategy for category
   */
  getFixStrategy(categoryName, errors) {
    const strategies = {
      'Duplicate Identifier': 'Remove or rename duplicate declarations',
      'Property Access': 'Fix property name mismatches (underscore prefixes)',
      'Object Property': 'Correct object literal property names',
      'Import/Export': 'Fix import/export statements and module paths',
      'Type Assignment': 'Add proper type annotations or type casting',
      'Unused Variables': 'Remove unused variables and imports',
      'ESLint': 'Apply ESLint auto-fixes'
    };

    return strategies[categoryName] || 'Manual review and fix required';
  }

  /**
   * Generate enhanced report with search capabilities
   */
  generateEnhancedReport(analysis) {
    const { totalErrors, actions, groupings, summary, testStatus } = analysis;
    
    let report = `# Enhanced Error Detection Report

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

## Search and Filter Capabilities

### By File (Top 10 files with most errors)
`;

    // Add file-based grouping
    const filesSorted = Object.entries(groupings.byFile)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 10);
      
    filesSorted.forEach(([file, fileErrors]) => {
      report += `- \`${file}\`: ${fileErrors.length} errors\n`;
    });

    report += `\n### By Error Type\n`;
    Object.entries(groupings.byType).forEach(([type, typeErrors]) => {
      report += `- **${type.charAt(0).toUpperCase() + type.slice(1)}**: ${typeErrors.length} errors\n`;
    });

    report += `\n### Common Search Terms\n`;
    const topSearchTerms = Object.entries(groupings.bySearchTerm)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 15);
      
    topSearchTerms.forEach(([term, termErrors]) => {
      if (termErrors.length > 1) {
        report += `- \`${term}\`: ${termErrors.length} errors\n`;
      }
    });

    report += `\n## Prioritized Action Plan\n\n`;

    actions.forEach((action, index) => {
      const urgency = action.severity === 'critical' ? '🚨 CRITICAL' : 
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

    report += `## Immediate Actions

`;

    if (summary.critical > 0) {
      report += `🚨 **CRITICAL**: ${summary.critical} critical errors require immediate attention\n`;
    }
    if (summary.autoFixable > 0) {
      report += `🔧 **QUICK WINS**: ${summary.autoFixable} errors can be auto-fixed with tools\n`;
    }

    report += `
## Commands to Run

### 1. Fix Auto-fixable Issues
\`\`\`bash
# Apply ESLint fixes
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

### 3. Search for Specific Errors
\`\`\`bash
# Search for specific error patterns
grep -r "Property.*does not exist" src/
grep -r "TS2551\\|TS2561" src/
grep -r "_[a-zA-Z]" src/ | grep -E "\\.(ts|tsx):"
\`\`\`

## Error Patterns Found

### Property Naming Issues
- Inconsistent use of underscore prefixes (\`_property\` vs \`property\`)
- Common in: ${filesSorted.slice(0, 3).map(([file]) => `\`${file}\``).join(', ')}

### Import/Export Issues
- Mismatched import/export names
- Missing or incorrect module exports

### Type Safety Issues
- Implicit \`any\` types
- Unsafe assignments and member access

---

**Legend:**
- 🚨 Critical: Must fix immediately
- ⚠️ High: Important to fix soon
- 📋 Medium: Should fix when possible
- 🔧 Low: Clean up when convenient
- ✅ Auto-fixable with tools
`;

    return report;
  }

  /**
   * Display enhanced summary
   */
  displayEnhancedSummary(analysis) {
    console.log('\n📊 Enhanced Error Analysis Summary:');
    console.log(`  • Total Issues: ${analysis.totalErrors}`);
    console.log(`  • Critical: ${analysis.summary.critical}`);
    console.log(`  • High: ${analysis.summary.high}`);
    console.log(`  • Auto-fixable: ${analysis.summary.autoFixable}`);
    console.log(`  • Test Pass Rate: ${analysis.testStatus.passRate}%`);

    console.log('\n🔍 Search Capabilities:');
    console.log(`  • Errors grouped by ${Object.keys(analysis.groupings.byFile).length} files`);
    console.log(`  • ${Object.keys(analysis.groupings.bySearchTerm).length} searchable terms indexed`);
    console.log(`  • ${Object.keys(analysis.groupings.byCategory).length} error categories identified`);

    console.log('\n🎯 Next Steps:');
    if (analysis.summary.critical > 0) {
      console.log('  1. 🚨 Fix critical compilation errors first');
    }
    if (analysis.summary.autoFixable > 0) {
      console.log('  2. 🔧 Run automated fixes for quick wins');
    }
    if (analysis.testStatus.failedTests > 0) {
      console.log('  3. 🧪 Address failing tests');
    }
    console.log(`  4. 📋 Review and fix remaining ${analysis.totalErrors - analysis.summary.autoFixable} manual errors`);
  }
}

// Command line interface
if (require.main === module) {
  const detector = new EnhancedErrorDetector();
  
  const command = process.argv[2];
  
  if (command === 'search' && process.argv[3]) {
    // Search functionality
    const searchTerm = process.argv[3];
    console.log(`🔍 Searching for errors matching: "${searchTerm}"`);
    detector.detectAllErrors().then(analysis => {
      const matching = [];
      Object.entries(analysis.groupings.bySearchTerm).forEach(([term, errors]) => {
        if (term.toLowerCase().includes(searchTerm.toLowerCase())) {
          matching.push(...errors);
        }
      });
      
      if (matching.length > 0) {
        console.log(`\n📋 Found ${matching.length} errors matching "${searchTerm}":`);
        matching.slice(0, 10).forEach((error, i) => {
          console.log(`  ${i + 1}. ${error.file}:${error.line} - ${error.message}`);
        });
        if (matching.length > 10) {
          console.log(`  ... and ${matching.length - 10} more`);
        }
      } else {
        console.log(`\n❌ No errors found matching "${searchTerm}"`);
      }
    }).catch(console.error);
  } else {
    // Default: run full detection
    detector.detectAllErrors().catch(console.error);
  }
}

module.exports = EnhancedErrorDetector;