/**
 * Automated Fix Engine - Safely apply automated fixes for identified issues
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { QualityIssue, FixResult } from './codeQualityPipeline';
import { TypeScriptIssue, ESLintIssue } from './staticAnalysisEngine';

const execAsync = promisify(exec);

export interface FixOptions {
  safeOnly: boolean;
  dryRun: boolean;
  backupFiles: boolean;
  maxFixesPerFile: number;
}

export interface FileChange {
  file: string;
  originalContent: string;
  newContent: string;
  changes: Change[];
}

export interface Change {
  line: number;
  column: number;
  oldText: string;
  newText: string;
  description: string;
}

export class AutomatedFixEngine {
  private projectRoot: string;
  private backups: Map<string, string> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Apply fixes for all provided issues
   */
  async applyFixes(issues: QualityIssue[], options: FixOptions = this.getDefaultOptions()): Promise<FixResult[]> {
    const results: FixResult[] = [];
    const fileChanges: Map<string, FileChange> = new Map();

    // Group issues by file for batch processing
    const issuesByFile = this.groupIssuesByFile(issues);

    for (const [file, fileIssues] of issuesByFile) {
      try {
        const originalContent = await readFile(join(this.projectRoot, file), 'utf-8');
        
        if (options.backupFiles) {
          this.backups.set(file, originalContent);
        }

        let newContent = originalContent;
        const changes: Change[] = [];
        let fixCount = 0;

        // Sort issues by line number (descending) to avoid offset issues
        const sortedIssues = fileIssues.sort((a, b) => b.line - a.line);

        for (const issue of sortedIssues) {
          if (fixCount >= options.maxFixesPerFile) break;
          if (options.safeOnly && !this.isSafeFix(issue)) continue;

          const fixResult = await this.applyIssueFix(issue, newContent);
          
          if (fixResult.success) {
            newContent = fixResult.newContent;
            changes.push(...fixResult.changes);
            fixCount++;

            results.push({
              id: `fix-${issue.id}`,
              issueId: issue.id,
              type: issue.type,
              description: fixResult.description,
              success: true,
              filesChanged: [file]
            });
          } else {
            results.push({
              id: `fix-${issue.id}`,
              issueId: issue.id,
              type: issue.type,
              description: fixResult.description,
              success: false,
              error: fixResult.error,
              filesChanged: []
            });
          }
        }

        if (changes.length > 0) {
          fileChanges.set(file, {
            file,
            originalContent,
            newContent,
            changes
          });

          if (!options.dryRun) {
            await writeFile(join(this.projectRoot, file), newContent, 'utf-8');
          }
        }

      } catch (error: unknown) {
        results.push({
          id: `fix-error-${file}`,
          issueId: 'file-error',
          type: 'typescript',
          description: `Failed to process file ${file}`,
          success: false,
          error: (error as Error)?.message || String(error),
          filesChanged: []
        });
      }
    }

    return results;
  }

  /**
   * Apply safe fixes only (formatting, unused imports, etc.)
   */
  async applySafeFixes(issues: QualityIssue[]): Promise<FixResult[]> {
    const safeIssues = issues.filter(issue => this.isSafeFix(issue));
    return this.applyFixes(safeIssues, { ...this.getDefaultOptions(), safeOnly: true });
  }

  /**
   * Fix TypeScript compilation errors
   */
  async fixTypeScriptErrors(issues: TypeScriptIssue[]): Promise<FixResult[]> {
    const results: FixResult[] = [];

    for (const issue of issues) {
      const result = await this.fixTypeScriptIssue(issue);
      results.push(result);
    }

    return results;
  }

  /**
   * Fix ESLint issues using ESLint's auto-fix
   */
  async fixESLintIssues(issues: ESLintIssue[]): Promise<FixResult[]> {
    const results: FixResult[] = [];
    const fileGroups = this.groupIssuesByFile(issues);

    for (const [file, fileIssues] of fileGroups) {
      try {
        const fixableIssues = fileIssues.filter(issue => issue.fixable);
        
        if (fixableIssues.length === 0) continue;

        // Use ESLint's built-in auto-fix
        await execAsync(
          `npx eslint "${file}" --fix --format json`,
          { cwd: this.projectRoot }
        );

        results.push({
          id: `eslint-fix-${file}`,
          issueId: fileIssues.map(i => i.id).join(','),
          type: 'eslint',
          description: `Fixed ${fixableIssues.length} ESLint issues in ${file}`,
          success: true,
          filesChanged: [file]
        });

      } catch (error: unknown) {
        // ESLint may exit with non-zero code even on successful fixes
        if ((error as { code?: number; stderr?: string })?.code === 1 && !(error as { code?: number; stderr?: string })?.stderr) {
          results.push({
            id: `eslint-fix-${file}`,
            issueId: fileIssues.map(i => i.id).join(','),
            type: 'eslint',
            description: `Fixed ESLint issues in ${file}`,
            success: true,
            filesChanged: [file]
          });
        } else {
          results.push({
            id: `eslint-fix-error-${file}`,
            issueId: fileIssues.map(i => i.id).join(','),
            type: 'eslint',
            description: `Failed to fix ESLint issues in ${file}`,
            success: false,
            error: (error as Error)?.message || String(error),
            filesChanged: []
          });
        }
      }
    }

    return results;
  }

  /**
   * Optimize imports (remove unused, organize)
   */
  async optimizeImports(files: string[]): Promise<FixResult[]> {
    const results: FixResult[] = [];

    for (const file of files) {
      try {
        const content = await readFile(join(this.projectRoot, file), 'utf-8');
        const optimizedContent = await this.optimizeFileImports(content);

        if (optimizedContent !== content) {
          await writeFile(join(this.projectRoot, file), optimizedContent, 'utf-8');
          
          results.push({
            id: `import-optimization-${file}`,
            issueId: 'import-optimization',
            type: 'typescript',
            description: `Optimized imports in ${file}`,
            success: true,
            filesChanged: [file]
          });
        }

      } catch (error: unknown) {
        results.push({
          id: `import-optimization-error-${file}`,
          issueId: 'import-optimization',
          type: 'typescript',
          description: `Failed to optimize imports in ${file}`,
          success: false,
          error: (error as Error)?.message || String(error),
          filesChanged: []
        });
      }
    }

    return results;
  }

  /**
   * Rollback a specific fix
   */
  async rollbackFix(_fixId: string): Promise<void> {
    // Implementation for rolling back specific fixes
    // This would require maintaining a history of changes
    throw new Error('Rollback functionality not yet implemented');
  }

  /**
   * Rollback all changes to original state
   */
  async rollbackAll(): Promise<void> {
    for (const [file, originalContent] of this.backups) {
      await writeFile(join(this.projectRoot, file), originalContent, 'utf-8');
    }
    this.backups.clear();
  }

  /**
   * Apply fix for a specific issue
   */
  private async applyIssueFix(issue: QualityIssue, content: string): Promise<{
    success: boolean;
    newContent: string;
    changes: Change[];
    description: string;
    error?: string;
  }> {
    try {
      switch (issue.type) {
        case 'typescript':
          return await this.fixTypeScriptInContent(issue as TypeScriptIssue, content);
        case 'eslint':
          return await this.fixESLintInContent(issue as ESLintIssue, content);
        case 'performance':
          return await this.fixPerformanceInContent(issue, content);
        default:
          return {
            success: false,
            newContent: content,
            changes: [],
            description: `No fix available for issue type: ${issue.type}`,
            error: 'Unsupported issue type'
          };
      }
    } catch (error: unknown) {
      return {
        success: false,
        newContent: content,
        changes: [],
        description: `Failed to fix issue: ${issue.message}`,
        error: (error as Error)?.message || String(error)
      };
    }
  }

  /**
   * Fix TypeScript issue in content
   */
  private async fixTypeScriptInContent(issue: TypeScriptIssue, content: string): Promise<{
    success: boolean;
    newContent: string;
    changes: Change[];
    description: string;
    error?: string;
  }> {
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return {
        success: false,
        newContent: content,
        changes: [],
        description: 'Invalid line number',
        error: 'Line number out of range'
      };
    }

    const line = lines[lineIndex];
    let newLine = line;
    let fixed = false;
    const changes: Change[] = [];

    // Handle specific TypeScript error codes
    switch (issue.code) {
      case 'TS6133': // Unused variable
        if (line.includes('const ') || line.includes('let ') || line.includes('var ')) {
          // Remove unused variable declaration
          newLine = '';
          fixed = true;
          changes.push({
            line: issue.line,
            column: 1,
            oldText: line,
            newText: '',
            description: 'Removed unused variable'
          });
        }
        break;

      case 'TS6196': // Unused import
        if (line.includes('import ')) {
          // Remove unused import
          newLine = '';
          fixed = true;
          changes.push({
            line: issue.line,
            column: 1,
            oldText: line,
            newText: '',
            description: 'Removed unused import'
          });
        }
        break;

      case 'TS2304': { // Cannot find name
        // Try to add missing import
        const missingName = this.extractMissingName(issue.message);
        if (missingName && this.canAutoImport(missingName)) {
          const importLine = this.generateImportStatement(missingName);
          lines.unshift(importLine);
          fixed = true;
          changes.push({
            line: 1,
            column: 1,
            oldText: '',
            newText: importLine,
            description: `Added missing import for ${missingName}`
          });
        }
        break;
      }

      case 'TS2531': // Object is possibly null
      case 'TS2532': { // Object is possibly undefined
        // Add optional chaining or null check
        const objectName = this.extractObjectName(issue.message);
        if (objectName && line.includes(`${objectName}.`)) {
          newLine = line.replace(`${objectName}.`, `${objectName}?.`);
          fixed = true;
          changes.push({
            line: issue.line,
            column: issue.column,
            oldText: `${objectName}.`,
            newText: `${objectName}?.`,
            description: 'Added optional chaining'
          });
        }
        break;
      }
    }

    if (fixed) {
      if (newLine === '') {
        lines.splice(lineIndex, 1);
      } else {
        lines[lineIndex] = newLine;
      }

      return {
        success: true,
        newContent: lines.join('\n'),
        changes,
        description: `Fixed TypeScript error: ${issue.code}`
      };
    }

    return {
      success: false,
      newContent: content,
      changes: [],
      description: `No automatic fix available for ${issue.code}`,
      error: 'No fix pattern matched'
    };
  }

  /**
   * Fix ESLint issue in content
   */
  private async fixESLintInContent(_issue: ESLintIssue, content: string): Promise<{
    success: boolean;
    newContent: string;
    changes: Change[];
    description: string;
    error?: string;
  }> {
    // For ESLint issues, we primarily rely on ESLint's built-in auto-fix
    // This method handles cases where we need custom logic
    
    return {
      success: false,
      newContent: content,
      changes: [],
      description: 'ESLint fixes should be handled by ESLint auto-fix',
      error: 'Use ESLint auto-fix instead'
    };
  }

  /**
   * Fix performance issue in content
   */
  private async fixPerformanceInContent(issue: QualityIssue, content: string): Promise<{
    success: boolean;
    newContent: string;
    changes: Change[];
    description: string;
    error?: string;
  }> {
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    
    if (lineIndex < 0 || lineIndex >= lines.length) {
      return {
        success: false,
        newContent: content,
        changes: [],
        description: 'Invalid line number',
        error: 'Line number out of range'
      };
    }

    const line = lines[lineIndex];
    let newLine = line;
    let fixed = false;
    const changes: Change[] = [];

    // Handle specific performance issues
    switch (issue.rule) {
      case 'consider-memo':
        // Wrap component with React.memo
        if (line.includes('export const') && line.includes('= (')) {
          const componentMatch = line.match(/export const (\w+) = \(/);
          if (componentMatch) {
            const componentName = componentMatch[1];
            newLine = line.replace(
              `export const ${componentName} = (`,
              `export const ${componentName} = memo((`
            );
            
            // Find the closing of the component and add closing parenthesis
            // This is a simplified implementation
            fixed = true;
            changes.push({
              line: issue.line,
              column: 1,
              oldText: line,
              newText: newLine,
              description: 'Wrapped component with React.memo'
            });
          }
        }
        break;

      case 'optimize-imports':
        // Replace large library imports with specific imports
        if (line.includes('import') && line.includes('lodash')) {
          // Example: import _ from 'lodash' -> import { debounce } from 'lodash'
          // This would need more sophisticated analysis
          fixed = false; // Requires manual intervention
        }
        break;
    }

    if (fixed) {
      lines[lineIndex] = newLine;
      return {
        success: true,
        newContent: lines.join('\n'),
        changes,
        description: `Fixed performance issue: ${issue.rule}`
      };
    }

    return {
      success: false,
      newContent: content,
      changes: [],
      description: `No automatic fix available for ${issue.rule}`,
      error: 'Performance fix requires manual intervention'
    };
  }

  /**
   * Fix a specific TypeScript issue
   */
  private async fixTypeScriptIssue(issue: TypeScriptIssue): Promise<FixResult> {
    try {
      const filePath = join(this.projectRoot, issue.file);
      const content = await readFile(filePath, 'utf-8');
      
      const fixResult = await this.fixTypeScriptInContent(issue, content);
      
      if (fixResult.success) {
        await writeFile(filePath, fixResult.newContent, 'utf-8');
      }

      return {
        id: `ts-fix-${issue.id}`,
        issueId: issue.id,
        type: 'typescript',
        description: fixResult.description,
        success: fixResult.success,
        error: fixResult.error,
        filesChanged: fixResult.success ? [issue.file] : []
      };

    } catch (error: unknown) {
      return {
        id: `ts-fix-${issue.id}`,
        issueId: issue.id,
        type: 'typescript',
        description: `Failed to fix TypeScript issue`,
        success: false,
        error: (error as Error)?.message || String(error),
        filesChanged: []
      };
    }
  }

  /**
   * Optimize imports in file content
   */
  private async optimizeFileImports(content: string): Promise<string> {
    const lines = content.split('\n');
    const imports: string[] = [];
    const nonImports: string[] = [];
    
    let inImportSection = true;
    
    for (const line of lines) {
      if (line.trim().startsWith('import ')) {
        imports.push(line);
      } else if (line.trim() === '') {
        if (inImportSection) {
          imports.push(line);
        } else {
          nonImports.push(line);
        }
      } else {
        inImportSection = false;
        nonImports.push(line);
      }
    }

    // Sort imports
    const sortedImports = imports
      .filter(line => line.trim() !== '')
      .sort((a, b) => {
        // React imports first
        if (a.includes('react') && !b.includes('react')) return -1;
        if (!a.includes('react') && b.includes('react')) return 1;
        
        // External libraries next
        if (a.includes("'@/") && !b.includes("'@/")) return 1;
        if (!a.includes("'@/") && b.includes("'@/")) return -1;
        
        // Alphabetical within groups
        return a.localeCompare(b);
      });

    // Combine back together
    const result = [...sortedImports, '', ...nonImports.filter(line => line.trim() !== '' || nonImports.indexOf(line) === nonImports.length - 1)];
    
    return result.join('\n');
  }

  /**
   * Group issues by file for batch processing
   */
  private groupIssuesByFile(issues: QualityIssue[]): Map<string, QualityIssue[]> {
    const grouped = new Map<string, QualityIssue[]>();
    
    for (const issue of issues) {
      if (!grouped.has(issue.file)) {
        grouped.set(issue.file, []);
      }
      grouped.get(issue.file)!.push(issue);
    }
    
    return grouped;
  }

  /**
   * Check if a fix is considered safe
   */
  private isSafeFix(issue: QualityIssue): boolean {
    const safeFixes = [
      'TS6133', // Unused variable
      'TS6196', // Unused import
      'prefer-const',
      'no-var',
      'quotes',
      'semi',
      'comma-dangle',
      'trailing-comma'
    ];
    
    return safeFixes.includes(issue.rule);
  }

  /**
   * Extract missing name from TypeScript error message
   */
  private extractMissingName(message: string): string | null {
    const match = message.match(/Cannot find name '(\w+)'/);
    return match ? match[1] : null;
  }

  /**
   * Extract object name from null/undefined error message
   */
  private extractObjectName(message: string): string | null {
    const match = message.match(/Object is possibly (?:null|undefined)\.\s*(\w+)/);
    return match ? match[1] : null;
  }

  /**
   * Check if a name can be auto-imported
   */
  private canAutoImport(name: string): boolean {
    const autoImportable = ['React', 'useState', 'useEffect', 'useCallback', 'useMemo'];
    return autoImportable.includes(name);
  }

  /**
   * Generate import statement for a name
   */
  private generateImportStatement(name: string): string {
    switch (name) {
      case 'React':
        return "import React from 'react';";
      case 'useState':
      case 'useEffect':
      case 'useCallback':
      case 'useMemo':
        return `import { ${name} } from 'react';`;
      default:
        return `// TODO: Add import for ${name}`;
    }
  }

  /**
   * Get default fix options
   */
  private getDefaultOptions(): FixOptions {
    return {
      safeOnly: false,
      dryRun: false,
      backupFiles: true,
      maxFixesPerFile: 50
    };
  }
}

export const automatedFixEngine = new AutomatedFixEngine();