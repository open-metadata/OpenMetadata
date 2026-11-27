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
export type ModuleGraph = {
  getModuleInfo: (id: string) => {
    importers: readonly string[];
    importedIds: readonly string[];
    isEntry: boolean;
  } | null;
};

// Vendor families that get a named chunk (stable cache keys across releases).
// `pinned` families take every module; the rest only their shell modules.
const VENDOR_FAMILIES: {
  chunk: string;
  matches: (packageName: string) => boolean;
  pinned?: boolean;
}[] = [
  {
    // The shell renders through all of React and the router.
    chunk: 'vendor-react',
    pinned: true,
    matches: (name) =>
      ['react', 'react-dom', 'scheduler'].includes(name) ||
      name.startsWith('react-router'),
  },
  {
    // The /silent-callback entry loads only this. Its own chunk keeps the
    // silent-refresh iframe off every other vendor chunk (SsoScenarios
    // scenario 7 budget).
    chunk: 'vendor-oidc-client',
    pinned: true,
    matches: (name) => name === 'oidc-client',
  },
  {
    chunk: 'vendor-aria',
    matches: (name) =>
      name.startsWith('@react-aria/') ||
      name.startsWith('@react-stately/') ||
      name.startsWith('@react-types/') ||
      ['react-aria', 'react-aria-components', 'react-stately'].includes(name),
  },
  {
    chunk: 'vendor-untitled',
    matches: (name) => name === '@openmetadata/ui-core-components',
  },
];

// Classifier used by both bundlers to assign modules to vendor buckets.
// Rollup consumes it via `rollupOptions.output.manualChunks`, Rolldown via
// `rollupOptions.output.advancedChunks.groups[].name`. Same logic, one
// source of truth. Return a string to force the module into that bucket, or
// `undefined` to let the bundler auto-split at the nearest dynamic-import
// boundary.
export const createChunkClassifier = ({
  isPlaywrightBundle,
}: {
  isPlaywrightBundle: boolean;
}) => {
  // Walks static importers only: a module is on an entry's graph iff some
  // chain of static imports leads back to an entry matching `isTargetEntry`.
  const createEntryReachability = (isTargetEntry: (id: string) => boolean) => {
    const reachable = new Map<string, boolean>();

    return (id: string, graph: ModuleGraph): boolean => {
      const cached = reachable.get(id);
      if (cached !== undefined) {
        return cached;
      }
      const seen = new Set([id]);
      const queue = [id];
      let result = false;
      while (queue.length && !result) {
        const current = queue.pop() as string;
        const info = graph.getModuleInfo(current);
        if (!info) {
          continue;
        }
        if (info.isEntry && isTargetEntry(current)) {
          result = true;
          break;
        }
        for (const importer of info.importers) {
          if (reachable.get(importer)) {
            result = true;
            break;
          }
          if (!seen.has(importer)) {
            seen.add(importer);
            queue.push(importer);
          }
        }
      }
      reachable.set(id, result);

      return result;
    };
  };
  const isShellReachable = createEntryReachability(() => true);
  const isMainShellReachable = createEntryReachability((id) =>
    id.endsWith('/index.html')
  );
  const isShellReachableFromOtherEntry = createEntryReachability(
    (id) => !id.endsWith('/index.html')
  );
  // Type/enum modules by convention. At runtime they are only TS `enum`
  // objects (interfaces/types erase), and each one used by several lazy routes
  // otherwise becomes its own sub-1 KiB chunk.
  const isEnumOnlyModule = (id: string) =>
    id.includes('/src/generated/') ||
    id.includes('/src/enums/') ||
    /(\.enum|\.interface|\/types)\.ts$/.test(id);

  // Rolldown 1.x no longer folds modules shared by the entry and lazy routes
  // into the entry chunk; each such set becomes its own common chunk, so the
  // bootstrap grows from a handful of files to dozens. One group restores the
  // single shell chunk. The entry's own module stays out (an empty entry chunk
  // is dropped by Vite), and modules /silent-callback also reaches get their
  // own chunk: a group captures its members' dependencies, so leaving them
  // unnamed would pull the whole shell into that iframe.
  // ADR:2026-11-02-ui-bundle-groups-the-entry-graph-and-isolates-silent-callback
  const appShellChunk = (
    id: string,
    graph?: ModuleGraph
  ): string | undefined => {
    const info = graph?.getModuleInfo(id);
    if (
      !graph ||
      !info ||
      isPlaywrightBundle ||
      info.isEntry ||
      info.importers.some(
        (importer) => graph.getModuleInfo(importer)?.isEntry
      ) ||
      !isMainShellReachable(id, graph)
    ) {
      return undefined;
    }

    return isShellReachableFromOtherEntry(id, graph)
      ? 'app-auth-shared'
      : 'app-shell';
  };

  return (id: string, graph?: ModuleGraph): string | undefined => {
    const normalizedId = id.split('?')[0].replaceAll('\\', '/');

    // Lazy-only enum modules share one chunk. Import-free only: a group also
    // captures its members' dependencies, so an enum file importing a
    // shell-used module would drag the whole group onto the entry graph.
    if (
      graph &&
      !isPlaywrightBundle &&
      isEnumOnlyModule(normalizedId) &&
      graph.getModuleInfo(id)?.importedIds.length === 0 &&
      !isShellReachable(id, graph)
    ) {
      return 'app-enums';
    }

    if (isPlaywrightBundle) {
      if (
        normalizedId.includes('/src/components/MyData/') ||
        normalizedId.includes('/src/pages/MyDataPage/') ||
        normalizedId.includes('/src/components/KnowledgeCenter/') ||
        normalizedId.includes('/src/utils/LandingPageWidget/') ||
        /\/src\/utils\/(?:CustomizeMyDataPage|CustomizableLandingPage|DataAssetService|LandingPageWidgetIconUtils)/.test(
          normalizedId
        )
      ) {
        return 'app-e2e-runtime';
      }
    }

    if (!normalizedId.includes('/node_modules/')) {
      return appShellChunk(id, graph);
    }

    if (isPlaywrightBundle) {
      if (
        id.includes('node_modules/elkjs') ||
        id.includes('node_modules/@reactflow') ||
        id.includes('node_modules/reactflow')
      ) {
        return 'vendor-e2e-lineage';
      }
      const e2ePkgPath = id.split(/node_modules[\\/]/).pop() ?? id;
      const [e2eScopeOrName, e2eScopedName] = e2ePkgPath.split(/[\\/]/);
      const e2ePackageName = e2eScopeOrName.startsWith('@')
        ? `${e2eScopeOrName}/${e2eScopedName}`
        : e2eScopeOrName;

      return ['react', 'react-dom', 'scheduler'].includes(e2ePackageName)
        ? 'vendor-e2e-framework'
        : 'app-e2e-runtime';
    }

    const packagePath =
      normalizedId.split('/node_modules/').pop() ?? normalizedId;
    const [scopeOrName, scopedName] = packagePath.split('/');
    const packageName = scopeOrName.startsWith('@')
      ? `${scopeOrName}/${scopedName}`
      : scopeOrName;
    const family = VENDOR_FAMILIES.find(({ matches }) => matches(packageName));

    if (!family) {
      return appShellChunk(id, graph);
    }

    // A family chunk holds only the modules the shell loads anyway: modules
    // whose static importers lead back to an entry. Anything only a lazy route
    // reaches stays with that route; a named group would put it on every
    // page. A group also captures its members' dependencies, and the
    // dependencies of a shell module are shell modules too, so this never
    // drags lazy code onto the entry graph.
    if (family.pinned || (graph && isShellReachable(id, graph))) {
      return family.chunk;
    }

    return undefined;
  };
};
