#!/usr/bin/env node

/**
 * Health check script for ThirdEye UI development
 * Similar to OpenMetadata's development configuration but for Next.js
 */

const process = require('process');

// Environment configuration like OpenMetadata development setup
const DEV_SERVER_TARGET = process.env.DEV_SERVER_TARGET ?? 'http://localhost:8585/';
const OPENMETADATA_BASE_URL = process.env.OPENMETADATA_BASE_URL || 'http://localhost:8585';

async function checkBackendHealth() {
  const targetUrl = DEV_SERVER_TARGET.replace(/\/$/, '') + '/health';
  
  console.log('🏥 Checking ThirdEye Backend Connectivity (OpenMetadata)...');
  console.log(`📡 Target: ${targetUrl}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const startTime = Date.now();
    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    clearTimeout(timeoutId);
    
    const latencyMs = Date.now() - startTime;
    
    if (response.ok) {
      console.log(`✅ Backend is healthy! (${latencyMs}ms)`);
      process.exit(0);
    } else {
      console.log(`❌ Backend returned ${response.status}`);
      console.log('   Check if OpenMetadata backend is running on', OPENMETADATA_BASE_URL);
      process.exit(1);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️  Backend timeout - Server might be starting up');
    } else {
      console.log('❌ Backend connection failed:', error.message);
    }
    
  console.log('');
  console.log('🔗 Quick Setup for ThirdEye UI:');
  console.log('   1. Start OpenMetadata backend:');
  console.log('      cd ../openmetadata-docker && docker-compose up');
  console.log('   2. Start ThirdEye UI:');
  console.log('      npm run dev:proxy');
  console.log('   3. Verify connectivity:');
  console.log('      npm run dev:health');
  console.log('   4. Open browser:');
  console.log('      http://localhost:3000');
    
    process.exit(1);
  }
}

checkBackendHealth();
