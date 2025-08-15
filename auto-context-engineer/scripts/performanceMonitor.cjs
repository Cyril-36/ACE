#!/usr/bin/env node

/**
 * Performance monitoring script for development
 */

const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      buildTimes: [],
      bundleSize: 0,
      testTimes: [],
      memoryUsage: [],
    };
    this.startTime = Date.now();
  }

  async monitorBuild() {
    console.log('🔍 Starting performance monitoring...');
    
    const buildStart = Date.now();
    
    try {
      // Run build and measure time
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('npm run build', (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
      
      const buildTime = Date.now() - buildStart;
      this.metrics.buildTimes.push(buildTime);
      
      console.log(`✅ Build completed in ${buildTime}ms`);
      
      // Measure bundle size
      await this.measureBundleSize();
      
      // Run tests and measure time
      await this.measureTestPerformance();
      
      // Generate report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Performance monitoring failed:', error);
    }
  }

  async measureBundleSize() {
    const distPath = path.join(__dirname, '..', 'dist');
    
    if (!fs.existsSync(distPath)) {
      console.warn('⚠️ Dist directory not found, skipping bundle size measurement');
      return;
    }

    let totalSize = 0;
    const files = this.getAllFiles(distPath);
    
    files.forEach(file => {
      const stats = fs.statSync(file);
      totalSize += stats.size;
    });
    
    this.metrics.bundleSize = totalSize;
    console.log(`📦 Bundle size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  }

  async measureTestPerformance() {
    console.log('🧪 Running performance tests...');
    
    const testStart = Date.now();
    
    try {
      const { exec } = require('child_process');
      await new Promise((resolve, reject) => {
        exec('npm run test:performance', (error, stdout, stderr) => {
          if (error) {
            console.warn('⚠️ Performance tests failed, continuing...');
            resolve(stdout);
          } else {
            resolve(stdout);
          }
        });
      });
      
      const testTime = Date.now() - testStart;
      this.metrics.testTimes.push(testTime);
      
      console.log(`✅ Performance tests completed in ${testTime}ms`);
      
    } catch (error) {
      console.warn('⚠️ Could not run performance tests:', error.message);
    }
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

  generateReport() {
    const totalTime = Date.now() - this.startTime;
    
    const report = {
      timestamp: new Date().toISOString(),
      totalMonitoringTime: totalTime,
      metrics: this.metrics,
      recommendations: this.getRecommendations(),
    };
    
    // Save report
    const reportPath = path.join(__dirname, '..', 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 Performance Report:');
    console.log(`⏱️  Total monitoring time: ${totalTime}ms`);
    console.log(`🏗️  Average build time: ${this.getAverageBuildTime()}ms`);
    console.log(`📦 Bundle size: ${(this.metrics.bundleSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🧪 Average test time: ${this.getAverageTestTime()}ms`);
    
    if (this.getRecommendations().length > 0) {
      console.log('\n💡 Recommendations:');
      this.getRecommendations().forEach(rec => {
        console.log(`   • ${rec}`);
      });
    }
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  }

  getAverageBuildTime() {
    if (this.metrics.buildTimes.length === 0) return 0;
    return Math.round(this.metrics.buildTimes.reduce((a, b) => a + b, 0) / this.metrics.buildTimes.length);
  }

  getAverageTestTime() {
    if (this.metrics.testTimes.length === 0) return 0;
    return Math.round(this.metrics.testTimes.reduce((a, b) => a + b, 0) / this.metrics.testTimes.length);
  }

  getRecommendations() {
    const recommendations = [];
    
    // Build time recommendations
    const avgBuildTime = this.getAverageBuildTime();
    if (avgBuildTime > 30000) {
      recommendations.push('Consider optimizing build configuration - build time is over 30 seconds');
    }
    
    // Bundle size recommendations
    const bundleSizeMB = this.metrics.bundleSize / 1024 / 1024;
    if (bundleSizeMB > 5) {
      recommendations.push('Bundle size is large (>5MB) - consider code splitting and tree shaking');
    }
    
    // Test time recommendations
    const avgTestTime = this.getAverageTestTime();
    if (avgTestTime > 10000) {
      recommendations.push('Test execution time is slow - consider parallelization or test optimization');
    }
    
    return recommendations;
  }
}

// Run monitoring if called directly
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.monitorBuild().catch(console.error);
}

module.exports = PerformanceMonitor;