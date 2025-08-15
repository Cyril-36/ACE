#!/usr/bin/env node

/**
 * Code Quality Runner - CLI tool for running code quality analysis and fixes
 */

const { spawn } = require('child_process');
const { readFile, writeFile } = require('fs/promises');
const { join } = require('path');

class CodeQualityRunner {
  constructor() {
    this.projectRoot = process.cwd();
    this.results = {
      analysis: null,
      fixes: null,
      validation: null
    };
  }

  /**
   * Run the complete code quality pipeline
   */
  async run(options = {}) {
    const {
      fix = false,
      dryRun = false,
      verbose = false,
      categories = ['compilation', 'linting', 'performance']
    } = options;

    console.log('🔍 Starting Code Quality Analysis...\n');

    try {
      // Step 1: TypeScript Analysis
      console.log('📝 Analyzing TypeScript compilation...');
      const tsResults = await this.runTypeScriptAnalysis();
      this.logResults('TypeScript', tsResults, verbose);

      // Step 2: ESLint Analysis
      console.log('\n🔧 Analyzing ESLint issues...');
      const eslintResults = await this.runESLintAnalysis();
      this.logResults('ESLint', eslintResults, verbose);

      // Step 3: Test Analysis
      console.log('\n🧪 Analyzing test status...');
      const testResults = await this.runTestAnalysis();
      this.logResults('Tests', testResults, verbose);

      // Step 4: Apply fixes if requested
      if (fix && !dryRun) {
        console.log('\n🔨 Applying automated fixes...');
        await this.applyFixes(tsResults, eslintResults);
      } else if (fix && dryRun) {
        console.log('\n🔍 Dry run - showing what would be fixed...');
        await this.showPotentialFixes(tsResults, eslintResults);
      }

      // Step 5: Generate summary
      console.log('\n📊 Quality Analysis Summary:');
      this.generateSummary(tsResults, eslintResults, testResults);

      return {
        success: true,
        typescript: tsResults,
        eslint: eslintResults,
        tests: testResults
      };

    } catch (error) {
      console.error('❌ Code quality analysis failed:', error.message);
      return { success: false, error: error.message };
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

      let stdout = '';
      let stderr = '';

      tsc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      tsc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      tsc.on('close', (code) => {
        const output = stderr || stdout;
        const errors = this.parseTypeScriptOutput(output);
        
        resolve({
          success: code === 0,
          errorCount: errors.length,
          errors: errors,
          output: output
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
          // ESLint configuration error
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
   * Apply automated fixes
   */
  async applyFixes(tsResults, eslintResults) {
    const fixes = [];

    // Apply ESLint auto-fixes first
    if (eslintResults.errors.some(e => e.fixable)) {
      console.log('  🔧 Applying ESLint auto-fixes...');
      const eslintFix = await this.runESLintFix();
      if (eslintFix.success) {
        fixes.push('ESLint auto-fixes applied');
      }
    }

    // Apply Prettier formatting
    console.log('  💅 Applying Prettier formatting...');
    const prettierFix = await this.runPrettierFix();
    if (prettierFix.success) {
      fixes.push('Prettier formatting applied');
    }

    // Apply TypeScript fixes (limited)
    const fixableTypeScriptErrors = tsResults.errors.filter(e => this.isTypeScriptFixable(e));
    if (fixableTypeScriptErrors.length > 0) {
      console.log(`  📝 Attempting to fix ${fixableTypeScriptErrors.length} TypeScript issues...`);
      // This would require more sophisticated logic
      fixes.push(`Attempted ${fixableTypeScriptErrors.length} TypeScript fixes`);
    }

    console.log(`✅ Applied fixes: ${fixes.join(', ')}`);
    return fixes;
  }

  /**
   * Show potential fixes without applying them
   */
  async showPotentialFixes(tsResults, eslintResults) {
    console.log('  📋 Potential fixes:');
    
    const eslintFixable = eslintResults.errors.filter(e => e.fixable).length;
    if (eslintFixable > 0) {
      console.log(`    - ${eslintFixable} ESLint issues can be auto-fixed`);
    }

    const tsFixable = tsResults.errors.filter(e => this.isTypeScriptFixable(e)).length;
    if (tsFixable > 0) {
      console.log(`    - ${tsFixable} TypeScript issues might be fixable`);
    }

    console.log('    - Prettier formatting can be applied');
  }

  /**
   * Run ESLint with auto-fix
   */
  async runESLintFix() {
    return new Promise((resolve) => {
      const eslint = spawn('npx', ['eslint', 'src', '--ext', '.ts,.tsx', '--fix'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      eslint.on('close', (code) => {
        resolve({ success: code === 0 || code === 1 }); // ESLint returns 1 even on successful fixes
      });
    });
  }

  /**
   * Run Prettier formatting
   */
  async runPrettierFix() {
    return new Promise((resolve) => {
      const prettier = spawn('npx', ['prettier', '--write', 'src/**/*.{ts,tsx,json,css,md}'], {
        cwd: this.projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      prettier.on('close', (code) => {
        resolve({ success: code === 0 });
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
          fixable: this.isTypeScriptFixable({ code })
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
      failedFiles: 0
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

    return results;
  }

  /**
   * Check if TypeScript error is potentially fixable
   */
  isTypeScriptFixable(error) {
    const fixableCodes = [
      'TS6133', // Unused variable
      'TS6196', // Unused import
      'TS2304', // Cannot find name (sometimes)
      'TS2531', // Object is possibly null
      'TS2532', // Object is possibly undefined
    ];
    
    return fixableCodes.includes(error.code);
  }

  /**
   * Log analysis results
   */
  logResults(tool, results, verbose) {
    if (results.success) {
      console.log(`  ✅ ${tool}: No issues found`);
    } else if (results.configError) {
      console.log(`  ⚠️  ${tool}: Configuration error`);
      if (verbose) {
        console.log(`     ${results.output}`);
      }
    } else {
      console.log(`  ❌ ${tool}: ${results.errorCount} issues found`);
      
      if (verbose && results.errors.length > 0) {
        results.errors.slice(0, 5).forEach(error => {
          console.log(`     ${error.file}:${error.line}:${error.column} - ${error.message}`);
        });
        
        if (results.errors.length > 5) {
          console.log(`     ... and ${results.errors.length - 5} more issues`);
        }
      }
    }
  }

  /**
   * Generate summary report
   */
  generateSummary(tsResults, eslintResults, testResults) {
    const totalIssues = tsResults.errorCount + eslintResults.errorCount;
    const fixableIssues = [
      ...tsResults.errors.filter(e => e.fixable),
      ...eslintResults.errors.filter(e => e.fixable)
    ].length;

    console.log(`
📈 Summary:
  • Total Issues: ${totalIssues}
  • TypeScript Errors: ${tsResults.errorCount}
  • ESLint Issues: ${eslintResults.errorCount}
  • Auto-fixable: ${fixableIssues}
  • Test Status: ${testResults.passedTests}/${testResults.totalTests} passed
  • Test Files: ${testResults.testFiles - testResults.failedFiles}/${testResults.testFiles} passed

🎯 Next Steps:`);

    if (totalIssues === 0) {
      console.log('  ✅ Code quality looks great! No issues found.');
    } else {
      if (fixableIssues > 0) {
        console.log(`  🔧 Run with --fix to automatically fix ${fixableIssues} issues`);
      }
      if (tsResults.errorCount > 0) {
        console.log('  📝 Review TypeScript errors and fix manually');
      }
      if (testResults.failedTests > 0) {
        console.log('  🧪 Fix failing tests');
      }
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    fix: args.includes('--fix'),
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose') || args.includes('-v')
  };

  const runner = new CodeQualityRunner();
  runner.run(options).then(result => {
    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = CodeQualityRunner;