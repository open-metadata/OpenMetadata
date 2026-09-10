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
import { BrowserContext, Request, Route } from '@playwright/test';

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
 * Three things have to hold for a path to be listed here. It must have no
 * writer that bypasses the browser — an `apiContext.patch()` in a `beforeAll`
 * is invisible to the request listener below, so the cache would go stale with
 * no way to notice. Any write that *does* go through the browser must land
 * under the same `/api/v1/<family>/` prefix, so `invalidateFamily` clears it.
 * And the value must not change without a client write at all: invalidation is
 * driven by observed requests, so a path whose answer moves on the server's own
 * schedule can never be cleared. That last one is easy to miss, because such a
 * path has no writer to find — see `ingestionPipelines/status` below.
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
 * - `users/loggedInUser` — identity-scoped. Worth spelling out because it is
 *   the one exclusion that is not about writes: the cache is per worker, and a
 *   worker runs several identities (the userPages fixtures alone cover admin,
 *   dataConsumer, dataSteward and owner), so caching it would serve the first
 *   identity's profile to the rest. The failure mode is a permission test
 *   quietly seeing the admin profile and passing, which is worse than the test
 *   not existing. The identity-keyed cache below makes this safe in principle,
 *   but nothing about a false pass is worth 497 requests a shard.
 * - `services/ingestionPipelines/status` — flagged in review, and the reason it
 *   is unsafe is the third condition rather than a missed writer. It reports
 *   whether the pipeline service client is reachable, which moves on its own as
 *   the orchestrator comes up, and it reports it as a `code` *in the body* with
 *   HTTP 200 either way (`AirflowStatusProvider` does `response.code === 200`).
 *   So `response.ok()` is true for "Airflow is down" and the cache would pin it
 *   for the worker's whole life, and every later ingestion or agents test in
 *   that worker would render the Airflow setup guide instead of the UI it
 *   asserts on. `AddIngestionPage` and `EditIngestionPage` also call the
 *   provider's `fetchAirflowStatus()` explicitly after a save — a refetch whose
 *   only purpose is to see a *newer* answer than the one already held.
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
];

type CachedResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

/**
 * The pathname is stored alongside the response rather than parsed back out of
 * the cache key. The key is `authorization::url`, so parsing it as a URL throws
 * — which is exactly the bug that took out seven lanes when the identity was
 * first folded into the key.
 */
type CacheEntry = {
  pathname: string;
  response: CachedResponse;
};

// One entry per (identity + path + query). Ten paths, but the identity half is
// unbounded — every fresh user that boots the app adds a set — so the cap is
// load-bearing rather than belt-and-braces, and eviction is LRU (see the hit
// path in serveBootConfig) so identity churn cannot evict the admin entries
// that account for most boots.
const MAX_CACHED_RESPONSES = 64;
const bootCache = new Map<string, CacheEntry>();

const remember = (key: string, value: CacheEntry) => {
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

  for (const [key, entry] of [...bootCache.entries()]) {
    if (entry.pathname.startsWith(prefix)) {
      bootCache.delete(key);
    }
  }
};

/**
 * A throw inside the `request` listener below fails whichever test happened to
 * be mid-action, which is a lot of blast radius for a URL the cache does not
 * even care about, so a URL it cannot parse is simply not an API write.
 */
const pathnameOf = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The matcher has to be a RegExp rather than the obvious
 * `(url) => CACHEABLE_BOOT_PATHS.includes(url.pathname)`, because Playwright
 * cannot push a predicate into the browser:
 *
 * ```js
 * // playwright-core/lib/client/network.js
 * static prepareInterceptionPatterns(handlers) {
 *   ...
 *   if (isString(handler.url))      patterns.push({ glob: handler.url });
 *   else if (isRegExp(handler.url)) patterns.push({ regexSource: ..., regexFlags: ... });
 *   else                            all = true;
 *   if (all) return [{ glob: '**\/*' }];
 * }
 * ```
 *
 * One predicate handler sets `all`, and the whole context then intercepts
 * every request. Measured on merge_group runs of #32594, that cost the suite
 * ~7% wall-clock and +15.6 GB of asset traffic: ~29k requests a shard
 * round-tripped through the Node driver instead of ~8.5k, and intercepted
 * requests miss the browser's HTTP cache (`static:304` 4,151 -> 2,239 while
 * `static:200` rose 22.3k). A RegExp is forwarded as `regexSource`, so the
 * browser pauses only these paths.
 *
 * Matched against the full URL, since that is what `urlMatches` tests a RegExp
 * against. `[^?#]*` cannot cross a `?`, so a path that appears inside a query
 * string is not mistaken for the path itself, and the trailing `(?:[?#]|$)`
 * keeps `/system/config/auth` from matching `/system/config/authorizer`.
 */
const CACHEABLE_BOOT_PATTERN = new RegExp(
  `^[^?#]*(?:${CACHEABLE_BOOT_PATHS.map(escapeRegExp).join('|')})(?:[?#]|$)`
);

/**
 * The cache is per worker and a worker runs many identities, so the caller's
 * credentials are part of the key. Every path in CACHEABLE_BOOT_PATHS is
 * global today, which makes this redundant — it is here so that adding an
 * identity-scoped path later degrades into a cache miss rather than into one
 * user being served another user's response.
 */
const cacheKey = (request: Request) =>
  `${request.headers()['authorization'] ?? ''}::${request.url()}`;

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

  const key = cacheKey(request);
  const cached = bootCache.get(key);

  if (cached) {
    // Re-inserting on a hit makes eviction LRU rather than FIFO, which matters
    // now that the Authorization header is part of the key: the key space is
    // unbounded in identities (106 call sites build their own context, and
    // performUserLogin mints a fresh user), while the cap is 6.4 identities'
    // worth of entries. Under FIFO a burst of short-lived users would evict the
    // admin entries that account for most boots, and they would all refetch.
    bootCache.delete(key);
    bootCache.set(key, cached);

    await route.fulfill(cached.response);

    return;
  }

  const response = await route.fetch();
  const payload: CachedResponse = {
    status: response.status(),
    headers: replayableHeaders(response.headers()),
    body: await response.body(),
  };

  // Only a success is worth replaying; caching a 5xx would pin a transient
  // failure for the rest of the worker's life. The pathname is parsed through
  // the same guard as the listener: unreachable here, since Playwright already
  // handed a parsed URL to the route predicate, but a throw inside a route
  // handler fails the test just as readily and consistency is one line.
  const pathname = pathnameOf(request.url());

  if (response.ok() && pathname) {
    remember(key, { pathname, response: payload });
  }

  await route.fulfill(payload);
};

/**
 * Static assets are re-served in full on every app boot — 26,695 requests and
 * ~2.4 GB per shard, against only 246 `304`s — because each Playwright
 * BrowserContext gets its own isolated HTTP cache, so the Vite bundle cannot be
 * reused across tests. `--disk-cache-dir` does not help for the same reason.
 *
 * Serving them from a per-worker cache fixes the server side, but it routes
 * ~26k requests per shard through the Playwright driver, and that per-request
 * overhead could plausibly cost more wall-clock than the saved bytes. The
 * merge_group measurement behind CACHEABLE_BOOT_PATTERN says it does: the same
 * ~29k requests a shard, intercepted only so a predicate could reject them,
 * cost ~7% wall-clock. So this stays off by default and now has a reason
 * rather than a caveat. Set PW_CACHE_STATIC_ASSETS=true to A/B it in CI.
 */
const cacheStaticAssets = process.env.PW_CACHE_STATIC_ASSETS === 'true';
// Same full-URL form as CACHEABLE_BOOT_PATTERN, so it can be handed to
// `context.route` directly instead of through a predicate.
const STATIC_ASSET =
  /^[^?#]*\/assets\/[^?#]+\.(?:js|mjs|css|woff2?|png|svg|jpe?g|gif|ico|webp)(?:[?#]|$)/;

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

/**
 * Playwright rethrows out of a route handler (`RouteHandler._handleImpl`) and
 * `BrowserContext._onRoute` does not catch it, so a handler that throws fails
 * whichever test owns the route. Losing the target mid-flight is routine here
 * rather than exceptional: boot config is fetched on every navigation, so any
 * test that navigates away or ends while one is in flight would otherwise fail
 * on a request nothing asserts on. Anything else still propagates — a cache
 * that is broken for a real reason must not be silent.
 */
const ignoreClosedTarget = async (serve: () => Promise<void>) => {
  try {
    await serve();
  } catch (error) {
    if (!/has been closed/.test(String(error))) {
      throw error;
    }
  }
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

  // Guarded like the two below: analytics beacons are fired on navigation and
  // unload, so a `fulfill` here is more likely than either of them to land on a
  // page that is already going away.
  await context.route(ANALYTICS_COLLECT, (route) =>
    ignoreClosedTarget(() => route.fulfill({ status: 200, body: '' }))
  );

  await context.route(CACHEABLE_BOOT_PATTERN, (route) =>
    ignoreClosedTarget(() => serveBootConfig(route))
  );

  if (cacheStaticAssets) {
    await context.route(STATIC_ASSET, (route) =>
      ignoreClosedTarget(() => serveStaticAsset(route))
    );
  }

  // Passive listener rather than another route, so observing writes costs
  // nothing on the request path.
  context.on('request', (request) => {
    if (request.method() === 'GET') {
      return;
    }

    const pathname = pathnameOf(request.url());

    if (pathname?.startsWith('/api/v1/')) {
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
