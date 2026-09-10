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
import { installServerLoadReducers } from '../support/fixtures/serverLoad';

const configPath = '/api/v1/system/settings/lineageSettings';

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
        `http://127.0.0.1:${(server.address() as AddressInfo).port}`
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
