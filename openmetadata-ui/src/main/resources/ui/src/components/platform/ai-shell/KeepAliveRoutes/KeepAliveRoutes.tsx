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

import React, {
  PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  matchPath,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import {
  createRouteActivationStore,
  RouteActivationProvider,
  RouteActivationStore,
} from '../context/RouteActivationContext';
import './keep-alive-routes.less';

interface KeepAliveRoute {
  element: React.ReactNode;
  path?: string | string[];
  // Pathless layout routes carry their nested <Route> children here; they are
  // never cacheable and must be mounted in the fallback <Routes> tree along
  // with their children.
  children?: React.ReactNode;
}

// Route paths that must never be kept alive in the hidden cache. Empty by
// default in OSS — module roots that immediately redirect to a concrete
// child, or location-reactive single-mount shells, are added here (or, later,
// derived from a module flag) so their hidden copies don't re-trigger
// navigation or render duplicate DOM.
// A static, immutable allow-list read via `.has()` — never mutated at runtime,
// so it cannot grow. Not a cache; the unbounded-cache guard is a false positive.
// eslint-disable-next-line openmetadata-performance/no-unbounded-module-cache
const NON_CACHEABLE_ROUTE_PATHS = new Set<string>([]);

const ROUTE_CACHE_CONTAINER_STYLE: React.CSSProperties = {
  height: '100%',
  position: 'relative',
};

const ACTIVE_ROUTE_STYLE: React.CSSProperties = {
  height: '100%',
};

// An inactive cached route stays mounted (to preserve scroll, filters and any
// in-flight state) but must never paint over the active page. `visibility:
// hidden` alone is not enough: it is inherited, so a descendant that re-asserts
// `visibility: visible` bleeds through. `clip-path` clips the whole subtree's
// paint to nothing regardless of any descendant `visibility`, while leaving the
// node at its full size in place (no off-screen shift), so its measured sizes
// and scroll position survive the hide/show cycle.
const INACTIVE_ROUTE_STYLE: React.CSSProperties = {
  clipPath: 'inset(50%)',
  height: '100%',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  position: 'absolute',
  visibility: 'hidden',
  width: '100%',
};

// Coalesce bursts of window-focus / tab-visibility events into at most one
// revalidation. Alt-tabbing back into the app — and every modal or dialog
// close — fires a `focus` event, and each one would otherwise re-run every
// active page's focus revalidation. The leading edge still fires immediately so
// a genuine return after being away refreshes at once. The window is anchored
// to the last fire, so every refresh starts a fresh wait before the next focus
// can trigger one.
const FOCUS_REVALIDATION_THROTTLE_MS = 15 * 60_000;

const routePathHasDynamicSegment = (path: string) =>
  path.split('/').some((segment) => segment.startsWith(':'));

const getRoutePaths = (path?: string | string[]): string[] => {
  if (!path) {
    return [];
  }

  return Array.isArray(path) ? path : [path];
};

// A route that only redirects (element is `<Navigate>`) must never be kept
// alive. react-router's `Navigate` runs its redirect in a `useEffect` with NO
// dependency array, so it re-fires on EVERY render — and a cached route stays
// mounted (hidden) forever. A kept-alive module index route (e.g.
// `/observability` → `/observability/data-quality`) would therefore re-assert
// its redirect on every render and yank the URL back to the module default the
// instant the user navigates to a sibling sub-route (alerts, incidents,
// context-center submenus). Excluding redirect routes here drops them to the
// fallback <Routes>, which mounts only the currently-matched route, so the
// redirect fires once at the bare prefix and never again.
const isRedirectRoute = (route: KeepAliveRoute): boolean =>
  React.isValidElement(route.element) && route.element.type === Navigate;

export const isCacheableRoutePath = (path: unknown): path is string =>
  typeof path === 'string' &&
  !path.includes('*') &&
  !routePathHasDynamicSegment(path) &&
  !NON_CACHEABLE_ROUTE_PATHS.has(path);

export const getActiveCacheableRoute = (
  pathname: string,
  routes: KeepAliveRoute[]
): KeepAliveRoute | undefined =>
  routes.find(
    (route) =>
      !isRedirectRoute(route) &&
      getRoutePaths(route.path).some(
        (path) =>
          isCacheableRoutePath(path) &&
          Boolean(matchPath({ end: true, path }, pathname))
      )
  );

const getCacheableRoutePath = (
  pathname: string,
  route?: KeepAliveRoute
): string | undefined =>
  getRoutePaths(route?.path).find(
    (path) =>
      isCacheableRoutePath(path) &&
      Boolean(matchPath({ end: true, path }, pathname))
  );

interface KeepAliveRoutesProps {
  routes: KeepAliveRoute[];
  /**
   * Optional headless node rendered inside the activation provider — a
   * consumer passes an invalidation listener here. Kept as an opaque prop so
   * this routing component stays free of data-layer dependencies (and its unit
   * tests stay provider-free).
   */
  listener?: React.ReactNode;
}

export const KeepAliveRoutes = ({
  children,
  routes,
  listener,
}: PropsWithChildren<KeepAliveRoutesProps>) => {
  const { pathname } = useLocation();
  const activeCacheableRoute = getActiveCacheableRoute(pathname, routes);
  const activeCacheablePath = getCacheableRoutePath(
    pathname,
    activeCacheableRoute
  );
  const [visitedCacheablePaths, setVisitedCacheablePaths] = useState<string[]>(
    () => (activeCacheablePath ? [activeCacheablePath] : [])
  );

  const storeRef = useRef<RouteActivationStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createRouteActivationStore();
  }
  const store = storeRef.current;
  const hasMountedRef = useRef(false);
  const lastFocusBumpAtRef = useRef(0);

  // Keep the store's active path current during render so a page reads its own path
  // when it first mounts (a page is only ever mounted once it has become active).
  store.setActivePath(activeCacheablePath);

  useEffect(() => {
    if (!activeCacheablePath) {
      return;
    }

    setVisitedCacheablePaths((currentPaths) =>
      currentPaths.includes(activeCacheablePath)
        ? currentPaths
        : [...currentPaths, activeCacheablePath]
    );
  }, [activeCacheablePath]);

  // Bump the activation epoch when navigating back INTO an already-visited cacheable
  // path — that is a hidden→visible re-activation, not a first visit, and not the very
  // first mount. Pages subscribe to this to revalidate stale data.
  useEffect(() => {
    store.setActivePath(activeCacheablePath);
    if (
      hasMountedRef.current &&
      activeCacheablePath &&
      visitedCacheablePaths.includes(activeCacheablePath)
    ) {
      store.bumpEpoch(activeCacheablePath);
    }
    hasMountedRef.current = true;
    // visitedCacheablePaths is intentionally read from the pre-append render closure, so
    // re-running only on activeCacheablePath change is correct.
  }, [activeCacheablePath]);

  // Single window-focus / tab-visibility listener for the whole shell.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    // Leading-edge throttle: fire the first focus immediately, then swallow any
    // further focus/visibility events for the throttle window so rapid app
    // switches and modal close bursts don't each trigger a revalidation.
    const bumpFocusThrottled = () => {
      const now = Date.now();
      if (now - lastFocusBumpAtRef.current < FOCUS_REVALIDATION_THROTTLE_MS) {
        return;
      }
      lastFocusBumpAtRef.current = now;
      store.bumpFocus();
    };
    const handleFocus = () => bumpFocusThrottled();
    const handleVisibility = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        bumpFocusThrottled();
      }
    };
    window.addEventListener('focus', handleFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [store]);

  const renderedCacheablePaths = useMemo(() => {
    if (
      !activeCacheablePath ||
      visitedCacheablePaths.includes(activeCacheablePath)
    ) {
      return visitedCacheablePaths;
    }

    return [...visitedCacheablePaths, activeCacheablePath];
  }, [activeCacheablePath, visitedCacheablePaths]);

  return (
    <RouteActivationProvider store={store}>
      {listener}
      <div style={ROUTE_CACHE_CONTAINER_STYLE}>
        {renderedCacheablePaths.map((path) => {
          const route = routes.find((candidate) =>
            getRoutePaths(candidate.path).includes(path)
          );

          if (!route) {
            return null;
          }

          const isActive = path === activeCacheablePath;

          // `clip-path` hides the inactive subtree's paint but leaves its
          // descendants in the tab order, so mark the hidden container `inert`
          // to keep keyboard focus and the a11y tree out of an invisible cached
          // page. `inert` is valid HTML but not in @types/react 18.2's JSX prop
          // types, hence the cast spread.
          const inertWhenHidden = (
            isActive ? {} : { inert: '' }
          ) as React.HTMLAttributes<HTMLDivElement>;

          return (
            <div
              {...inertWhenHidden}
              aria-hidden={!isActive}
              data-testid={`route-cache-${path}`}
              key={path}
              style={isActive ? ACTIVE_ROUTE_STYLE : INACTIVE_ROUTE_STYLE}>
              {route.element}
            </div>
          );
        })}

        {!activeCacheableRoute && (
          <Routes>
            {routes.flatMap((route, index) => {
              const paths = getRoutePaths(route.path);

              // Pathless layout route: mount it once with its nested children
              // (its child <Route>s define the concrete paths).
              if (paths.length === 0) {
                return route.children
                  ? [
                      <Route
                        element={route.element}
                        key={`layout-route-${index}`}>
                        {route.children}
                      </Route>,
                    ]
                  : [];
              }

              return paths.map((path) => (
                <Route element={route.element} key={path} path={path}>
                  {route.children}
                </Route>
              ));
            })}
            {children}
          </Routes>
        )}
      </div>
    </RouteActivationProvider>
  );
};

export default KeepAliveRoutes;
export type { KeepAliveRoute };
