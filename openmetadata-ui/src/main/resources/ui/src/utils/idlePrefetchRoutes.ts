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

/**
 * Warm the route-chunk cache for pages a user is likely to visit next, after
 * the current view has finished painting. Each dynamic import resolves to a
 * lazy module the router would otherwise fetch on first navigation; running
 * the imports during browser idle time pulls those chunks into the HTTP +
 * Service Worker caches in advance, so the click → render lag drops from
 * ~200–500ms (network) to ~5–10ms (cache hit + parse).
 *
 * Triggered once per session from {@link App}'s mount effect. Wrapped in
 * `requestIdleCallback` so it never competes with first-paint work; falls
 * back to a 2s timeout when the browser doesn't support IO scheduling
 * (Safari < 15.4 and some embedded WebViews).
 */
export const idlePrefetchRoutes = () => {
  const schedule =
    typeof window !== 'undefined' &&
    typeof (window as Window & { requestIdleCallback?: unknown })
      .requestIdleCallback === 'function'
      ? (window as Window & { requestIdleCallback: (cb: () => void) => void })
          .requestIdleCallback
      : (cb: () => void) => window.setTimeout(cb, 2000);

  schedule(() => {
    // Most common next-hop from /my-data — the user's primary "find data" path.
    // The import resolves the lazy chunk; the SW + browser HTTP cache pick up
    // every nested chunk pulled in by the page's own import graph.
    import('../pages/ExplorePage/ExplorePageV1.component').catch(
      () => undefined
    );
    // EntityRouter is the parent of every entity detail page. Warming it once
    // covers Table / Dashboard / Pipeline / Topic / etc clicks from search.
    import('../components/AppRouter/EntityRouter').catch(() => undefined);
    // {@code SettingsRouter} is intentionally NOT prefetched: it transitively
    // pulls every service-form registry (11), 98 connection-schema JSONs, and
    // every service-connector icon PNG — ~15 MB of resources that the typical
    // /my-data visitor never needs. Settings is admin-only and accessed
    // infrequently enough to be loaded on click without complaint.
  });
};
