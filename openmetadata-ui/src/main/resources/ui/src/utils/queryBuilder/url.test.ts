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
import {
  buildExploreUrlParams,
  getQueryBuilderExploreUrl,
  withExploreFieldKeys,
} from './url';

type QueryFilter = Parameters<typeof getQueryBuilderExploreUrl>[0];

jest.mock('../RouterUtils', () => ({
  getExplorePath: jest.fn(
    ({ extraParameters }) =>
      `/explore?${new URLSearchParams(extraParameters ?? {}).toString()}`
  ),
}));

describe('buildExploreUrlParams', () => {
  const builderFilter: QueryFilter = {
    query: {
      bool: {
        must: [{ term: { 'owner.displayName.keyword': 'admin' } }],
      },
    },
  };
  const scopedFilter: QueryFilter = {
    query: {
      bool: {
        must: [
          builderFilter.query as never,
          { bool: { must: [{ term: { 'entityType.keyword': 'table' } }] } },
        ],
      },
    },
  };

  it('opens the builder filter as one Advanced Search group', () => {
    const result = buildExploreUrlParams(builderFilter, scopedFilter);

    expect(JSON.parse(result.queryFilter)).toEqual({
      query: { bool: { must: [builderFilter.query] } },
    });
  });

  it('applies the scoped filter as the quick filter', () => {
    expect(
      JSON.parse(buildExploreUrlParams(builderFilter, scopedFilter).quickFilter)
    ).toEqual(scopedFilter);
  });

  it('applies the builder filter itself when it is not scoped', () => {
    expect(
      JSON.parse(buildExploreUrlParams(builderFilter).quickFilter)
    ).toEqual(builderFilter);
  });

  it.each([
    ['no filter', undefined],
    ['a filter with no query', {} as QueryFilter],
  ])('carries nothing for %s', (_name, filter) => {
    expect(buildExploreUrlParams(filter)).toEqual({});
  });

  it('never carries a builder tree', () => {
    const { queryFilter } = buildExploreUrlParams(builderFilter, scopedFilter);

    expect(queryFilter).not.toContain('children1');
  });
});

// Explore validates a deep-linked tree against its own config and silently
// resets when a field is unknown — landing on the unfiltered estate with no
// advanced-search chip. A builder pinned to one entity type keys custom
// properties without that segment, so the link has to carry Explore's shape.
describe('withExploreFieldKeys', () => {
  const treeWith = (field: string) => ({
    id: 'root',
    type: 'group',
    children1: {
      r1: { type: 'rule', id: 'r1', properties: { field, operator: 'equal' } },
    },
  });

  const fieldOf = (tree: ReturnType<typeof treeWith>) =>
    (tree.children1.r1.properties as { field: string }).field;

  it('should add the entity-type segment for a pinned key', () => {
    const out = withExploreFieldKeys(
      treeWith('extension.testCp.keyword'),
      'table'
    ) as ReturnType<typeof treeWith>;

    expect(fieldOf(out)).toBe('extension.table.testCp.keyword');
  });

  it('should not double up a key that already carries the segment', () => {
    const out = withExploreFieldKeys(
      treeWith('extension.table.testCp.keyword'),
      'table'
    ) as ReturnType<typeof treeWith>;

    expect(fieldOf(out)).toBe('extension.table.testCp.keyword');
  });

  it('should leave non-extension fields alone', () => {
    const out = withExploreFieldKeys(
      treeWith('owners.displayName.keyword'),
      'table'
    ) as ReturnType<typeof treeWith>;

    expect(fieldOf(out)).toBe('owners.displayName.keyword');
  });

  it('should be a no-op when the builder is not pinned', () => {
    const tree = treeWith('extension.testCp.keyword');

    expect(withExploreFieldKeys(tree, undefined)).toBe(tree);
  });
});

describe('getQueryBuilderExploreUrl', () => {
  const ownerFilter = {
    query: {
      bool: {
        must: [
          {
            bool: {
              must: [{ term: { 'owners.displayName.keyword': 'admin' } }],
            },
          },
        ],
      },
    },
  } as unknown as QueryFilter;

  it('links Explore with the builder filter and the filter it searched with', () => {
    const scoped = {
      query: { bool: { must: [ownerFilter.query, { term: { x: 'y' } }] } },
    } as unknown as QueryFilter;
    const params = new URLSearchParams(
      getQueryBuilderExploreUrl(ownerFilter, scoped).split('?')[1]
    );

    expect(JSON.parse(params.get('queryFilter') ?? '')).toEqual({
      query: { bool: { must: [ownerFilter.query] } },
    });
    expect(JSON.parse(params.get('quickFilter') ?? '')).toEqual(scoped);
  });
});

describe('withExploreFieldKeys – array children', () => {
  it('should rewrite through array-shaped children', () => {
    const tree = {
      id: 'root',
      type: 'group',
      children1: [
        {
          type: 'rule',
          id: 'r1',
          properties: { field: 'extension.testCp.keyword' },
        },
      ],
    };

    const out = withExploreFieldKeys(tree, 'table') as typeof tree;

    expect((out.children1[0].properties as { field: string }).field).toBe(
      'extension.table.testCp.keyword'
    );
  });
});

describe('withExploreFieldKeys – nodes without children', () => {
  it('should handle a leaf node with no children1', () => {
    const leaf = {
      type: 'rule',
      id: 'r1',
      properties: { field: 'extension.testCp.keyword' },
    };

    const out = withExploreFieldKeys(leaf, 'table') as typeof leaf;

    expect(out.properties.field).toBe('extension.table.testCp.keyword');
  });

  it('should leave a node with no properties alone', () => {
    const node = { id: 'root', type: 'group' };

    expect(withExploreFieldKeys(node, 'table')).toEqual(node);
  });
});
