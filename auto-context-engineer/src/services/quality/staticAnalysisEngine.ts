/**
 * Static Analysis Engine - Comprehensive code analysis using multiple tools
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { QualityIssue } from './codeQualityPipeline';

const execAsync = promisify(exec);

interface VulnerabilityInfo {
  severity: string;
  title: string;
  url?: string;
  range?: string;
  fixAvailable?: boolean | string;
}

interface PackageInfo {
  current: string;
  wanted: string;
  latest: string;
  location?: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export interface TypeScriptIssue extends QualityIssue {
  type: 'typescript';
  code: string;
  category: 'compilation';
}

export interface ESLintIssue extends QualityIssue {
  type: 'eslint';
  ruleId: string;
  category: 'linting';
}

export interface PerformanceIssue extends QualityIssue {
  type: 'performance';
  impact: 'high' | 'medium' | 'low';
  category: 'performance';
}

export interface SecurityIssue extends QualityIssue {
  type: 'security';
  vulnerability: string;
  category: 'security';
}

export interface AccessibilityIssue extends QualityIssue {
  type: 'accessibility';
  wcagLevel: 'A' | 'AA' | 'AAA';
  category: 'accessibility';
}

export interface DependencyIssue {
  name: string;
  version: string;
  issue: 'outdated' | 'vulnerable' | 'unused' | 'conflict';
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export class StaticAnalysisEngine {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Analyze TypeScript compilation issues
   */
  async analyzeTypeScript(files?: string[]): Promise<TypeScriptIssue[]> {
    try {
      const command = files && files.length > 0 
        ? `npx tsc --noEmit ${files.join(' ')}`
        : 'npx tsc --noEmit';

      const { stdout, stderr } = await execAsync(command, { 
        cwd: this.projectRoot,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      return this.parseTypeScriptOutput(stderr || stdout);
    } catch (error: unknown) {
      // TypeScript exits with non-zero code when there are errors
      if (error && typeof error === 'object' && ('stdout' in error || 'stderr' in error)) {
        const execError = error as { stdout?: string; stderr?: string };
        return this.parseTypeScriptOutput(execError.stderr || execError.stdout || '');
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`TypeScript analysis failed: ${message}`);
    }
  }

  /**
   * Analyze ESLint issues
   */
  async analyzeESLint(files?: string[]): Promise<ESLintIssue[]> {
    try {
      const targetFiles = files && files.length > 0 
        ? files.join(' ')
        : 'src --ext .ts,.tsx';

      const command = `npx eslint ${targetFiles} --format json`;
      
      const { stdout } = await execAsync(command, { 
        cwd: this.projectRoot,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      return this.parseESLintOutput(stdout);
    } catch (error: unknown) {
      // ESLint exits with non-zero code when there are errors
      if (error && typeof error === 'object' && 'stdout' in error) {
        const execError = error as { stdout: string };
        return this.parseESLintOutput(execError.stdout);
      }

      // Handle configuration errors
      if (error && typeof error === 'object' && 'stderr' in error) {
        const execError = error as { stderr: string };
        if (execError.stderr && execError.stderr.includes('config')) {
          console.warn('ESLint configuration issue:', execError.stderr);
          return [];
        }
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`ESLint analysis failed: ${message}`);
    }
  }

  /**
   * Analyze performance issues in code
   */
  async analyzePerformance(files: string[]): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    for (const file of files) {
      if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;

      try {
        const content = await readFile(join(this.projectRoot, file), 'utf-8');
        const fileIssues = await this.analyzeFilePerformance(file, content);
        issues.push(...fileIssues);
      } catch (error) {
        console.warn(`Failed to analyze performance for ${file}:`, error);
      }
    }

    return issues;
  }

  /**
   * Analyze security vulnerabilities
   */
  async analyzeSecurity(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      // Run npm audit
      const { stdout } = await execAsync('npm audit --json', { 
        cwd: this.projectRoot 
      });
      
      const auditResult = JSON.parse(stdout);
      
      if (auditResult.vulnerabilities) {
        for (const [name, vuln] of Object.entries(auditResult.vulnerabilities)) {
          const vulnerability = vuln as VulnerabilityInfo;
          issues.push({
            id: `security-${name}-${Date.now()}`,
            type: 'security',
            severity: this.mapAuditSeverity(vulnerability.severity),
            file: 'package.json',
            line: 1,
            column: 1,
            message: `Security vulnerability in ${name}: ${vulnerability.title}`,
            rule: 'npm-audit',
            fixable: Boolean(vulnerability.fixAvailable),
            autoFixable: vulnerability.fixAvailable === true,
            category: 'security',
            vulnerability: vulnerability.title
          });
        }
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'stdout' in error) {
        const execError = error as { stdout: string };
        if (!execError.stdout || !execError.stdout.includes('vulnerabilities')) {
          const message = error instanceof Error ? error.message : String(error);
          console.warn('Security analysis failed:', message);
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('Security analysis failed:', message);
      }
    }

    return issues;
  }

  /**
   * Analyze accessibility issues
   */
  async analyzeAccessibility(files: string[]): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];

    for (const file of files) {
      if (!file.endsWith('.tsx')) continue;

      try {
        const content = await readFile(join(this.projectRoot, file), 'utf-8');
        const fileIssues = await this.analyzeFileAccessibility(file, content);
        issues.push(...fileIssues);
      } catch (error) {
        console.warn(`Failed to analyze accessibility for ${file}:`, error);
      }
    }

    return issues;
  }

  /**
   * Analyze dependency issues
   */
  async analyzeDependencies(): Promise<DependencyIssue[]> {
    const issues: DependencyIssue[] = [];

    try {
      const packageJsonPath = join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));

      // Check for outdated packages
      const { stdout } = await execAsync('npm outdated --json', { 
        cwd: this.projectRoot 
      });
      
      if (stdout) {
        const outdated = JSON.parse(stdout);
        for (const [name, info] of Object.entries(outdated)) {
          const packageInfo = info as PackageInfo;
          issues.push({
            name,
            version: packageInfo.current,
            issue: 'outdated',
            severity: this.getOutdatedSeverity(packageInfo.current, packageInfo.latest),
            recommendation: `Update to version ${packageInfo.latest}`
          });
        }
      }

      // Check for unused dependencies (basic implementation)
      const unusedDeps = await this.findUnusedDependencies(packageJson);
      for (const dep of unusedDeps) {
        issues.push({
          name: dep,
          version: packageJson.dependencies[dep] || packageJson.devDependencies[dep],
          issue: 'unused',
          severity: 'low',
          recommendation: `Consider removing if not needed`
        });
      }

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('Dependency analysis failed:', message);
    }

    return issues;
  }

  /**
   * Get all source files in the project
   */
  async getSourceFiles(): Promise<string[]> {
    const files: string[] = [];
    const projectRoot = this.projectRoot;

    async function scanDirectory(dir: string): Promise<void> {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          if (!entry.startsWith('.') && entry !== 'node_modules' && entry !== 'dist') {
            await scanDirectory(fullPath);
          }
        } else if (stats.isFile()) {
          const ext = extname(entry);
          if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
            files.push(fullPath.replace(projectRoot + '/', ''));
          }
        }
      }
    }

    await scanDirectory(join(this.projectRoot, 'src'));
    return files;
  }

  /**
   * Parse TypeScript compiler output
   */
  private parseTypeScriptOutput(output: string): TypeScriptIssue[] {
    const issues: TypeScriptIssue[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(/^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/);
      if (match) {
        const [, file, lineNum, colNum, severity, code, message] = match;
        
        issues.push({
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
          category: 'compilation',
          code
        });
      }
    }

    return issues;
  }

  /**
   * Parse ESLint JSON output
   */
  private parseESLintOutput(output: string): ESLintIssue[] {
    const issues: ESLintIssue[] = [];

    try {
      const results = JSON.parse(output);
      
      for (const result of results) {
        for (const message of result.messages) {
          issues.push({
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
            category: 'linting',
            ruleId: message.ruleId || 'unknown'
          });
        }
      }
    } catch (error) {
      console.warn('Failed to parse ESLint output:', error);
    }

    return issues;
  }

  /**
   * Analyze performance issues in a single file
   */
  private async analyzeFilePerformance(file: string, content: string): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];
    const lines = content.split('\n');

    // Check for common performance anti-patterns
    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for inline functions in JSX
      if (line.includes('onClick={() =>') || line.includes('onChange={() =>')) {
        issues.push({
          id: `perf-inline-function-${file}-${lineNum}`,
          type: 'performance',
          severity: 'warning',
          file,
          line: lineNum,
          column: line.indexOf('() =>') + 1,
          message: 'Inline function in JSX prop may cause unnecessary re-renders',
          rule: 'no-inline-functions',
          fixable: true,
          autoFixable: false,
          category: 'performance',
          impact: 'medium'
        });
      }

      // Check for missing React.memo
      if (line.includes('export const') && line.includes('= (') && !content.includes('memo(')) {
        issues.push({
          id: `perf-missing-memo-${file}-${lineNum}`,
          type: 'performance',
          severity: 'info',
          file,
          line: lineNum,
          column: 1,
          message: 'Consider wrapping component with React.memo for performance',
          rule: 'consider-memo',
          fixable: true,
          autoFixable: true,
          category: 'performance',
          impact: 'low'
        });
      }

      // Check for large bundle imports
      if (line.includes('import') && (line.includes('lodash') || line.includes('moment'))) {
        issues.push({
          id: `perf-large-import-${file}-${lineNum}`,
          type: 'performance',
          severity: 'warning',
          file,
          line: lineNum,
          column: 1,
          message: 'Large library import detected, consider tree shaking or alternatives',
          rule: 'optimize-imports',
          fixable: true,
          autoFixable: false,
          category: 'performance',
          impact: 'high'
        });
      }
    });

    return issues;
  }

  /**
   * Analyze accessibility issues in a single file
   */
  private async analyzeFileAccessibility(file: string, content: string): Promise<AccessibilityIssue[]> {
    const issues: AccessibilityIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for missing alt text on images
      if (line.includes('<img') && !line.includes('alt=')) {
        issues.push({
          id: `a11y-missing-alt-${file}-${lineNum}`,
          type: 'accessibility',
          severity: 'error',
          file,
          line: lineNum,
          column: line.indexOf('<img') + 1,
          message: 'Image missing alt attribute for accessibility',
          rule: 'img-has-alt',
          fixable: true,
          autoFixable: false,
          category: 'accessibility',
          wcagLevel: 'A'
        });
      }

      // Check for missing labels on form inputs
      if (line.includes('<input') && !line.includes('aria-label') && !line.includes('id=')) {
        issues.push({
          id: `a11y-missing-label-${file}-${lineNum}`,
          type: 'accessibility',
          severity: 'error',
          file,
          line: lineNum,
          column: line.indexOf('<input') + 1,
          message: 'Form input missing accessible label',
          rule: 'label-has-associated-control',
          fixable: true,
          autoFixable: false,
          category: 'accessibility',
          wcagLevel: 'A'
        });
      }

      // Check for missing button text
      if (line.includes('<button') && line.includes('></button>')) {
        issues.push({
          id: `a11y-empty-button-${file}-${lineNum}`,
          type: 'accessibility',
          severity: 'error',
          file,
          line: lineNum,
          column: line.indexOf('<button') + 1,
          message: 'Button has no accessible text',
          rule: 'button-has-text',
          fixable: true,
          autoFixable: false,
          category: 'accessibility',
          wcagLevel: 'A'
        });
      }
    });

    return issues;
  }

  /**
   * Find unused dependencies (basic implementation)
   */
  private async findUnusedDependencies(packageJson: PackageJson): Promise<string[]> {
    const unused: string[] = [];
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // This is a simplified implementation
    // In a real scenario, you'd use tools like depcheck
    const sourceFiles = await this.getSourceFiles();
    const allContent = await Promise.all(
      sourceFiles.map(file => 
        readFile(join(this.projectRoot, file), 'utf-8').catch(() => '')
      )
    );
    
    const combinedContent = allContent.join('\n');
    
    for (const dep of Object.keys(dependencies)) {
      if (!combinedContent.includes(dep) && !this.isEssentialDependency(dep)) {
        unused.push(dep);
      }
    }
    
    return unused;
  }

  /**
   * Check if a dependency is essential (build tools, etc.)
   */
  private isEssentialDependency(name: string): boolean {
    const essential = [
      'typescript', 'vite', 'vitest', 'eslint', 'prettier',
      '@types/', '@typescript-eslint/', '@vitejs/', '@vitest/',
      'husky', 'lint-staged'
    ];
    
    return essential.some(pattern => name.includes(pattern));
  }

  /**
   * Check if TypeScript error is fixable
   */
  private isTypeScriptFixable(code: string): boolean {
    const fixableCodes = [
      'TS2304', // Cannot find name
      'TS2307', // Cannot find module
      'TS2322', // Type assignment
      'TS2339', // Property does not exist
      'TS2345', // Argument type mismatch
      'TS2531', // Object is possibly null
      'TS2532', // Object is possibly undefined
      'TS6133', // Unused variable
      'TS6196', // Unused import
    ];
    
    return fixableCodes.includes(code);
  }

  /**
   * Check if TypeScript error is auto-fixable
   */
  private isTypeScriptAutoFixable(code: string): boolean {
    const autoFixableCodes = [
      'TS6133', // Unused variable
      'TS6196', // Unused import
      'TS2304', // Cannot find name (sometimes)
    ];
    
    return autoFixableCodes.includes(code);
  }

  /**
   * Map npm audit severity to our severity levels
   */
  private mapAuditSeverity(severity: string): 'error' | 'warning' | 'info' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'moderate':
        return 'warning';
      case 'low':
      case 'info':
        return 'info';
      default:
        return 'warning';
    }
  }

  /**
   * Determine severity of outdated packages
   */
  private getOutdatedSeverity(current: string, latest: string): 'high' | 'medium' | 'low' {
    // Simple version comparison - in reality you'd use semver
    const currentParts = current.replace(/[^\d.]/g, '').split('.').map(Number);
    const latestParts = latest.replace(/[^\d.]/g, '').split('.').map(Number);
    
    if (latestParts[0] > currentParts[0]) return 'high'; // Major version behind
    if (latestParts[1] > currentParts[1]) return 'medium'; // Minor version behind
    return 'low'; // Patch version behind
  }
}

export const staticAnalysisEngine = new StaticAnalysisEngine();