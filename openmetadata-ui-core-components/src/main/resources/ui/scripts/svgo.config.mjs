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
 * Standalone SVGO config for optimizing raw SVGs before icon generation.
 * Used by generate-icons.mjs internally; also usable with the svgo CLI:
 *   npx svgo --config scripts/svgo.config.mjs -f src/icons/raw/
 */
export default {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: { overrides: { removeViewBox: false } },
    },
    { name: 'cleanupIds', params: { minify: true, remove: true } },
    {
      name: 'removeAttrs',
      params: {
        attrs: [
          'xmlns', 'width', 'height', 'fill', 'stroke',
          'stroke-width', 'stroke-linecap', 'stroke-linejoin',
          'data-name', 'id', 'style',
        ],
      },
    },
  ],
};
