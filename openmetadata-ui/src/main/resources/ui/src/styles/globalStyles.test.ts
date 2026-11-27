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
import { readFileSync } from 'fs';
import { join } from 'path';

describe('globalStyles import order', () => {
  it('loads legacy-base.css and master.less before every other local stylesheet', () => {
    const source = readFileSync(join(__dirname, 'globalStyles.ts'), 'utf8');
    const localImports = [...source.matchAll(/^import '\.\/([^']+)';/gm)].map(
      (match) => match[1]
    );

    expect(localImports.slice(0, 2)).toEqual([
      'legacy-base.css',
      'master.less',
    ]);
  });
});
