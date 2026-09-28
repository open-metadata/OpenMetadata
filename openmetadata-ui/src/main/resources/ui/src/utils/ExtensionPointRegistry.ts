/*
 *  Copyright 2025 Collate.
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
 * Extension Point Registry
 *
 * A simple registry that allows plugins to contribute UI elements
 * at named extension points throughout the application.
 */

/**
 * A contribution from a plugin to an extension point
 */
export interface ExtensionContribution<T = unknown> {
  /** The extension point this contribution is for */
  extensionPointId: string;
  /** The actual contribution data */
  data: T;
}

/**
 * Central registry for managing extension points and contributions
 *
 * @example
 * ```typescript
 * // Plugin contributes to extension point
 * registry.contribute({
 *   extensionPointId: 'service-details.tabs',
 *   data: {
 *     key: 'query-runner',
 *     label: 'Query Runner',
 *     component: QueryRunnerTab
 *   }
 * });
 *
 * // Page retrieves contributions
 * const tabs = registry.getContributions('service-details.tabs');
 * ```
 */
export class ExtensionPointRegistry {
  private contributions: Map<string, ExtensionContribution[]> = new Map();

  /**
   * Contribute to an extension point
   *
   * Called by plugins during initialization to register their contributions.
   *
   * @param contribution - The contribution to add
   */
  public contribute<T>(contribution: ExtensionContribution<T>): void {
    const { extensionPointId } = contribution;
    const existing = this.contributions.get(extensionPointId) ?? [];
    // Idempotent for keyed contributions: a plugin's `contributeExtensions`
    // can run more than once in a session (the ApplicationsProvider effect
    // re-runs when the installed-apps list changes), so replace any prior
    // contribution carrying the same `key` instead of appending a duplicate —
    // otherwise the slot renders twice and React warns on the non-unique key.
    // Keyless contributions (e.g. the routes fallback, "last wins") keep
    // appending unchanged.
    const key = (contribution.data as { key?: string })?.key;
    const deduped =
      key === undefined
        ? existing
        : existing.filter((c) => (c.data as { key?: string })?.key !== key);
    this.contributions.set(extensionPointId, [...deduped, contribution]);
  }

  /**
   * Get all contributions for an extension point
   *
   * Called by pages/components to retrieve plugin contributions.
   *
   * @param extensionPointId - The extension point ID to get contributions for
   * @returns Array of contribution data
   */
  public getContributions<T>(extensionPointId: string): T[] {
    const contributions = this.contributions.get(extensionPointId) ?? [];

    return contributions.map((contribution) => contribution.data) as T[];
  }
}
