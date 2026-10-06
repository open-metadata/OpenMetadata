/*
 *  Copyright 2024 Collate.
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
import { EntityReference } from '../../../../generated/entity/type';
import { ExtensionPointRegistry } from '../../../../utils/ExtensionPointRegistry';
import type { AppPlugin } from '../plugins/AppPlugin';

export type ApplicationsContextType = {
  applications: EntityReference[];
  isLoading: boolean;
  plugins: AppPlugin[];
  extensionRegistry: ExtensionPointRegistry;
  /**
   * Bumped by one right after installed plugins' `contributeExtensions` have
   * all run against `extensionRegistry`. `extensionRegistry` is a single
   * mutable instance for the app's lifetime — mutating its internal Map
   * triggers no re-render on its own, so a `useMemo` keyed only on the
   * registry's (unchanged) identity would never see new contributions.
   * Consumers that derive a value from registry contributions (e.g.
   * `AppModeRoutes`'s route table) must include this in their memo deps so
   * they recompute exactly once after contributions land, instead of never.
   */
  contributionsVersion: number;
  /**
   * True once installed plugins' `contributeExtensions` have all run at
   * least once. `isLoading` turns `false` in the same commit as
   * `installedPluginInstances` is set (both after the same `await`, batched
   * by React); contribution itself happens later, in a passive effect that
   * runs after that commit. So there is one committed render where
   * `isLoading` is `false` but the registry is still empty — a consumer
   * that deep-links into contributed content (e.g. the profile Notification
   * panel) and gates only on `isLoading` can flash "not found" in that
   * render. Gate on `contributionsReady` instead when correctness for
   * contributed content matters; `isLoading` remains correct for the
   * application list itself.
   */
  contributionsReady: boolean;
    /**
   * Stable wrapper around `extensionRegistry.getContributions` whose
   * reference changes exactly when `contributionsVersion` does — i.e. once
   * after plugins have registered their contributions. Prefer this over
   * accessing `extensionRegistry` directly so callers can use the function
   * reference as their sole memo/callback dep instead of pairing the registry
   * with `contributionsVersion`.
   */
  getContributions: <T>(extensionPointId: string) => T[];
};
