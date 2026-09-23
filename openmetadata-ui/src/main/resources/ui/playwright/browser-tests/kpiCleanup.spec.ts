/*
 *  Copyright 2026 Collate.
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
import { expect, test } from '@playwright/test';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { deleteKpiRequest } from '../utils/dataInsight';

test('KPI cleanup preserves another worker’s records', async ({
  playwright,
}) => {
  const ids = new Set(['owned', 'another-worker']);
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const id = path.split('/').pop() ?? '';
    response.setHeader('Content-Type', 'application/json');
    if (request.method === 'GET' && path === '/api/v1/kpi') {
      response.end(
        JSON.stringify({ data: [...ids].map((value) => ({ id: value })) })
      );
    } else if (request.method === 'DELETE') {
      response.statusCode = ids.delete(id) ? 200 : 404;
      response.end('{}');
    } else {
      response.statusCode = ids.has(id) ? 200 : 404;
      response.end(JSON.stringify({ id }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const api = await playwright.request.newContext({
    baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  });
  try {
    await deleteKpiRequest(api, ['owned']);
    expect((await api.get('/api/v1/kpi/owned')).status()).toBe(404);
    expect((await api.get('/api/v1/kpi/another-worker')).status()).toBe(200);

    await deleteKpiRequest(api, ['owned']);
    expect((await api.get('/api/v1/kpi/another-worker')).status()).toBe(200);
  } finally {
    await api.dispose();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('KPI cleanup reports the original HTTP failure', async ({
  playwright,
}) => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests++;
    response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: 'KPI storage unavailable' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const api = await playwright.request.newContext({
    baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  });
  try {
    await expect(deleteKpiRequest(api, ['owned'])).rejects.toThrow(
      /503.*KPI storage unavailable/
    );
    expect(requests).toBe(1);
  } finally {
    await api.dispose();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
