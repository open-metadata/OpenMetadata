/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// This script replaces 'cross-env' and 'start-server-and-test'
// It starts the Vite server with coverage, waits for it, runs tests, and then kills the server.

const { spawn } = require('child_process');
const http = require('http');

const PORT = 3001;
const SERVER_URL = `http://localhost:${PORT}`;

// Helper to spawn processes with color output
const spawnProcess = (command, args, env = {}) => {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
};

const checkServer = (url) => {
  return new Promise((resolve) => {
    http
      .get(url, (res) => {
        resolve(res.statusCode === 200);
      })
      .on('error', () => {
        resolve(false);
      });
  });
};

const waitForServer = async (url, timeout = 60000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await checkServer(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
};

const main = async () => {
  const args = process.argv.slice(2);
  console.log(`🚀 Starting Vite Server on port ${PORT} with VITE_COVERAGE=true...`);

  // Start Server
  const server = spawnProcess('yarn', ['run', 'start', '--port', PORT, '--no-open'], {
    VITE_COVERAGE: 'true',
  });

  try {
    const isReady = await waitForServer(SERVER_URL);
    if (!isReady) {
      throw new Error(`Server failed to start on ${SERVER_URL} within timeout`);
    }

    console.log('✅ Server is ready. Running tests...');

    // Run Tests
    // We break apart 'test:e2e:coverage' so we can pass args specifically to playwright
    // 1. Run Playwright
    const testArgs = ['run', 'playwright:coverage', ...args];
    const tests = spawnProcess('yarn', testArgs, {
      PLAYWRIGHT_TEST_BASE_URL: SERVER_URL,
    });

    let testExitCode = 0;
    try {
        await new Promise((resolve, reject) => {
        tests.on('exit', (code) => {
            testExitCode = code;
            resolve();
        });
        });
    } catch (e) {
        testExitCode = 1;
    }

    if (testExitCode === 0) {
        console.log('✅ Tests passed.');
    } else {
        console.log(`⚠️ Tests failed with exit code ${testExitCode}. Proceeding to report generation...`);
    }

    console.log('Generating coverage report...');

    // 2. Generate Report
    const report = spawnProcess('yarn', ['run', 'coverage:report']);
    
    await new Promise((resolve, reject) => {
      report.on('exit', (code) => {
         if (code === 0) resolve();
         else reject(new Error(`Report generation failed with exit code ${code}`));
      });
    });

    console.log('🎉 All CI steps completed.');
    
    // If tests failed, we should still exit with error code after reporting
    if (testExitCode !== 0) {
        throw new Error(`Tests failed (exit code ${testExitCode})`);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    console.log('🛑 Stopping server...');
    // Kill the entire process group to ensure vite and children die
    try {
        process.kill(-server.pid); 
    } catch (e) {
        server.kill();
    }
  }
};

main();
