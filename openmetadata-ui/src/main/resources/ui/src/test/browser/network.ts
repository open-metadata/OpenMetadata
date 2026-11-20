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
import { worker } from './msw';

// Every /api request MSW is answering, and when one last started or ended.
// The service worker also sees Vite module and asset requests; those are not
// the page fetching data, so they are left out.
const isApi = (request: Request) =>
  new URL(request.url).pathname.startsWith('/api/');
const inFlight = new Set<string>();
let lastActivity = Date.now();
worker.events.on('request:start', ({ request, requestId }) => {
  if (isApi(request)) {
    inFlight.add(requestId);
    lastActivity = Date.now();
  }
});
worker.events.on('request:end', ({ request, requestId }) => {
  if (isApi(request)) {
    inFlight.delete(requestId);
    lastActivity = Date.now();
  }
});

/** Polls `ready` until it holds; unlike expect.poll it also runs in beforeAll. */
export const until = async (
  ready: () => boolean,
  timeoutMs: number,
  what: string
) => {
  const deadline = Date.now() + timeoutMs;
  while (!ready()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

/**
 * Waits until the page has stopped fetching: nothing in flight and no new
 * request for a short quiet window. A request count ("one fetch per page
 * change") is only final once this holds; there is no event for "no further
 * request is coming", so the quiet window is the condition. A fetch that
 * starts more than 150 ms later (a long debounce) can slip past it.
 */
export const networkIdle = () =>
  until(
    () => inFlight.size === 0 && Date.now() - lastActivity >= 150,
    10_000,
    'requests to finish'
  );
