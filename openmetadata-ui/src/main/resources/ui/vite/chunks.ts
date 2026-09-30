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
  const shellReachable = new Map<string, boolean>();
  // Walks static importers only: a module is on the shell (entry) graph iff
  // some chain of static imports leads back to an entry.
  const isShellReachable = (id: string, graph: ModuleGraph): boolean => {
    const cached = shellReachable.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const seen = new Set([id]);
    const queue = [id];
    let result = false;
    while (queue.length && !result) {
      const info = graph.getModuleInfo(queue.pop() as string);
      if (!info) {
        continue;
      }
      if (info.isEntry) {
        result = true;
        break;
      }
      for (const importer of info.importers) {
        if (shellReachable.get(importer)) {
          result = true;
          break;
        }
        if (!seen.has(importer)) {
          seen.add(importer);
          queue.push(importer);
        }
      }
    }
    shellReachable.set(id, result);

    return result;
  };
  // Type/enum modules by convention. At runtime they are only TS `enum`
  // objects (interfaces/types erase), and each one used by several lazy routes
  // otherwise becomes its own sub-1 KiB chunk.
  const isEnumOnlyModule = (id: string) =>
    id.includes('/src/generated/') ||
    id.includes('/src/enums/') ||
    /(\.enum|\.interface|\/types)\.ts$/.test(id);

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
      return undefined;
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

    if (
      ['react', 'react-dom', 'scheduler'].includes(packageName) ||
      packageName.startsWith('react-router')
    ) {
      return 'vendor-react';
    }

    // `oidc-client` is the only vendor the /silent-callback entry path
    // needs. Pin it into its own chunk so the min-chunk-size merger
    // cannot fold it into vendor-antd — that merge makes vendor-antd a
    // static sibling of the entry chunk and pulls a >1 MB Antd chunk
    // into the silent-refresh iframe, violating the scenario-7 budget
    // in SsoScenarios.spec.
    if (packageName === 'oidc-client') {
      return 'vendor-oidc-client';
    }

    if (
      packageName.startsWith('@react-aria/') ||
      packageName.startsWith('@react-stately/') ||
      packageName.startsWith('@react-types/') ||
      packageName === 'react-aria' ||
      packageName === 'react-aria-components' ||
      packageName === 'react-stately'
    ) {
      return 'vendor-aria';
    }

    // Antd and the core component library are shared by nearly every route,
    // so stable cache buckets pay off. Route-specific dependencies are left
    // to the bundler so they stay behind their dynamic import.
    if (normalizedId.includes('/node_modules/antd/')) {
      return 'vendor-antd';
    }
    if (
      normalizedId.includes('/node_modules/@openmetadata/ui-core-components/')
    ) {
      return 'vendor-untitled';
    }
    if (normalizedId.includes('/node_modules/@untitledui/icons/')) {
      return 'vendor-untitled-icons';
    }

    // NOTE: earlier revisions grouped viz (@antv, three, reactflow, recharts,
    // elkjs, dagre), editors (@tiptap, prosemirror, codemirror, quill), and
    // forms (@rjsf, react-hook-form, query-builder) into three named vendor
    // buckets. That produced a single 4.8 MB vendor-viz chunk (max 1.75 MB)
    // and pulled 2.55 MB brotli of JS onto index.html because one static
    // importer forced the whole bucket onto the entry graph. Rollup already
    // lazy-splits these packages behind their consumers' `import()`
    // boundaries, so leave the auto-splitter to do its job here. Reintroduce
    // a bucket only after checking (a) every consumer is behind a dynamic
    // import and (b) the resulting chunk stays under MAX_SINGLE_JS_BYTES.

    return undefined;
  };
};
