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
import { SearchIndex } from '../../enums/search.enum';
import advancedSearchClassBase from '../AdvancedSearchClassBase';
import {
  buildExploreUrlParams,
  getQueryBuilderExploreUrl,
  withExploreFieldKeys,
} from './url';

type QueryFilter = Parameters<typeof getQueryBuilderExploreUrl>[0];

jest.mock('../AdvancedSearchClassBase', () =>
  jest.requireActual('../AdvancedSearchClassBase')
);

jest.mock('../RouterUtils', () => ({
  getExplorePath: jest.fn(
    ({ extraParameters }) =>
      `/explore?${new URLSearchParams(extraParameters ?? {}).toString()}`
  ),
}));

describe('buildExploreUrlParams', () => {
  const mockTree = { id: 'root', type: 'group', children1: {} };
  const mockQFilter: QueryFilter = {
    query: {
      bool: {
        must: [{ term: { 'owner.displayName.keyword': 'admin' } }],
      },
    },
  };

  it('should return empty object when both tree and qFilter are empty', () => {
    const result = buildExploreUrlParams({}, undefined);

    expect(result).toEqual({});
  });

  it('should return only queryFilter when tree is provided but qFilter is empty', () => {
    const result = buildExploreUrlParams(mockTree, undefined);

    expect(result).toEqual({
      queryFilter: JSON.stringify(mockTree),
    });
    expect(result.quickFilter).toBeUndefined();
  });

  it('should return only quickFilter when qFilter has query but tree is empty', () => {
    const result = buildExploreUrlParams({}, mockQFilter);

    expect(result).toEqual({
      quickFilter: JSON.stringify(mockQFilter),
    });
    expect(result.queryFilter).toBeUndefined();
  });

  it('should return both queryFilter and quickFilter when both are provided', () => {
    const result = buildExploreUrlParams(mockTree, mockQFilter);

    expect(result).toEqual({
      queryFilter: JSON.stringify(mockTree),
      quickFilter: JSON.stringify(mockQFilter),
    });
  });

  it('should not include quickFilter when qFilter exists but has no query property', () => {
    const qFilterWithoutQuery = {
      someOtherProp: 'value',
    } as unknown as QueryFilter;
    const result = buildExploreUrlParams(mockTree, qFilterWithoutQuery);

    expect(result).toEqual({
      queryFilter: JSON.stringify(mockTree),
    });
    expect(result.quickFilter).toBeUndefined();
  });

  it('should handle null tree gracefully', () => {
    const result = buildExploreUrlParams(null, mockQFilter);

    expect(result).toEqual({
      quickFilter: JSON.stringify(mockQFilter),
    });
  });

  it('should return valid JSON strings', () => {
    const result = buildExploreUrlParams(mockTree, mockQFilter);

    expect(() => JSON.parse(result.queryFilter as string)).not.toThrow();
    expect(() => JSON.parse(result.quickFilter as string)).not.toThrow();
  });

  it('should produce params that can be URL encoded with proper separators', () => {
    const result = buildExploreUrlParams(mockTree, mockQFilter);

    const allParams = { mode: 'edit', ...result };
    const queryString = new URLSearchParams(allParams).toString();

    expect(queryString).toContain('mode=edit');
    expect(queryString).toContain('&');
    expect(queryString).toContain('queryFilter=');
    expect(queryString).toContain('quickFilter=');

    const decoded = new URLSearchParams(queryString);

    expect(decoded.get('mode')).toBe('edit');
    expect(JSON.parse(decoded.get('queryFilter') as string)).toEqual(mockTree);
    expect(JSON.parse(decoded.get('quickFilter') as string)).toEqual(
      mockQFilter
    );
  });

  it('should work correctly when only queryFilter is present with other params', () => {
    const result = buildExploreUrlParams(mockTree, undefined);

    const allParams = { mode: 'view', ...result };
    const queryString = new URLSearchParams(allParams).toString();

    expect(queryString).toContain('mode=view');
    expect(queryString).toContain('queryFilter=');
    expect(queryString).not.toContain('quickFilter=');

    const ampersandCount = (queryString.match(/&/g) || []).length;

    expect(ampersandCount).toBe(1);
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
  const config = () =>
    advancedSearchClassBase.getQbConfigs([SearchIndex.TABLE], {});

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

  it('should put the tree in the queryFilter param', () => {
    const url = getQueryBuilderExploreUrl(ownerFilter, config());

    expect(url).toContain('queryFilter=');
    expect(decodeURIComponent(url)).toContain('owners.displayName.keyword');
  });

  it('should also carry the elasticsearch filter as quickFilter', () => {
    expect(getQueryBuilderExploreUrl(ownerFilter, config())).toContain(
      'quickFilter='
    );
  });

  it('should rewrite pinned custom-property keys for Explore', () => {
    const cfg = config();
    const pinned = {
      ...cfg,
      settings: { ...cfg.settings, omEntityType: 'table' },
    } as ReturnType<typeof config>;
    const cpFilter = {
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [{ term: { 'extension.testCp.keyword': 'x' } }],
              },
            },
          ],
        },
      },
    } as unknown as QueryFilter;

    const url = decodeURIComponent(getQueryBuilderExploreUrl(cpFilter, pinned));

    expect(url).not.toContain('"field":"extension.testCp.keyword"');
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

describe('buildExploreUrlParams – omitted filter', () => {
  it('should omit quickFilter when no filter is passed at all', () => {
    expect(buildExploreUrlParams({ id: 'root' })).toEqual({
      queryFilter: JSON.stringify({ id: 'root' }),
    });
  });
});
