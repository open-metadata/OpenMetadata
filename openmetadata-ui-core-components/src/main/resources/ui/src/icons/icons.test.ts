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
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('generated icons', () => {
  // `url(#id)` resolves to the first matching id in the document, so an id
  // shared by two icons rendered on one page makes one of them clip, mask or
  // fill through the other's definition — or vanish entirely.
  it('never share an SVG element id', () => {
    const owners = new Map<string, string[]>();

    for (const file of readdirSync(__dirname)) {
      if (!file.endsWith('.tsx')) {
        continue;
      }
      const source = readFileSync(join(__dirname, file), 'utf8');
      for (const [, id] of source.matchAll(/\bid="([^"]+)"/g)) {
        owners.set(id, [...(owners.get(id) ?? []), file]);
      }
    }

    const duplicates = [...owners].filter(([, files]) => files.length > 1);

    expect(duplicates).toEqual([]);
  });
});
