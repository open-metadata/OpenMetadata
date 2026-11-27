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
import axios from 'axios';
import { delay, http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';
import { worker } from './msw';
import { networkIdle } from './network';

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

// setup.ts's afterEach unmounts the page, then waits for networkIdle before it
// resets the handlers. Unmounting flushes the page's pending effects, so a
// request can start in the same tick networkIdle is first checked. It must
// count from the moment the page sends it, not from when the service worker
// reports it, or the request lands unhandled in the next test.
test.each([
  ['fetch', () => fetch('/api/v1/network-idle-probe')],
  ['XMLHttpRequest (axios)', () => axios.get('/api/v1/network-idle-probe')],
])(
  'networkIdle waits for a %s request sent just before it',
  async (_, send) => {
    let answered = false;
    worker.use(
      http.get('/api/v1/network-idle-probe', async () => {
        await delay(200);
        answered = true;

        return HttpResponse.json({});
      })
    );
    // No API activity for longer than the quiet window.
    await settle();

    const request = send();
    await networkIdle();

    expect(answered).toBe(true);

    await request;
  }
);
