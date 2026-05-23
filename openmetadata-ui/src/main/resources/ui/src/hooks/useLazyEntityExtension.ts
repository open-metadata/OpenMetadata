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
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { EntityTabs, TabSpecificField } from '../enums/entity.enum';

interface EntityWithExtension {
  extension?: unknown;
}

/**
 * Lazily fetch an entity's `extension` (custom-property values) only when the user activates
 * the Custom Properties tab. Replaces what used to be eager inclusion of {@code EXTENSION}
 * in {@code defaultFields} on every entity-detail page load.
 *
 * Why this exists:
 *  - Custom property payloads can run into hundreds of KB on entities with many user-defined
 *    properties. Most users never open the Custom Properties tab, so paying for it on first
 *    paint is wasted bytes.
 *  - The pattern (gated useQuery + merge into local state) was the same on every entity
 *    detail page; centralising it avoids 8 copies of the same closure-with-effect.
 *
 * Per-page wiring (call at the page top-level, alongside the main entity state):
 * <pre>
 *   useLazyEntityExtension&lt;Dashboard&gt;({
 *     entityType: EntityType.DASHBOARD,
 *     fqn: dashboardFQN,
 *     activeTab,
 *     fetcher: getDashboardByFqn,
 *     onResolve: (extension) =>
 *       setDashboardDetails((prev) => ({ ...prev, extension })),
 *   });
 * </pre>
 *
 * The {@code onResolve} callback shape (rather than passing a setState directly) keeps each
 * consumer in control of their own state-shape semantics — some pages init state as
 * `{} as T` (non-undefined), others as `useState<T>()` (T | undefined). Either works.
 *
 * Behaviour:
 *  - Query is gated by `enabled: activeTab === CUSTOM_PROPERTIES && Boolean(fqn)` — does
 *    nothing on other tabs.
 *  - Stable `queryKey` of `[`<type>-extension`, fqn]` — cached across tab toggles, refetched
 *    on FQN change with automatic in-flight cancellation.
 *  - 60s {@code staleTime} — custom property values change rarely.
 *  - On resolve, fires {@code onResolve(extension)} exactly once per fresh fetch.
 *
 * Caveats:
 *  - The {@code onResolve} callback identity is not memoised at the call site. We
 *    deliberately depend only on `data?.extension` so we don't fire the merge effect on
 *    every parent re-render — the latest callback is captured at fire time.
 */
export function useLazyEntityExtension<T extends EntityWithExtension>({
  entityType,
  fqn,
  activeTab,
  fetcher,
  onResolve,
}: {
  entityType: string;
  fqn: string | undefined;
  activeTab: string | undefined;
  fetcher: (fqn: string, params: { fields: string }) => Promise<T>;
  onResolve: (extension: T['extension']) => void;
}): void {
  const enabled = activeTab === EntityTabs.CUSTOM_PROPERTIES && Boolean(fqn);

  const { data } = useQuery({
    queryKey: [`${entityType}-extension`, fqn],
    queryFn: () =>
      fetcher(fqn as string, { fields: TabSpecificField.EXTENSION }),
    enabled,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.extension === undefined) {
      return;
    }
    onResolve(data.extension);
    // onResolve is intentionally omitted from deps — see header comment.
  }, [data?.extension]);
}
