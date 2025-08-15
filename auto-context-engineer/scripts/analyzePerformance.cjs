#!/usr/bin/env node

/**
 * Performance analysis script (no build required)
 */

const fs = require('fs');
const path = require('path');

class PerformanceAnalyzer {
  constructor() {
    this.metrics = {
      codeComplexity: {},
      dependencies: {},
      fileCount: 0,
      totalLines: 0
    };
    this.recommendations = [];
  }

  analyze() {
    console.log('🚀 Starting performance analysis...\n');
    
    this.analyzeCodeComplexity();
    this.analyzeDependencies();
    this.checkOptimizations();
    this.generateReport();
  }

  analyzeCodeComplexity() {
    console.log('📊 Analyzing code complexity...');
    
    const srcPath = path.join(__dirname, '../src');
    if (!fs.existsSync(srcPath)) {
      console.log('❌ Source directory not found');
      return;
    }

    const files = this.getAllFiles(srcPath, '.ts', '.tsx');
    let totalLines = 0;
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalComponents = 0;

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n').length;
      const functions = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
      const classes = (content.match(/class\s+\w+/g) || []).length;
      const components = (content.match(/export\s+const\s+\w+.*React\.FC|export\s+function\s+\w+.*\(/g) || []).length;

      totalLines += lines;
      totalFunctions += functions;
      totalClasses += classes;
      totalComponents += components;
    });

    this.metrics.codeComplexity = {
      totalFiles: files.length,
      totalLines,
      totalFunctions,
      totalClasses,
      totalComponents,
      avgLinesPerFile: Math.round(totalLines / files.length),
      avgFunctionsPerFile: Math.round(totalFunctions / files.length)
    };

    console.log(`  📁 Files: ${files.length}`);
    console.log(`  📝 Lines: ${totalLines}`);
    console.log(`  🔧 Functions: ${totalFunctions}`);
    console.log(`  🏗️  Classes: ${totalClasses}`);
    console.log(`  ⚛️  Components: ${totalComponents}`);
    console.log(`  📊 Avg lines/file: ${this.metrics.codeComplexity.avgLinesPerFile}`);

    // Recommendations
    if (this.metrics.codeComplexity.avgLinesPerFile > 300) {
      this.recommendations.push('Some files are large (>300 lines). Consider breaking them into smaller modules.');
    }

    if (totalComponents > 50) {
      this.recommendations.push('Large number of components. Consider component composition and reusability.');
    }
  }

  analyzeDependencies() {
    console.log('\n📦 Analyzing dependencies...');
    
    const packageJsonPath = path.join(__dirname, '../package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log('❌ package.json not found');
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = Object.keys(packageJson.dependencies || {});
    const devDeps = Object.keys(packageJson.devDependencies || {});

    this.metrics.dependencies = {
      production: deps.length,
      development: devDeps.length,
      total: deps.length + devDeps.length
    };

    console.log(`  📦 Production: ${deps.length}`);
    console.log(`  🛠️  Development: ${devDeps.length}`);
    console.log(`  📊 Total: ${deps.length + devDeps.length}`);

    // Check for heavy dependencies
    const heavyDeps = ['lodash', 'moment', 'jquery', 'bootstrap'];
    const foundHeavyDeps = deps.filter(dep => heavyDeps.some(heavy => dep.includes(heavy)));

    if (foundHeavyDeps.length > 0) {
      this.recommendations.push(`Heavy dependencies found: ${foundHeavyDeps.join(', ')}. Consider lighter alternatives.`);
    }

    // Check for potential optimizations
    if (deps.includes('react') && !deps.includes('react-dom')) {
      this.recommendations.push('React found without react-dom. Ensure proper React setup.');
    }
  }

  checkOptimizations() {
    console.log('\n🔍 Checking for optimizations...');
    
    const optimizationFiles = [
      'src/utils/performanceOptimizer.ts',
      'src/services/performance/optimizationService.ts',
      'src/services/analytics/optimizedAnalyticsService.ts',
      'src/utils/reactOptimizations.tsx',
      'webpack.optimization.config.js'
    ];

    const existingOptimizations = optimizationFiles.filter(file => 
      fs.existsSync(path.join(__dirname, '..', file))
    );

    console.log(`  ✅ Optimization files found: ${existingOptimizations.length}/${optimizationFiles.length}`);
    
    existingOptimizations.forEach(file => {
      console.log(`    - ${file}`);
    });

    const missingOptimizations = optimizationFiles.filter(file => 
      !fs.existsSync(path.join(__dirname, '..', file))
    );

    if (missingOptimizations.length > 0) {
      this.recommendations.push(`Missing optimization files: ${missingOptimizations.join(', ')}`);
    }

    // Check for React optimizations in components
    this.checkReactOptimizations();
  }

  checkReactOptimizations() {
    const srcPath = path.join(__dirname, '../src');
    const componentFiles = this.getAllFiles(srcPath, '.tsx').filter(file => 
      !file.includes('test') && !file.includes('spec')
    );

    let memoizedComponents = 0;
    let totalComponents = 0;

    componentFiles.forEach(file => {
      const content = fs.readFileSync(file, 'utf8');
      const components = content.match(/export\s+const\s+\w+.*React\.FC/g) || [];
      const memoized = content.includes('memo(') || content.includes('React.memo');
      
      totalComponents += components.length;
      if (memoized && components.length > 0) {
        memoizedComponents += components.length;
      }
    });

    if (totalComponents > 0) {
      const memoizationRate = (memoizedComponents / totalComponents) * 100;
      console.log(`  ⚛️  Component memoization: ${memoizationRate.toFixed(1)}% (${memoizedComponents}/${totalComponents})`);
      
      if (memoizationRate < 50) {
        this.recommendations.push('Low component memoization rate. Consider using React.memo for better performance.');
      }
    }
  }

  generateReport() {
    console.log('\n📊 Performance Analysis Results');
    console.log('================================');

    // Calculate scores
    const complexityScore = this.getComplexityScore();
    const optimizationScore = this.getOptimizationScore();
    const overallScore = Math.round((complexityScore + optimizationScore) / 2);

    console.log(`\n🎯 Scores:`);
    console.log(`  Code Complexity: ${complexityScore}/100`);
    console.log(`  Optimization: ${optimizationScore}/100`);
    console.log(`  Overall: ${overallScore}/100`);

    if (this.recommendations.length > 0) {
      console.log(`\n💡 Recommendations (${this.recommendations.length}):`);
      this.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    } else {
      console.log('\n✅ No major performance issues found!');
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      scores: {
        complexity: complexityScore,
        optimization: optimizationScore,
        overall: overallScore
      },
      recommendations: this.recommendations
    };

    const reportPath = path.join(__dirname, '../performance-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📄 Detailed report saved to: performance-analysis.json`);
    console.log(`\n🎉 Analysis complete! Overall score: ${overallScore}/100`);
  }

  getComplexityScore() {
    const avgLines = this.metrics.codeComplexity.avgLinesPerFile || 0;
    if (avgLines < 100) return 100;
    if (avgLines < 200) return 80;
    if (avgLines < 300) return 60;
    if (avgLines < 500) return 40;
    return 20;
  }

  getOptimizationScore() {
    const optimizationFiles = [
      'src/utils/performanceOptimizer.ts',
      'src/services/performance/optimizationService.ts',
      'src/utils/reactOptimizations.tsx'
    ];

    const existingCount = optimizationFiles.filter(file => 
      fs.existsSync(path.join(__dirname, '..', file))
    ).length;

    const baseScore = (existingCount / optimizationFiles.length) * 100;
    const penaltyPerRecommendation = 5;
    const penalty = Math.min(this.recommendations.length * penaltyPerRecommendation, 50);

    return Math.max(0, Math.round(baseScore - penalty));
  }

  getAllFiles(dir, ...extensions) {
    const files = [];
    
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
        files.push(...this.getAllFiles(fullPath, ...extensions));
      } else if (stat.isFile()) {
        if (extensions.length === 0 || extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    });
    
    return files;
  }
}

// Run analysis
const analyzer = new PerformanceAnalyzer();
analyzer.analyze();