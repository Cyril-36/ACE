#!/usr/bin/env node

/**
 * Quick Error Search - Fast search through existing error reports
 */

const { readFile, readdir } = require('fs/promises');
const path = require('path');

class QuickErrorSearch {
  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Search through existing error reports
   */
  async searchReports(searchTerm) {
    const reportFiles = await this.findReportFiles();
    
    if (reportFiles.length === 0) {
      console.log('❌ No error reports found. Run enhanced error detection first:');
      console.log('   node scripts/enhancedErrorDetection.cjs');
      return;
    }

    console.log(`🔍 Searching for "${searchTerm}" in ${reportFiles.length} report(s)...`);
    
    const matches = [];
    
    for (const file of reportFiles) {
      try {
        const content = await readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
            matches.push({
              file: path.basename(file),
              line: index + 1,
              content: line.trim(),
              fullPath: file
            });
          }
        });
      } catch (error) {
        console.warn(`⚠️ Could not read ${file}: ${error.message}`);
      }
    }

    this.displayMatches(matches, searchTerm);
  }

  /**
   * Search for errors by pattern
   */
  async searchByPattern(pattern) {
    console.log(`🔍 Searching for error pattern: ${pattern}`);
    
    const patterns = {
      'property': ['Property .* does not exist', '_[a-zA-Z]+ does not exist'],
      'import': ['has no exported member', 'Cannot find module'],
      'type': ['Type .* is not assignable', 'Argument of type'],
      'undefined': ['undefined.*implicitly has.*type', 'Object is possibly undefined'],
      'any': ['Unsafe.*any.*value', 'implicitly has.*any.*type'],
      'unused': ['is declared but.*never used', 'defined but never used'],
      'duplicate': ['Duplicate identifier', 'already declared']
    };

    const searchPatterns = patterns[pattern.toLowerCase()] || [pattern];
    
    for (const searchPattern of searchPatterns) {
      await this.searchReports(searchPattern);
    }
  }

  /**
   * Find all error report files
   */
  async findReportFiles() {
    try {
      const files = await readdir(this.projectRoot);
      return files
        .filter(file => 
          file.includes('error') && 
          (file.endsWith('.md') || file.endsWith('.txt')) &&
          (file.includes('report') || file.includes('current') || file.includes('enhanced'))
        )
        .map(file => path.join(this.projectRoot, file))
        .sort((a, b) => b.localeCompare(a)); // Most recent first
    } catch (error) {
      console.error('Error reading directory:', error.message);
      return [];
    }
  }

  /**
   * Display search matches
   */
  displayMatches(matches, searchTerm) {
    if (matches.length === 0) {
      console.log(`❌ No matches found for "${searchTerm}"`);
      return;
    }

    console.log(`\n✅ Found ${matches.length} matches for "${searchTerm}":`);
    console.log('─'.repeat(80));

    // Group by file
    const byFile = {};
    matches.forEach(match => {
      if (!byFile[match.file]) {
        byFile[match.file] = [];
      }
      byFile[match.file].push(match);
    });

    Object.entries(byFile).forEach(([file, fileMatches]) => {
      console.log(`\n📄 ${file} (${fileMatches.length} matches):`);
      
      fileMatches.slice(0, 10).forEach((match, index) => {
        const line = match.content;
        const highlighted = this.highlightMatch(line, searchTerm);
        console.log(`  ${index + 1}. Line ${match.line}: ${highlighted}`);
      });
      
      if (fileMatches.length > 10) {
        console.log(`  ... and ${fileMatches.length - 10} more matches`);
      }
    });

    console.log('\n' + '─'.repeat(80));
    console.log(`💡 Tips:`);
    console.log(`   • Run with different search terms: property, import, type, undefined`);
    console.log(`   • Generate new report: node scripts/enhancedErrorDetection.cjs`);
    console.log(`   • Search patterns: node scripts/quickErrorSearch.cjs pattern <type>`);
  }

  /**
   * Highlight search term in text
   */
  highlightMatch(text, searchTerm) {
    const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '\x1b[43m\x1b[30m$1\x1b[0m'); // Yellow background, black text
  }

  /**
   * Escape special regex characters
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
🔍 Quick Error Search - Search through error reports

Usage:
  node scripts/quickErrorSearch.cjs <search-term>
  node scripts/quickErrorSearch.cjs pattern <pattern-type>

Examples:
  node scripts/quickErrorSearch.cjs "Property"
  node scripts/quickErrorSearch.cjs "TS2551"
  node scripts/quickErrorSearch.cjs pattern property
  node scripts/quickErrorSearch.cjs pattern import

Available Patterns:
  • property   - Property access errors
  • import     - Import/export errors  
  • type       - Type assignment errors
  • undefined  - Undefined value errors
  • any        - Any type errors
  • unused     - Unused variable errors
  • duplicate  - Duplicate identifier errors

Options:
  --help, -h   Show this help message
`);
  }
}

// Command line interface
if (require.main === module) {
  const searcher = new QuickErrorSearch();
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    searcher.showHelp();
    process.exit(0);
  }

  const command = args[0];
  
  if (command === 'pattern' && args[1]) {
    searcher.searchByPattern(args[1]).catch(console.error);
  } else if (command) {
    searcher.searchReports(command).catch(console.error);
  } else {
    console.log('❌ Please provide a search term or pattern');
    searcher.showHelp();
  }
}

module.exports = QuickErrorSearch;