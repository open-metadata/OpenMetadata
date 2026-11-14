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
import { listAllPages } from './OntologyPaging.utils';

const page = (data: string[], after?: string) => ({
  data,
  paging: { after, total: 0 },
});

describe('listAllPages', () => {
  it('follows cursors until the last page', async () => {
    const pages: Record<string, ReturnType<typeof page>> = {
      first: page(['a', 'b'], 'c1'),
      c1: page(['c'], 'c2'),
      c2: page(['d']),
    };

    await expect(
      listAllPages((after) => Promise.resolve(pages[after ?? 'first']), 5)
    ).resolves.toEqual(['a', 'b', 'c', 'd']);
  });

  it('fails instead of looping when the server repeats a cursor', async () => {
    await expect(
      listAllPages(() => Promise.resolve(page(['a'], 'same')), 5)
    ).rejects.toThrow('Pagination returned a repeated cursor');
  });

  it('fails once the page budget is spent', async () => {
    let next = 0;

    await expect(
      listAllPages(() => Promise.resolve(page(['a'], `c${next++}`)), 3)
    ).rejects.toThrow('Pagination exceeded 3 pages');
  });
});
