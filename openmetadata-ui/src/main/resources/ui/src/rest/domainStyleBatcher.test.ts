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
import { SearchIndex } from '../enums/search.enum';
import { batchedDomainStyle } from './domainStyleBatcher';
import { searchQuery } from './searchAPI';

jest.mock('./searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.Mock;

const searchResponse = (
  sources: Array<{ id: string; style?: Record<string, string> }>
) => ({
  hits: { hits: sources.map((_source) => ({ _source })) },
});

const requestedIds = (call: number): string[] =>
  mockSearchQuery.mock.calls[call][0].queryFilter.query.terms['id.keyword'];

describe('domainStyleBatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve every domain requested in the same tick from one search', async () => {
    mockSearchQuery.mockResolvedValue(
      searchResponse([
        { id: 'sales', style: { color: '#F14C75', iconURL: 'Database01' } },
        { id: 'finance', style: { color: '#12B76A' } },
      ])
    );

    const [sales, finance, sameSales] = await Promise.all([
      batchedDomainStyle('sales'),
      batchedDomainStyle('finance'),
      batchedDomainStyle('sales'),
    ]);

    expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        searchIndex: SearchIndex.DOMAIN,
        pageSize: 2,
        includeFields: ['id', 'style'],
        skipDomainFilter: true,
      })
    );
    expect(requestedIds(0)).toEqual(['sales', 'finance']);
    expect(sales).toEqual({ color: '#F14C75', iconURL: 'Database01' });
    expect(sameSales).toEqual(sales);
    expect(finance).toEqual({ color: '#12B76A', iconURL: undefined });
  });

  it('should resolve null for a domain without a style or missing from the results', async () => {
    mockSearchQuery.mockResolvedValue(
      searchResponse([
        { id: 'plain' },
        { id: 'cover-only', style: { coverImageURL: 'cover.png' } },
      ])
    );

    const styles = await Promise.all([
      batchedDomainStyle('plain'),
      batchedDomainStyle('cover-only'),
      batchedDomainStyle('hidden'),
    ]);

    expect(styles).toEqual([null, null, null]);
  });

  it('should split a tick of more than 100 domains across searches', async () => {
    mockSearchQuery.mockImplementation(({ queryFilter }) =>
      Promise.resolve(
        searchResponse(
          queryFilter.query.terms['id.keyword'].map((id: string) => ({
            id,
            style: { color: `#${id}` },
          }))
        )
      )
    );
    const ids = Array.from({ length: 101 }, (_, index) => String(index));

    const styles = await Promise.all(ids.map(batchedDomainStyle));

    expect(mockSearchQuery).toHaveBeenCalledTimes(2);
    expect(requestedIds(0)).toHaveLength(100);
    expect(requestedIds(1)).toEqual(['100']);
    expect(styles[100]).toEqual({ color: '#100', iconURL: undefined });
  });

  it('should reject every caller of a failed search and batch the next tick afresh', async () => {
    const error = new Error('search unavailable');
    mockSearchQuery.mockRejectedValueOnce(error);

    await expect(
      Promise.all([batchedDomainStyle('a'), batchedDomainStyle('b')])
    ).rejects.toBe(error);

    mockSearchQuery.mockResolvedValueOnce(
      searchResponse([{ id: 'a', style: { color: '#000000' } }])
    );

    await expect(batchedDomainStyle('a')).resolves.toEqual({
      color: '#000000',
      iconURL: undefined,
    });
    expect(requestedIds(1)).toEqual(['a']);
  });
});
