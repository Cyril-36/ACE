#!/usr/bin/env node

/**
 * Generate comprehensive performance report
 */

const fs = require('fs');
const path = require('path');

class PerformanceReporter {
  constructor() {
    this.reportData = {
      timestamp: new Date().toISOString(),
      version: this.getPackageVersion(),
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      metrics: {},
      analysis: {},
      recommendations: [],
    };
  }

  async generateReport() {
    console.log('📊 Generating comprehensive performance report...');
    
    try {
      // Analyze bundle
      await this.analyzeBundleSize();
      
      // Analyze dependencies
      await this.analyzeDependencies();
      
      // Analyze test performance
      await this.analyzeTestPerformance();
      
      // Generate recommendations
      this.generateRecommendations();
      
      // Save report
      this.saveReport();
      
      console.log('✅ Performance report generated successfully');
      
    } catch (error) {
      console.error('❌ Failed to generate performance report:', error);
    }
  }

  async analyzeBundleSize() {
    console.log('📦 Analyzing bundle size...');
    
    const distPath = path.join(__dirname, '..', 'dist');
    
    if (!fs.existsSync(distPath)) {
      console.warn('⚠️ Dist directory not found, running build first...');
      
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('npm run build', (error, stdout, stderr) => {
          if (error) reject(error);
          else resolve(stdout);
        });
      });
    }

    const analysis = {
      totalSize: 0,
      files: [],
      largestFiles: [],
      fileTypes: {},
    };

    const files = this.getAllFiles(distPath);
    
    files.forEach(file => {
      const stats = fs.statSync(file);
      const relativePath = path.relative(distPath, file);
      const ext = path.extname(file);
      
      analysis.files.push({
        path: relativePath,
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024 * 100) / 100,
      });
      
      analysis.totalSize += stats.size;
      
      // Track file types
      if (!analysis.fileTypes[ext]) {
        analysis.fileTypes[ext] = { count: 0, totalSize: 0 };
      }
      analysis.fileTypes[ext].count++;
      analysis.fileTypes[ext].totalSize += stats.size;
    });

    // Find largest files
    analysis.largestFiles = analysis.files
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    analysis.totalSizeMB = Math.round(analysis.totalSize / 1024 / 1024 * 100) / 100;
    
    this.reportData.metrics.bundle = analysis;
    
    console.log(`   Total size: ${analysis.totalSizeMB} MB`);
    console.log(`   Files: ${analysis.files.length}`);
  }

  async analyzeDependencies() {
    console.log('📚 Analyzing dependencies...');
    
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageLockPath = path.join(__dirname, '..', 'package-lock.json');
    
    if (!fs.existsSync(packagePath)) {
      console.warn('⚠️ package.json not found');
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    const analysis = {
      dependencies: Object.keys(packageJson.dependencies || {}).length,
      devDependencies: Object.keys(packageJson.devDependencies || {}).length,
      totalDependencies: 0,
      heavyDependencies: [],
    };

    if (fs.existsSync(packageLockPath)) {
      const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
      
      if (packageLock.packages) {
        analysis.totalDependencies = Object.keys(packageLock.packages).length - 1; // Exclude root
        
        // Find potentially heavy dependencies
        const heavyPatterns = ['@types/', 'webpack', 'babel', 'eslint', 'typescript'];
        
        Object.keys(packageLock.packages).forEach(pkg => {
          if (pkg && heavyPatterns.some(pattern => pkg.includes(pattern))) {
            analysis.heavyDependencies.push(pkg.replace('node_modules/', ''));
          }
        });
      }
    }

    this.reportData.metrics.dependencies = analysis;
    
    console.log(`   Dependencies: ${analysis.dependencies}`);
    console.log(`   Dev dependencies: ${analysis.devDependencies}`);
    console.log(`   Total packages: ${analysis.totalDependencies}`);
  }

  async analyzeTestPerformance() {
    console.log('🧪 Analyzing test performance...');
    
    try {
      const { exec } = require('child_process');
      const testOutput = await new Promise((resolve, reject) => {
        exec('npm run test:coverage', (error, stdout, stderr) => {
          // Don't reject on test failures, we want the output
          resolve(stdout + stderr);
        });
      });

      const analysis = {
        hasTests: testOutput.includes('Test Files'),
        coverage: this.extractCoverageInfo(testOutput),
        performance: this.extractTestPerformance(testOutput),
      };

      this.reportData.metrics.tests = analysis;
      
      if (analysis.hasTests) {
        console.log(`   Coverage: ${analysis.coverage.statements || 'N/A'}% statements`);
        console.log(`   Test files: ${analysis.performance.testFiles || 'N/A'}`);
      } else {
        console.log('   No test results found');
      }
      
    } catch (error) {
      console.warn('⚠️ Could not analyze test performance:', error.message);
    }
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...');
    
    const recommendations = [];
    
    // Bundle size recommendations
    if (this.reportData.metrics.bundle) {
      const bundleMB = this.reportData.metrics.bundle.totalSizeMB;
      
      if (bundleMB > 10) {
        recommendations.push({
          type: 'bundle',
          priority: 'high',
          message: `Bundle size is very large (${bundleMB}MB). Consider aggressive code splitting and tree shaking.`,
        });
      } else if (bundleMB > 5) {
        recommendations.push({
          type: 'bundle',
          priority: 'medium',
          message: `Bundle size is large (${bundleMB}MB). Consider code splitting for better loading performance.`,
        });
      }

      // Check for large individual files
      const largeFiles = this.reportData.metrics.bundle.largestFiles.filter(f => f.sizeKB > 500);
      if (largeFiles.length > 0) {
        recommendations.push({
          type: 'bundle',
          priority: 'medium',
          message: `Found ${largeFiles.length} files larger than 500KB. Consider splitting: ${largeFiles.map(f => f.path).join(', ')}`,
        });
      }
    }

    // Dependencies recommendations
    if (this.reportData.metrics.dependencies) {
      const deps = this.reportData.metrics.dependencies;
      
      if (deps.totalDependencies > 1000) {
        recommendations.push({
          type: 'dependencies',
          priority: 'medium',
          message: `High number of dependencies (${deps.totalDependencies}). Consider auditing and removing unused packages.`,
        });
      }

      if (deps.heavyDependencies.length > 10) {
        recommendations.push({
          type: 'dependencies',
          priority: 'low',
          message: `Many heavy dependencies detected. Consider lighter alternatives where possible.`,
        });
      }
    }

    // Test recommendations
    if (this.reportData.metrics.tests) {
      const tests = this.reportData.metrics.tests;
      
      if (tests.coverage && tests.coverage.statements < 80) {
        recommendations.push({
          type: 'testing',
          priority: 'medium',
          message: `Test coverage is below 80% (${tests.coverage.statements}%). Consider adding more tests.`,
        });
      }
    }

    this.reportData.recommendations = recommendations;
    
    console.log(`   Generated ${recommendations.length} recommendations`);
  }

  saveReport() {
    const reportPath = path.join(__dirname, '..', 'performance-report-detailed.json');
    const htmlReportPath = path.join(__dirname, '..', 'performance-report.html');
    
    // Save JSON report
    fs.writeFileSync(reportPath, JSON.stringify(this.reportData, null, 2));
    
    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    fs.writeFileSync(htmlReportPath, htmlReport);
    
    console.log(`📄 JSON report saved to: ${reportPath}`);
    console.log(`🌐 HTML report saved to: ${htmlReportPath}`);
  }

  generateHTMLReport() {
    const data = this.reportData;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - Auto Context Engineer</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0; }
        .metric-title { font-weight: 600; color: #1e293b; margin-bottom: 8px; }
        .metric-value { font-size: 24px; font-weight: 700; color: #2563eb; }
        .recommendations { margin-top: 20px; }
        .recommendation { padding: 12px; margin: 8px 0; border-left: 4px solid; border-radius: 4px; }
        .rec-high { background: #fef2f2; border-color: #ef4444; }
        .rec-medium { background: #fffbeb; border-color: #f59e0b; }
        .rec-low { background: #f0f9ff; border-color: #3b82f6; }
        .file-list { max-height: 300px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 4px; }
        .file-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Report</h1>
            <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
            <p>Version: ${data.version}</p>
        </div>
        
        <div class="content">
            ${data.metrics.bundle ? `
            <div class="metric-card">
                <div class="metric-title">Bundle Analysis</div>
                <div class="metric-value">${data.metrics.bundle.totalSizeMB} MB</div>
                <p>${data.metrics.bundle.files.length} files total</p>
                
                <h4>Largest Files:</h4>
                <div class="file-list">
                    ${data.metrics.bundle.largestFiles.map(file => 
                        `<div class="file-item">
                            <span>${file.path}</span>
                            <span>${file.sizeKB} KB</span>
                        </div>`
                    ).join('')}
                </div>
            </div>
            ` : ''}
            
            ${data.metrics.dependencies ? `
            <div class="metric-card">
                <div class="metric-title">Dependencies</div>
                <div class="metric-value">${data.metrics.dependencies.totalDependencies}</div>
                <p>${data.metrics.dependencies.dependencies} runtime + ${data.metrics.dependencies.devDependencies} dev dependencies</p>
            </div>
            ` : ''}
            
            ${data.recommendations.length > 0 ? `
            <div class="recommendations">
                <h3>Recommendations</h3>
                ${data.recommendations.map(rec => 
                    `<div class="recommendation rec-${rec.priority}">
                        <strong>${rec.type.toUpperCase()}</strong> (${rec.priority} priority): ${rec.message}
                    </div>`
                ).join('')}
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>
    `;
  }

  getAllFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stats = fs.statSync(fullPath);
      
      if (stats.isDirectory()) {
        files.push(...this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    });
    
    return files;
  }

  getPackageVersion() {
    try {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageJson.version || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  extractCoverageInfo(output) {
    const coverage = {};
    
    // Extract coverage percentages
    const coverageMatch = output.match(/All files\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
      coverage.statements = parseFloat(coverageMatch[1]);
      coverage.branches = parseFloat(coverageMatch[2]);
      coverage.functions = parseFloat(coverageMatch[3]);
      coverage.lines = parseFloat(coverageMatch[4]);
    }
    
    return coverage;
  }

  extractTestPerformance(output) {
    const performance = {};
    
    // Extract test file count
    const testFilesMatch = output.match(/Test Files\s+(\d+)/);
    if (testFilesMatch) {
      performance.testFiles = parseInt(testFilesMatch[1]);
    }
    
    // Extract test count
    const testsMatch = output.match(/Tests\s+(\d+)/);
    if (testsMatch) {
      performance.tests = parseInt(testsMatch[1]);
    }
    
    return performance;
  }
}

// Run reporter if called directly
if (require.main === module) {
  const reporter = new PerformanceReporter();
  reporter.generateReport().catch(console.error);
}

module.exports = PerformanceReporter;