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

import fs from 'fs';
import { Plugin, transformWithEsbuild } from 'vite';

export default function viteSvgrOptimized(): Plugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let svgrTransform: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jsxPlugin: any;

  const initializeSvgr = async () => {
    if (!svgrTransform) {
      const svgrCore = await import('@svgr/core');
      const jsxModule = await import('@svgr/plugin-jsx');
      svgrTransform = svgrCore.transform;
      jsxPlugin = jsxModule.default;
    }
  };

  return {
    name: 'vite-plugin-svgr-optimized',
    enforce: 'pre',

    async transform(code, id) {
      // Early exit for non-SVG files
      if (!id.endsWith('.svg')) {
        return null;
      }

      if (id.includes('node_modules')) {
        return null;
      }

      const cleanId = id.replace(/[?#].*$/s, '');

      try {
        await initializeSvgr();

        const svgCode = await fs.promises.readFile(cleanId, 'utf8');

        const componentCode = await svgrTransform(
          svgCode,
          {
            ref: true,
            exportType: 'named',
            svgo: true,
            titleProp: true,
            plugins: ['@svgr/plugin-jsx'],
          },
          {
            filePath: cleanId,
            caller: {
              previousExport: code,
              defaultPlugins: [jsxPlugin],
            },
          }
        );

        const res = await transformWithEsbuild(componentCode, id, {
          loader: 'jsx',
          jsx: 'automatic',
        });

        return {
          code: res.code,
          map: res.map,
        };
      } catch (error) {
        this.error(`Failed to transform SVG: ${id}\n${error}`);
      }
    },
  };
}
