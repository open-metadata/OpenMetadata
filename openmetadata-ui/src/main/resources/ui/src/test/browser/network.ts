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
// Every /api request the page has sent and not yet seen answered, counted
// where the page sends it. MSW's worker events arrive later, through the
// service worker; a request started while setup.ts unmounts a page (the
// unmount flushes its pending effects) could be missed by them and land
// unhandled in the next test. Vite module and asset requests are left out.
const isApi = (url: string | URL) =>
  new URL(url, globalThis.location.href).pathname.startsWith('/api/');
let inFlight = 0;
let lastActivity = Date.now();
const track = (url: string | URL) => {
  if (!isApi(url)) {
    return () => undefined;
  }
  inFlight++;
  lastActivity = Date.now();
  let ended = false;

  return () => {
    if (!ended) {
      ended = true;
      inFlight--;
      lastActivity = Date.now();
    }
  };
};

const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const end = track(input instanceof Request ? input.url : input);

  return nativeFetch(input, init).finally(end);
};

// axios sends through XMLHttpRequest.
const requestUrls = new WeakMap<XMLHttpRequest, string | URL>();
const nativeOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (
  this: XMLHttpRequest,
  ...args: Parameters<XMLHttpRequest['open']>
) {
  requestUrls.set(this, args[1]);

  return nativeOpen.apply(this, args as Parameters<typeof nativeOpen>);
} as XMLHttpRequest['open'];
const nativeSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.send = function (body) {
  const url = requestUrls.get(this);
  if (url !== undefined) {
    this.addEventListener('loadend', track(url), { once: true });
  }

  return nativeSend.call(this, body);
};

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
 *
 * It first yields one task: axios runs its interceptors as promise jobs
 * before it sends, so a request the page has just started is only counted
 * once those have run.
 */
export const networkIdle = async () => {
  await new Promise((resolve) => setTimeout(resolve));

  return until(
    () => inFlight === 0 && Date.now() - lastActivity >= 150,
    10_000,
    'requests to finish'
  );
};
