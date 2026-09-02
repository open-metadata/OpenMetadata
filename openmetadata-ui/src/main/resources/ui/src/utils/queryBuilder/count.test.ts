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
import { EntityType } from '../../enums/entity.enum';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import { fetchQueryBuilderCount, getScopedQueryFilter } from './count';

jest.mock('../../rest/searchAPI', () => ({ searchQuery: jest.fn() }));

const { searchQuery } = jest.requireMock('../../rest/searchAPI');

const filterWithTerm = () =>
  ({
    query: { bool: { must: [{ bool: { must: [{ term: { name: 'x' } }] } }] } },
  } as unknown as QueryFilterInterface);

describe('getScopedQueryFilter', () => {
  it('should leave the filter alone for EntityType.ALL', () => {
    const filter = filterWithTerm();
    const before = JSON.stringify(filter);

    expect(JSON.stringify(getScopedQueryFilter(filter, EntityType.ALL))).toBe(
      before
    );
  });

  it('should narrow the filter to a specific entity type', () => {
    const scoped = getScopedQueryFilter(filterWithTerm(), EntityType.TABLE);

    expect(JSON.stringify(scoped)).toContain('table');
  });

  // `addEntityTypeFilter` pushes into `query.bool.must` in place. Scoping the
  // same object twice appends the entity-type clause twice, which is why the
  // component derives the Explore URL and the count from ONE scoped filter.
  it('should append exactly one entity-type clause per call', () => {
    const once = getScopedQueryFilter(filterWithTerm(), EntityType.TABLE);
    const onceCount = (JSON.stringify(once).match(/"table"/g) ?? []).length;

    const shared = filterWithTerm();
    getScopedQueryFilter(shared, EntityType.TABLE);
    const twice = getScopedQueryFilter(shared, EntityType.TABLE);
    const twiceCount = (JSON.stringify(twice).match(/"table"/g) ?? []).length;

    expect(onceCount).toBeGreaterThan(0);
    expect(twiceCount).toBeGreaterThan(onceCount);
  });
});

describe('getScopedQueryFilter – OR filters', () => {
  const orFilter = () =>
    ({
      query: {
        bool: {
          should: [{ term: { name: 'a' } }, { term: { name: 'b' } }],
        },
      },
    } as unknown as QueryFilterInterface);

  it('should still narrow an OR filter to the entity type', () => {
    const scoped = JSON.stringify(
      getScopedQueryFilter(orFilter(), EntityType.TABLE)
    );

    expect(scoped).toContain('"entityType.keyword":"table"');
    expect(scoped).toContain('"should"');
  });

  it('should leave an OR filter alone for EntityType.ALL', () => {
    const scoped = JSON.stringify(
      getScopedQueryFilter(orFilter(), EntityType.ALL)
    );

    expect(scoped).not.toContain('entityType.keyword');
  });
});

describe('fetchQueryBuilderCount', () => {
  beforeEach(() => {
    searchQuery.mockReset();
  });

  it('should return the total hit count', async () => {
    searchQuery.mockResolvedValue({ hits: { total: { value: 142 } } });

    await expect(fetchQueryBuilderCount(filterWithTerm())).resolves.toBe(142);
  });

  it('should count only, never fetching source rows', async () => {
    searchQuery.mockResolvedValue({ hits: { total: { value: 1 } } });

    await fetchQueryBuilderCount(filterWithTerm());

    expect(searchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        pageSize: 0,
        fetchSource: false,
        // Without this the count silently caps at 10,000.
        trackTotalHits: true,
      })
    );
  });

  it('should report 0 rather than a stale count when the search fails', async () => {
    searchQuery.mockRejectedValue(new Error('boom'));

    // A stale count reads as a successful narrowing that never happened.
    await expect(fetchQueryBuilderCount(filterWithTerm())).resolves.toBe(0);
  });

  it('should treat a missing total as 0', async () => {
    searchQuery.mockResolvedValue({ hits: { total: {} } });

    await expect(fetchQueryBuilderCount(filterWithTerm())).resolves.toBe(0);
  });
});
