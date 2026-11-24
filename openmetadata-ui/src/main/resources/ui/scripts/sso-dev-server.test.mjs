/*
 *  Copyright 2025 Collate.
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
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { realpathSync } from 'node:fs';
import vm from 'node:vm';
import { createServer, loadConfigFromFile } from 'vite';

test('SSO development URLs and callback routing use the configured public origin', async () => {
  const backend = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ method: req.method, host: req.headers.host }));
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const previous = { ...process.env };
  let server;
  try {
    const target = `http://127.0.0.1:${backend.address().port}`;
    process.env.VITE_DEV_SERVER_TARGET = target;
    process.env.DEV_SERVER_TARGET = 'http://localhost:1';
    process.env.VITE_SSO_SERVER_URL = 'http://localhost:3002';
    const { config } = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      './vite.config.ts'
    );
    assert.equal(
      JSON.parse(config.define['process.env.DEV_SERVER_TARGET']),
      target
    );
    assert.equal(
      JSON.parse(config.define['process.env.SSO_SERVER_URL']),
      'http://localhost:3002'
    );
    // Exercise the real config's proxy and browser substitutions without loading the full SPA.
    server = await createServer({
      configFile: false,
      appType: 'custom',
      define: config.define,
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { host: '127.0.0.1', port: 0, proxy: config.server.proxy },
    });
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/callback')) res.end('SPA callback');
      else next();
    });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const [method, path] of [
      ['POST', '/callback'],
      ['GET', '/callback?state=omtest%3Asession'],
    ]) {
      const response = await fetch(origin + path, { method });
      assert.deepEqual(await response.json(), {
        method,
        host: new URL(origin).host,
      });
    }
    assert.equal(
      await (await fetch(origin + '/callback?state=ordinary')).text(),
      'SPA callback'
    );
    const injected = await server.transformRequest(
      '/@fs/' + realpathSync('node_modules/vite/dist/client/env.mjs')
    );
    const browser = { process: { env: {} } };
    vm.runInNewContext(injected.code, browser);
    assert.equal(browser.process.env.SSO_SERVER_URL, 'http://localhost:3002');
    assert.equal(browser.process.env.DEV_SERVER_TARGET, target);
  } finally {
    process.env = previous;
    await server?.close();
    await new Promise((resolve) => backend.close(resolve));
  }
});
