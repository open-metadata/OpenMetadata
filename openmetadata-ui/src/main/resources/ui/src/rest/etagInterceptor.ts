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
 * Pairs with the server-side ETagResponseFilter which emits ETag + Cache-Control on entity
 * GET responses and short-circuits to 304 when If-None-Match matches. The flow:
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

/**
 * Wire ETag handling into the axios client. Idempotent — calling twice is harmless because
 * each call uses a fresh interceptor pair (callers that re-init axios should clear the cache
 * via {@link clearEtagCache}).
 */
export function attachEtagInterceptor(client: AxiosInstance): void {
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

    return config;
  });

  client.interceptors.response.use((response) => {
    const method = (response.config.method ?? 'get').toLowerCase();
    if (method !== 'get') {
      return response;
    }

    const key = buildKey(response.config);

    if (response.status === 304) {
      const entry = etagCache.get(key);
      if (entry) {
        touch(key, entry);

        return {
          ...response,
          status: 200,
          statusText: 'OK (from ETag cache)',
          data: entry.data,
        };
      }

      // 304 without a cached body shouldn't happen in normal flow — a stale interceptor
      // attaching If-None-Match for a key we no longer hold. Bubble through; the caller
      // sees 304 and decides. Better than fabricating a fake 200.
      return response;
    }

    if (response.status === 200) {
      const etag = readEtagHeader(response);
      if (etag && response.data !== undefined) {
        touch(key, { etag, data: response.data });
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
