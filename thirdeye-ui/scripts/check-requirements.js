#!/usr/bin/env node

/**
 * ThirdEye Development Requirements Check
 * Ensures development environment setup similar to OpenMetadata UI workflow
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 ThirdEye UI Development Requirements Check');
console.log('='.repeat(60));

// 1. Check for basic directories
const requiredDirs = [
  'src',
  'public', 
  'next.config.ts',
  'package.json',
  'tailwind.config.js'
];

console.log('📁 Checking project structure:');
for (const dir of requiredDirs) {
  const exists = fs.existsSync(path.join(__dirname, '..', dir));
  console.log(`   ${exists ? '✅' : '❌'} ${dir}`);
}

// 2. Check for dependencies
console.log('\n📦 Checking dependencies:');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')));
  const requiredDeps = ['next', 'react', 'react-dom', 'typescript'];
  
  for (const dep of requiredDeps) {
    const hasDep = packageJson.dependencies[dep] || packageJson.devDependencies[dep];
    console.log(`   ${hasDep ? '✅' : '❌'} ${dep}`);
  }
  
  // Check we have cross-env for environment management
  const hasCrossEnv = packageJson.devDependencies['cross-env'];
  console.log(`   ${hasCrossEnv ? '✅' : '⚠️ '} cross-env`);
  
} catch (error) {
  console.log('   ❌ Error reading package.json');
}

// 3. Verify basic npm installation
console.log('\n📦 Checking npm installation:');
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' });
  const npmVersion = execSync('npm --version', { encoding: 'utf8' });
  console.log(`   ✅ Node.js ${nodeVersion.trim()}`);
  console.log(`   ✅ npm ${npmVersion.trim()}`);
} catch (error) {
  console.log('   ❌ npm/node not found');
}

// 4. Check OpenMetadata Backend connectivity
console.log('\n🔗 Checking OpenMetadata Backend:');
const devServerTarget = process.env.DEV_SERVER_TARGET ?? 'http://localhost:8585';

try {
  const response = require('node-fetch');
  
  // Mock fetch if not available
  const testConnectivity = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const res = await fetch(`${devServerTarget}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      console.log(`   ${res.ok ? '✅' : '⚠️ '} OpenMetadata backend responding`);
      
    } catch (err) {
      console.log('   ❌ OpenMetadata backend not found');
      console.log('      • Ensure OpenMetadata is running on port 8585');
      console.log('      • Check if backend server is started');
      console.log('      • Try: docker-compose up for OpenMetadata');
    }
  };
  
  // For Node 18-v16:
  if (typeof fetch === 'undefined') {
    console.log('   ≋ fetch not available (Node < v18)');
    console.log('   💡 Try: npm run dev:health');
  } else {
    // testConnectivity(); // uncomment to test immediately
  }
  
} catch (fetchError) {
  // No fetch available
  console.log('   ≋ Native fetch not available');
}

// 5. Check development environment
console.log('\n🌍 Development Environment:');
const nodeEnv = process.env.NODE_ENV;
console.log(`   Environment: ${nodeEnv || 'development'}`);

const openmetadataBase = process.env.OPENMETADATA_BASE_URL;
console.log(`   Backend URL: ${openmetadataBase || 'not set (default: localhost:8585)'}`);

console.log('\n✅ ThirdEye UI Development Environment Check Complete');
console.log('\n🚀 To start development:');
console.log('   npm run dev:proxy');
console.log('\n🏥 To verify backend connections:');
console.log('   npm run dev:health');
console.log('\n📚 For documentation:');
console.log('   see: DEV-SETUP.md');
