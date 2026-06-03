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

import {
  AxiosHeaders,
  AxiosInstance,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import Qs from 'qs';

/**
 * Client-side ETag / If-None-Match handling for entity GETs.
 *
 * Pairs with the server-side ETagResponseFilter which emits ETag + Cache-Control: no-store on
 * entity GET responses and short-circuits to 304 when If-None-Match matches. The server uses
 * no-store specifically so the browser doesn't HTTP-cache and serve stale bodies on a 304 from
 * mutation paths that don't bump the entity version (addFollower/updateVote/etc.); all
 * conditional-GET logic lives here in the in-memory cache, which we invalidate on every
 * non-GET response. The flow:
 *
 *   1. First GET to /tables/{fqn} → response with ETag header. We cache (etag, body) keyed
 *      by the canonical URL+params.
 *   2. Second GET to the same URL → we attach If-None-Match. Server compares against the
 *      current ETag.
 *      - Match → 304 with empty body. Interceptor returns cached body as if it were 200.
 *      - No match → 200 with fresh body. Interceptor refreshes the cached entry.
 *
 * Wins: zero body bytes on the wire on revisit, plus skip JSON parse + render.
 *
 * Bounded memory: simple LRU cap at MAX_ENTRIES; oldest evicted on overflow. A typical entity
 * GET response is 5-50 KB so the cap holds the cache to ~10 MB worst case.
 */

interface CachedEntry {
  etag: string;
  data: unknown;
}

const MAX_ENTRIES = 200;

// Map preserves insertion order — re-set on hit to keep recently-used entries at the back.
const etagCache = new Map<string, CachedEntry>();

function buildKey(config: InternalAxiosRequestConfig): string {
  const method = (config.method ?? 'get').toUpperCase();
  const url = config.url ?? '';
  const params = config.params
    ? `?${Qs.stringify(config.params, { arrayFormat: 'comma' })}`
    : '';

  return `${method} ${url}${params}`;
}

function touch(key: string, entry: CachedEntry): void {
  etagCache.delete(key);
  etagCache.set(key, entry);

  if (etagCache.size > MAX_ENTRIES) {
    const oldest = etagCache.keys().next().value;
    if (oldest !== undefined) {
      etagCache.delete(oldest);
    }
  }
}

function readEtagHeader(response: AxiosResponse): string | undefined {
  const headers = response.headers;
  if (!headers) {
    return undefined;
  }

  if (headers instanceof AxiosHeaders) {
    const v = headers.get('etag');

    return typeof v === 'string' ? v : undefined;
  }

  const candidate = (headers as Record<string, unknown>).etag;
  if (typeof candidate === 'string') {
    return candidate;
  }
  const candidateUpper = (headers as Record<string, unknown>).ETag;

  return typeof candidateUpper === 'string' ? candidateUpper : undefined;
}

// Marker we stamp on an AxiosInstance once we've installed our interceptor pair. Lets the
// function be properly idempotent — re-invocation (HMR, test setup re-runs, callers that
// accidentally re-init) is a no-op rather than stacking another interceptor pair plus another
// `validateStatus` override on top of itself.
const ETAG_INTERCEPTOR_INSTALLED = Symbol.for(
  '@openmetadata/etag-interceptor-installed'
);

// Per-request stash slot for the cached body that backs the `If-None-Match` header we
// attached. The response interceptor consults this on a 304 response so we can still
// hand the caller a 200 even if the global Map entry was evicted (LRU overflow) or
// wiped (concurrent mutation → cache clear) between the request firing and the
// response arriving. Without this, a concurrent POST that clears the cache while a
// GET is in flight would surface as a 304 with `response.data === undefined`, which
// the caller has every right to treat as a runtime error.
const ETAG_REQUEST_SNAPSHOT = '__etagSnapshot' as const;
type ConfigWithSnapshot = InternalAxiosRequestConfig & {
  [ETAG_REQUEST_SNAPSHOT]?: CachedEntry;
};

/**
 * Wire ETag handling into the axios client. Idempotent — calling twice on the same client is
 * a no-op (guarded via a symbol marker on the instance). Callers that re-init axios from
 * scratch should also clear the cache via {@link clearEtagCache}.
 */
export function attachEtagInterceptor(client: AxiosInstance): void {
  const marker = client as unknown as Record<symbol, boolean>;
  if (marker[ETAG_INTERCEPTOR_INSTALLED]) {
    return;
  }
  marker[ETAG_INTERCEPTOR_INSTALLED] = true;

  // Treat 304 as a success status so axios delivers it through the response interceptor
  // instead of the error path. Without this, our 304-handling code would have to live in
  // the error interceptor and intercepts on every error path.
  const previousValidate = client.defaults.validateStatus;
  client.defaults.validateStatus = (status: number) =>
    status === 304 ||
    (previousValidate
      ? previousValidate(status)
      : status >= 200 && status < 300);

  client.interceptors.request.use((config) => {
    const method = (config.method ?? 'get').toLowerCase();
    if (method !== 'get') {
      return config;
    }

    const entry = etagCache.get(buildKey(config));
    if (!entry) {
      return config;
    }

    // Axios 1.x always populates config.headers with AxiosHeaders instance, but be
    // defensive in case an upstream interceptor swapped it for a plain object.
    if (config.headers instanceof AxiosHeaders) {
      config.headers.set('If-None-Match', entry.etag);
    } else if (config.headers) {
      (config.headers as Record<string, string>)['If-None-Match'] = entry.etag;
    } else {
      config.headers = new AxiosHeaders({ 'If-None-Match': entry.etag });
    }

    // Stash a reference to the cached entry on the config. Safe to share by reference
    // because the entry's `data` is the immutable snapshot we wrote at cache-write time
    // (see the 200-handling branch below); we only ever hand consumers `structuredClone`
    // copies of it.
    (config as ConfigWithSnapshot)[ETAG_REQUEST_SNAPSHOT] = entry;

    return config;
  });

  client.interceptors.response.use((response) => {
    const method = (response.config.method ?? 'get').toLowerCase();

    // Any successful non-GET response is a mutation — wipe the entire ETag cache so the next
    // read on any URL fetches fresh state. We have to be aggressive here because several
    // server endpoints mutate an entity without bumping its {@code version}/{@code updatedAt}
    // (e.g. {@code addFollower}, {@code updateVote}, {@code DataContractRepository.updateLatestResult}),
    // so the entity's ETag is unchanged after the mutation and a targeted invalidation by URL
    // wouldn't help — the server would still return 304 with our stale cached body. Clearing
    // the cache means the next GET goes out without {@code If-None-Match} and the server
    // returns 200 with the current body. The cost is small (per-session in-memory map, 200
    // entries max) and avoids correctness bugs in tests and in production.
    if (method !== 'get') {
      etagCache.clear();

      return response;
    }

    const key = buildKey(response.config);

    if (response.status === 304) {
      // Prefer the live cache entry (re-populating LRU recency) but fall back to the
      // per-request snapshot stashed at request time. The snapshot covers two races:
      // (1) LRU eviction pushed the entry out between request and response, and
      // (2) a concurrent mutation (or logout) cleared the entire cache. Either way the
      // cached body is still on `response.config` and we can hand it back as a 200.
      const liveEntry = etagCache.get(key);
      const entry =
        liveEntry ??
        (response.config as ConfigWithSnapshot)[ETAG_REQUEST_SNAPSHOT];
      if (entry) {
        // Only touch (re-insert) when the entry came from the live cache. If we're using
        // the snapshot fallback the cache was intentionally cleared (mutation invalidation
        // or logout), and re-inserting would resurrect a stale entry — the next GET for
        // the same URL would hit it, attach If-None-Match, get 304 from a server that may
        // have changed state in a non-version-bumping way (followers/votes), and serve the
        // same stale body again. Returning the snapshot one-shot is fine; persisting it
        // is not.
        if (liveEntry) {
          touch(key, entry);
        }

        // Deep-clone the cached body before handing it back. Consumers (UI components,
        // utilities, edit handlers) sometimes mutate the entity object they receive — adding
        // local UI state, normalising fields, stripping properties — and a shared reference
        // would let those mutations leak back into the cache. We also clone on cache write
        // (see the 200 branch), so this read-side clone is a defense-in-depth measure in
        // case a future caller hands us back the same reference we stored.
        return {
          ...response,
          status: 200,
          statusText: 'OK (from ETag cache)',
          data: structuredClone(entry.data),
        };
      }

      // 304 with no cached body and no stashed snapshot — would only happen if the request
      // interceptor didn't run (e.g. caller built the If-None-Match header directly). Bubble
      // through; better than fabricating a fake 200.
      return response;
    }

    if (response.status === 200) {
      const etag = readEtagHeader(response);
      if (etag && response.data !== undefined) {
        // Clone on write so the cached entry is decoupled from the live response object the
        // caller is about to consume. Without this, a caller that mutates `response.data`
        // (common pattern: stamping UI-local fields onto an entity) would corrupt the cache,
        // and the next 304 would hand the next caller a clone of the already-mutated object.
        // structuredClone is sub-millisecond for typical OpenMetadata entities (5-50 KB JSON)
        // and is available in all supported browsers (Chrome 98+, Firefox 94+, Safari 15.4+).
        touch(key, { etag, data: structuredClone(response.data) });
      }
    }

    return response;
  });
}

/**
 * Drop every cached ETag entry. Call on logout / user switch so a freshly-authenticated user
 * never receives another user's cached body via 304.
 */
export function clearEtagCache(): void {
  etagCache.clear();
}

/** Test/debug helper. Returns the count of entries currently held. */
export function etagCacheSize(): number {
  return etagCache.size;
}
