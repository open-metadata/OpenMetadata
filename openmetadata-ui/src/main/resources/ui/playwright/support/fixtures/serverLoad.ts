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
import { BrowserContext, Route } from '@playwright/test';

/**
 * Reduces the server load a Playwright shard generates.
 *
 * Measured over six chromium shards of a merge_group run: 16,892 API calls per
 * shard, of which 8,497 (50%) were boot/config endpoints refetched ~473 times
 * with byte-identical responses, and 780 were analytics writes nothing asserts
 * on. `apiServerMs` was 10.8-39.5 minutes per shard against a 20-minute
 * execution budget, and that spread is the contention behind the timeout
 * failures — the server does more work than the tests have time for.
 *
 * Everything here is per-worker and read-through: the first request still hits
 * the real server, so a cached response can never drift from it the way a
 * hand-written stub body would.
 */

/** Analytics collection is a write, and no test asserts on the stored events. */
const ANALYTICS_COLLECT = '**/api/v1/analytics/web/events/collect';

/**
 * Boot endpoints safe to serve from the per-worker cache.
 *
 * Two things have to hold for a path to be listed here. It must have no writer
 * that bypasses the browser — an `apiContext.patch()` in a `beforeAll` is
 * invisible to the request listener below, so the cache would go stale with no
 * way to notice. And any write that *does* go through the browser must land
 * under the same `/api/v1/<family>/` prefix, so `invalidateFamily` clears it.
 *
 * Deliberately excluded, with the reason, because this list is the whole
 * correctness surface:
 *
 * - `permissions` — 595 files reference it, and it changes as a side effect of
 *   writes to `roles`, `policies` and `users`, none of which share its prefix.
 *   Not invalidatable, and the blast radius is the entire suite.
 * - `push/feed/` — changes as a side effect of *any* entity write, so no
 *   prefix rule can track it.
 * - `apps/installed`, `announcements`, `users/{id}/preferences`,
 *   `contextCenter/pages`, `learning/resources` — each has a spec or support
 *   class that writes it through `apiContext` rather than the browser.
 */
const CACHEABLE_BOOT_PATHS = [
  // No writer anywhere in the suite.
  '/api/v1/system/version',
  '/api/v1/system/config/auth',
  '/api/v1/system/config/authorizer',
  '/api/v1/system/config/rdf',
  '/api/v1/system/search/nlq',
  '/api/v1/limits/config',
  // No API writer; the specs that change these do it through the UI, so the
  // browser PUT invalidates the `/api/v1/system/` family.
  '/api/v1/system/config/customUiThemePreference',
  '/api/v1/system/settings/lineageSettings',
  '/api/v1/system/settings/appConfiguration',
  // Same, under `/api/v1/users/` and `/api/v1/services/` respectively.
  '/api/v1/users/loggedInUser',
  '/api/v1/services/ingestionPipelines/status',
];

type CachedResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

// One entry per (path + query) of the paths above, so this never grows past a
// couple of dozen. Capped and FIFO-evicted regardless, because an unbounded
// module-level cache is an unbounded leak in a long-lived worker.
const MAX_CACHED_RESPONSES = 64;
const bootCache = new Map<string, CachedResponse>();

const remember = (key: string, value: CachedResponse) => {
  if (bootCache.size >= MAX_CACHED_RESPONSES) {
    const oldest = bootCache.keys().next();

    if (!oldest.done) {
      bootCache.delete(oldest.value);
    }
  }

  bootCache.set(key, value);
};

/** `/api/v1/system/settings/lineageSettings` -> `/api/v1/system/`. */
const familyPrefix = (pathname: string) => {
  const [, api, version, family] = pathname.split('/');

  return family ? `/${api}/${version}/${family}/` : undefined;
};

/**
 * Drop every cached entry in the same API family as a write, so a test that
 * changes a setting cannot then read a stale copy of it. Invalidating the whole
 * family rather than the exact path is deliberate: the UI reads
 * `system/config/customUiThemePreference` but writes
 * `system/settings/customUiThemePreference`, so an exact-path rule would miss
 * it. Over-invalidating only costs one refetch.
 *
 * Writes issued through `apiContext` instead of the browser never reach this,
 * which is why CACHEABLE_BOOT_PATHS excludes anything with an API writer.
 */
const invalidateFamily = (pathname: string) => {
  const prefix = familyPrefix(pathname);

  if (!prefix) {
    return;
  }

  for (const key of [...bootCache.keys()]) {
    if (new URL(key).pathname.startsWith(prefix)) {
      bootCache.delete(key);
    }
  }
};

const isCacheableBootRequest = (url: URL) =>
  CACHEABLE_BOOT_PATHS.includes(url.pathname);

/**
 * Playwright hands back the *decoded* body, so replaying the original
 * `content-encoding` would describe bytes that are no longer encoded and the
 * browser would fail to parse them. `content-length` is dropped for the same
 * reason.
 */
const replayableHeaders = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) =>
        !['content-encoding', 'content-length'].includes(name.toLowerCase())
    )
  );

const serveBootConfig = async (route: Route) => {
  const request = route.request();

  if (request.method() !== 'GET') {
    await route.fallback();

    return;
  }

  const key = request.url();
  const cached = bootCache.get(key);

  if (cached) {
    await route.fulfill(cached);

    return;
  }

  const response = await route.fetch();
  const entry: CachedResponse = {
    status: response.status(),
    headers: replayableHeaders(response.headers()),
    body: await response.body(),
  };

  // Only a success is worth replaying; caching a 5xx would pin a transient
  // failure for the rest of the worker's life.
  if (response.ok()) {
    remember(key, entry);
  }

  await route.fulfill(entry);
};

/**
 * Static assets are re-served in full on every app boot — 26,695 requests and
 * ~2.4 GB per shard, against only 246 `304`s — because each Playwright
 * BrowserContext gets its own isolated HTTP cache, so the Vite bundle cannot be
 * reused across tests. `--disk-cache-dir` does not help for the same reason.
 *
 * Serving them from a per-worker cache fixes the server side, but it routes
 * ~26k requests per shard through the Playwright driver, and that per-request
 * overhead could plausibly cost more wall-clock than the saved bytes. Off by
 * default until measured: set PW_CACHE_STATIC_ASSETS=true to A/B it in CI.
 */
const cacheStaticAssets = process.env.PW_CACHE_STATIC_ASSETS === 'true';
const STATIC_ASSET =
  /\/assets\/.+\.(?:js|mjs|css|woff2?|png|svg|jpe?g|gif|ico|webp)$/;

const MAX_CACHED_ASSETS = 512;
const assetCache = new Map<string, CachedResponse>();

const serveStaticAsset = async (route: Route) => {
  const key = route.request().url();
  const cached = assetCache.get(key);

  if (cached) {
    await route.fulfill(cached);

    return;
  }

  const response = await route.fetch();
  const entry: CachedResponse = {
    status: response.status(),
    headers: replayableHeaders(response.headers()),
    body: await response.body(),
  };

  // Asset URLs are content-hashed, so an entry can never be stale — only
  // superseded, which a bounded FIFO handles.
  if (response.ok() && assetCache.size < MAX_CACHED_ASSETS) {
    assetCache.set(key, entry);
  }

  await route.fulfill(entry);
};

// Playwright stacks route handlers, so installing twice on one context would
// leave a dead handler behind on every call. Contexts are the key so entries
// disappear with them.
const installed = new WeakSet<BrowserContext>();

/**
 * Installs the reducers on a context. Idempotent, because it is called from
 * several entry points that legitimately overlap — the `context` fixture, the
 * role-page fixtures, the login helpers and `redirectToHomePage`.
 */
export const installServerLoadReducers = async (context: BrowserContext) => {
  if (installed.has(context)) {
    return;
  }

  installed.add(context);

  await context.route(ANALYTICS_COLLECT, (route) =>
    route.fulfill({ status: 200, body: '' })
  );

  await context.route(
    (url) => isCacheableBootRequest(url),
    (route) => serveBootConfig(route)
  );

  if (cacheStaticAssets) {
    await context.route(
      (url) => STATIC_ASSET.test(url.pathname),
      (route) => serveStaticAsset(route)
    );
  }

  // Passive listener rather than another route, so observing writes costs
  // nothing on the request path.
  context.on('request', (request) => {
    if (request.method() === 'GET') {
      return;
    }

    const { pathname } = new URL(request.url());

    if (pathname.startsWith('/api/v1/')) {
      invalidateFamily(pathname);
    }
  });
};

/**
 * Opt back into real analytics collection for a context.
 *
 * Only `Flow/Collect.spec.ts` needs this: it asserts the collect response
 * echoes the request payload, which a stubbed empty body cannot satisfy.
 */
export const allowAnalyticsCollection = async (context: BrowserContext) => {
  await context.unroute(ANALYTICS_COLLECT);
};
