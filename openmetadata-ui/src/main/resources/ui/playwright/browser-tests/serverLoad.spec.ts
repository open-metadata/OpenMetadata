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
import { createServer, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import { test as serverLoadTest } from '../support/fixtures/base';
import { installServerLoadReducers } from '../support/fixtures/serverLoad';

const configPath = '/api/v1/system/settings/lineageSettings';

serverLoadTest(
  'fixture teardown accepts an explicitly closed context',
  async ({ context, page }) => {
    await context.close();

    expect(page.isClosed()).toBe(true);
  }
);

for (const order of ['read-before-write', 'read-during-write'] as const) {
  test(`boot cache preserves a write with an overlapping ${order}`, async ({
    page,
  }) => {
    let version = 0;
    let reads = 0;
    let heldRead: ServerResponse | undefined;
    let heldWrite: ServerResponse | undefined;
    let readStarted!: () => void;
    let writeStarted!: () => void;
    const reading = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    const writing = new Promise<void>((resolve) => {
      writeStarted = resolve;
    });
    const respond = (response: ServerResponse, value: number) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ version: value }));
    };
    const server = createServer((request, response) => {
      if (request.url !== configPath) {
        response.end('<html></html>');
      } else if (request.method === 'PUT') {
        heldWrite = response;
        writeStarted();
      } else {
        reads++;
        if (reads === 1 && order === 'read-before-write') {
          heldRead = response;
          readStarted();
        } else {
          respond(response, version);
        }
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    try {
      await installServerLoadReducers(page.context());
      await page.goto(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        { waitUntil: 'domcontentloaded' }
      );
      const read = () =>
        page.evaluate(async (url) => (await fetch(url)).json(), configPath);
      let oldRead: Promise<{ version: number }> | undefined;
      if (order === 'read-before-write') {
        oldRead = read();
        await reading;
      }
      const write = page.evaluate(
        async (url) => (await fetch(url, { method: 'PUT' })).json(),
        configPath
      );
      await writing;
      if (order === 'read-during-write') {
        expect(await read()).toEqual({ version: 0 });
      }
      version = 1;
      respond(heldWrite!, version);
      await write;
      if (heldRead) {
        respond(heldRead, 0);
        expect(await oldRead).toEqual({ version: 0 });
      }
      expect(await read()).toEqual({ version: 1 });
      expect(await read()).toEqual({ version: 1 });
      expect(reads).toBe(2);
    } finally {
      heldRead?.destroy();
      heldWrite?.destroy();
      await page.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}

test('closing a context cancels an in-flight boot config request cleanly', async ({
  browser,
}) => {
  let heldResponse: ServerResponse | undefined;
  let startRead!: () => void;
  const reading = new Promise<void>((resolve) => {
    startRead = resolve;
  });
  const server = createServer((request, response) => {
    if (request.url?.startsWith(configPath)) {
      heldResponse = response;
      startRead();
    } else response.end('<html></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const context = await browser.newContext();
  try {
    await installServerLoadReducers(context);
    const page = await context.newPage();
    await page.goto(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      { waitUntil: 'domcontentloaded' }
    );
    await page.evaluate((url) => {
      void fetch(url).catch(() => undefined);
    }, configPath);
    await reading;
    const closing = context.close();
    heldResponse!.end(JSON.stringify({ version: 0 }));
    await closing;
    expect(page.isClosed()).toBe(true);
  } finally {
    heldResponse?.destroy();
    await context.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('boot config HTTP failures stay visible and are not cached', async ({
  page,
}) => {
  let reads = 0;
  const server = createServer((request, response) => {
    if (request.url === configPath) {
      reads++;
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'configuration unavailable' }));
    } else response.end('<html></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await installServerLoadReducers(page.context());
    await page.goto(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      { waitUntil: 'domcontentloaded' }
    );
    const read = () =>
      page.evaluate(async (url) => {
        const response = await fetch(url);
        return { status: response.status, body: await response.json() };
      }, configPath);
    expect(await read()).toEqual({
      status: 503,
      body: { error: 'configuration unavailable' },
    });
    expect(await read()).toEqual({
      status: 503,
      body: { error: 'configuration unavailable' },
    });
    expect(reads).toBe(2);
  } finally {
    await page.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('static asset caching is opt-in across browser contexts', async ({
  browser,
}) => {
  const assetPath = '/assets/static-cache-default.js';
  const assetBody = 'window.staticCacheDefault = true;';
  const expectedReads = process.env.PW_CACHE_STATIC_ASSETS === 'true' ? 1 : 2;
  let reads = 0;
  const server = createServer((request, response) => {
    if (request.url === assetPath) {
      reads++;
      response.writeHead(200, { 'Content-Type': 'application/javascript' });
      response.end(assetBody);
    } else {
      response.end('<html></html>');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const loadAsset = async () => {
    const context = await browser.newContext();

    try {
      await installServerLoadReducers(context);
      const page = await context.newPage();
      await page.goto(origin, { waitUntil: 'domcontentloaded' });

      const asset = await page.evaluate(
        async (url) => (await fetch(url)).text(),
        `${origin}${assetPath}`
      );

      return asset;
    } finally {
      await context.close();
    }
  };

  try {
    expect(await loadAsset()).toBe(assetBody);
    expect(await loadAsset()).toBe(assetBody);
    expect(reads).toBe(expectedReads);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test('a reset intercepted connection fails in the browser without retrying or caching it', async ({
  page,
}) => {
  const interceptedPath =
    process.env.PW_CACHE_STATIC_ASSETS === 'true'
      ? '/assets/reset-connection.js'
      : configPath;
  let reads = 0;
  let healthy = false;
  const server = createServer((request, response) => {
    if (request.url !== interceptedPath) {
      response.end('<html></html>');

      return;
    }

    reads++;
    if (!healthy) {
      request.socket.destroy();

      return;
    }

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ version: 1 }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await installServerLoadReducers(page.context());
    await page.goto(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      { waitUntil: 'domcontentloaded' }
    );
    const failedRequest = page.waitForEvent('requestfailed', {
      predicate: (request) =>
        new URL(request.url()).pathname === interceptedPath,
    });
    const failure = await page.evaluate(async (url) => {
      try {
        await fetch(url);

        return 'resolved';
      } catch (error) {
        return error instanceof Error ? error.name : String(error);
      }
    }, interceptedPath);

    expect(failure).toBe('TypeError');
    expect((await failedRequest).failure()?.errorText).toBe(
      'net::ERR_CONNECTION_RESET'
    );
    expect(reads).toBe(1);

    healthy = true;
    const read = () =>
      page.evaluate(async (url) => (await fetch(url)).json(), interceptedPath);
    expect(await read()).toEqual({ version: 1 });
    expect(await read()).toEqual({ version: 1 });
    expect(reads).toBe(2);
  } finally {
    await page.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});
