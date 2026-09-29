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

import type { FC, SVGProps } from 'react';

// `import.meta.glob` is a Vite-only syntax extension that ts-jest cannot
// parse ("SyntaxError: Cannot use 'import.meta' outside a module"). Isolating
// each glob in a `.assets.ts` wrapper lets jest.config.js redirect this
// module to a stub via `moduleNameMapper` — the parent `ApplicationsClassBase.ts`
// stays parseable and the runtime maps are preserved in Vite builds.

// App logos follow the `*Application.svg` naming convention. The old code
// used `import(`../assets/svg/${appName}.svg`)` — Rolldown/Vite must emit a
// chunk for every possible template-literal match, which meant all 799 SVGs
// under `assets/svg/` became individual chunks. Narrowing the glob keeps the
// same lazy-load behaviour (each logo is still its own chunk, fetched on
// demand) but only for the ~9 files that could actually match.
//
// No `?react` query — the repo's `src/@types/svg.d.ts` declares plain
// `import '*.svg'` returns `{ ReactComponent, default: <url> }`. Keeping the
// convention here means the loader's returned module shape matches every
// other SVG import site.
export const appLogoLoaders = import.meta.glob<{
  default: string;
  ReactComponent: FC<SVGProps<SVGSVGElement>>;
}>('../../../../assets/svg/*Application.svg');

// Screenshot PNGs are served as URL strings, not JSX modules — `eager` + `?url`
// emits each as a static asset with no JS chunk. Previously each screenshot
// was a tiny `import()` chunk.
export const appScreenshotUrls = import.meta.glob<string>(
  '../../../../assets/img/appScreenshots/*.png',
  { eager: true, query: '?url', import: 'default' }
);

// Application form schemas. Same reasoning as the app-logo glob: the old
// template-literal `import()` matched every JSON under `applicationSchemas/`,
// producing one lazy chunk per schema (~10). The narrow glob emits the same
// N chunks but the graph is transparent to reviewers, and future refactors
// can eager-load them into a single bucket if needed.
export const applicationSchemaLoaders = import.meta.glob<
  Record<string, unknown>
>('../../../../jsons/applicationSchemas/*.json');
