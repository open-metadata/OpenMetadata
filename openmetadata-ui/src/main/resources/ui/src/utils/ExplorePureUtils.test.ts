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
import { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { ExploreTreeNode } from '../components/Explore/ExploreTree/ExploreTree.interface';
import { EntityType } from '../enums/entity.enum';
import {
  findTreeNodeKeyByBrowsePath,
  getBrowsePathQueryFilter,
  getCanonicalEntityType,
  getDisabledExploreTreeKeys,
  parseBrowsePathFields,
  truncateBrowsePath,
} from './ExplorePureUtils';

const DATABASE_KEY = 'database_root';
const DASHBOARD_KEY = 'dashboard_root';
const PIPELINE_KEY = 'pipeline_root';
const GOVERNANCE_KEY = 'governance_root';

const treeNodes = [
  {
    key: DATABASE_KEY,
    title: 'Databases',
    data: {
      isRoot: true,
      childEntities: [
        EntityType.DATABASE,
        EntityType.DATABASE_SCHEMA,
        EntityType.STORED_PROCEDURE,
        EntityType.TABLE,
        EntityType.TABLE_COLUMN,
      ],
    },
  },
  {
    key: DASHBOARD_KEY,
    title: 'Dashboards',
    data: {
      isRoot: true,
      childEntities: [
        EntityType.DASHBOARD_DATA_MODEL,
        EntityType.DASHBOARD,
        EntityType.CHART,
      ],
    },
  },
  {
    key: PIPELINE_KEY,
    title: 'Pipelines',
    data: { isRoot: true, childEntities: [EntityType.PIPELINE] },
  },
  {
    key: GOVERNANCE_KEY,
    title: 'Governance',
    data: {
      isRoot: true,
      childEntities: [EntityType.TAG, EntityType.GLOSSARY_TERM],
    },
  },
] as ExploreTreeNode[];

describe('getDisabledExploreTreeKeys', () => {
  it('disables nothing when no entity type is selected', () => {
    expect(getDisabledExploreTreeKeys(treeNodes, []).size).toBe(0);
  });

  it('disables every category except Database when Table is selected', () => {
    const disabled = getDisabledExploreTreeKeys(treeNodes, [EntityType.TABLE]);

    expect(disabled.has(DATABASE_KEY)).toBe(false);
    expect(disabled.has(DASHBOARD_KEY)).toBe(true);
    expect(disabled.has(PIPELINE_KEY)).toBe(true);
    expect(disabled.has(GOVERNANCE_KEY)).toBe(true);
  });

  it('keeps the Database category enabled for a nested asset type like Column', () => {
    const disabled = getDisabledExploreTreeKeys(treeNodes, [
      EntityType.TABLE_COLUMN,
    ]);

    expect(disabled.has(DATABASE_KEY)).toBe(false);
    expect(disabled.has(DASHBOARD_KEY)).toBe(true);
  });

  it('enables every category that holds any selected type (multi-select)', () => {
    const disabled = getDisabledExploreTreeKeys(treeNodes, [
      EntityType.TABLE,
      EntityType.DASHBOARD,
    ]);

    expect(disabled.has(DATABASE_KEY)).toBe(false);
    expect(disabled.has(DASHBOARD_KEY)).toBe(false);
    expect(disabled.has(PIPELINE_KEY)).toBe(true);
    expect(disabled.has(GOVERNANCE_KEY)).toBe(true);
  });

  it('disables all categories when the selected type belongs to none of them', () => {
    const disabled = getDisabledExploreTreeKeys(treeNodes, ['nonExistentType']);

    expect(disabled.size).toBe(treeNodes.length);
  });

  it('matches entity types case-insensitively (e.g. aggregated tablecolumn vs enum tableColumn)', () => {
    const disabled = getDisabledExploreTreeKeys(treeNodes, ['tablecolumn']);

    expect(disabled.has(DATABASE_KEY)).toBe(false);
    expect(disabled.has(DASHBOARD_KEY)).toBe(true);
  });

  it('treats a category with no childEntities as disabled under any selection', () => {
    const nodes = [
      { key: 'empty_root', title: 'Empty', data: { isRoot: true } },
    ] as ExploreTreeNode[];

    expect(
      getDisabledExploreTreeKeys(nodes, [EntityType.TABLE]).has('empty_root')
    ).toBe(true);
  });
});

const browseFields: ExploreQuickFilterField[] = [
  {
    key: 'entityType',
    label: 'Databases',
    value: [
      { key: 'table', label: 'table' },
      { key: 'tableColumn', label: 'tableColumn' },
    ],
  },
  {
    key: 'serviceType',
    label: 'serviceType',
    value: [{ key: 'Redshift', label: 'Redshift' }],
  },
  {
    key: 'service.displayName.keyword',
    label: 'service.displayName.keyword',
    value: [{ key: 'redshift prod', label: 'redshift prod' }],
  },
  {
    key: 'database.displayName',
    label: 'database.displayName',
    value: [{ key: 'dev', label: 'dev' }],
  },
];

describe('parseBrowsePathFields', () => {
  it('returns an empty array for undefined, empty, or invalid JSON', () => {
    expect(parseBrowsePathFields(undefined)).toEqual([]);
    expect(parseBrowsePathFields('')).toEqual([]);
    expect(parseBrowsePathFields('not-json')).toEqual([]);
    expect(parseBrowsePathFields('{"a":1}')).toEqual([]);
  });

  it('round-trips a serialized browse path', () => {
    expect(parseBrowsePathFields(JSON.stringify(browseFields))).toEqual(
      browseFields
    );
  });

  it('drops malformed elements from a crafted browsePath param', () => {
    expect(parseBrowsePathFields('[1,2,3]')).toEqual([]);
    expect(parseBrowsePathFields('[{}]')).toEqual([]);
    expect(parseBrowsePathFields('[null]')).toEqual([]);
    expect(
      parseBrowsePathFields('[{"key":"serviceType","value":"not-an-array"}]')
    ).toEqual([]);
  });

  it('drops a field whose value array has elements without a string key', () => {
    expect(
      parseBrowsePathFields('[{"key":"serviceType","value":[null]}]')
    ).toEqual([]);
    expect(
      parseBrowsePathFields('[{"key":"serviceType","value":[{}]}]')
    ).toEqual([]);
    expect(
      parseBrowsePathFields('[{"key":"serviceType","value":[{"key":1}]}]')
    ).toEqual([]);
  });

  it('keeps well-formed fields while dropping garbage siblings', () => {
    const valid = {
      key: 'serviceType',
      label: 'serviceType',
      value: [{ key: 'Mysql', label: 'Mysql' }],
    };
    const noValue = { key: 'entityType' };

    expect(
      parseBrowsePathFields(JSON.stringify([valid, 42, {}, noValue]))
    ).toEqual([valid, noValue]);
  });
});

describe('getBrowsePathQueryFilter', () => {
  it('returns undefined for an empty path', () => {
    expect(getBrowsePathQueryFilter([])).toBeUndefined();
  });

  it('builds an AND of per-level should terms', () => {
    const filter = getBrowsePathQueryFilter(browseFields);
    const must = filter?.query?.bool?.must as Array<{
      bool: { should: Array<{ term: Record<string, string> }> };
    }>;

    expect(must).toHaveLength(4);
    expect(must[1].bool.should).toEqual([
      { term: { serviceType: 'Redshift' } },
    ]);
    expect(must[2].bool.should).toEqual([
      { term: { 'service.displayName.keyword': 'redshift prod' } },
    ]);
  });

  it('keeps existing lowercase semantics for the category entityType level', () => {
    const filter = getBrowsePathQueryFilter([browseFields[0]]);
    const must = filter?.query?.bool?.must as Array<{
      bool: { should: Array<{ term: Record<string, string> }> };
    }>;

    expect(must[0].bool.should).toEqual([
      { term: { 'entityType.keyword': 'table' } },
      { term: { 'entityType.keyword': 'tablecolumn' } },
    ]);
  });
});

describe('truncateBrowsePath', () => {
  it('removes the given level and everything after it', () => {
    const result = truncateBrowsePath(
      browseFields,
      'service.displayName.keyword'
    );

    expect(result.map((field) => field.key)).toEqual([
      'entityType',
      'serviceType',
    ]);
  });

  it('removing the first level clears the whole path', () => {
    expect(truncateBrowsePath(browseFields, 'entityType')).toEqual([]);
  });

  it('returns the path unchanged when the level is not present', () => {
    expect(truncateBrowsePath(browseFields, 'unknown.key')).toEqual(
      browseFields
    );
  });
});

describe('getBrowsePathQueryFilter — OR within a field, AND across fields', () => {
  it('two tiers in one field become one must clause with two should terms (Tier1 OR Tier2)', () => {
    const filter = getBrowsePathQueryFilter([
      {
        key: 'tier.tagFQN',
        label: 'tier.tagFQN',
        value: [
          { key: 'Tier.Tier1', label: 'Tier.Tier1' },
          { key: 'Tier.Tier2', label: 'Tier.Tier2' },
        ],
      },
    ]);
    const must = filter?.query?.bool?.must as Array<{
      bool: { should: Array<{ term: Record<string, string> }> };
    }>;

    expect(must).toHaveLength(1);
    expect(must[0].bool.should).toEqual([
      { term: { 'tier.tagFQN': 'Tier.Tier1' } },
      { term: { 'tier.tagFQN': 'Tier.Tier2' } },
    ]);
  });

  it('values across two fields become two must clauses (tier AND tag)', () => {
    const filter = getBrowsePathQueryFilter([
      {
        key: 'tier.tagFQN',
        label: 'tier.tagFQN',
        value: [
          { key: 'Tier.Tier1', label: 'Tier.Tier1' },
          { key: 'Tier.Tier2', label: 'Tier.Tier2' },
        ],
      },
      {
        key: 'tags.tagFQN',
        label: 'tags.tagFQN',
        value: [{ key: 'PII.Sensitive', label: 'PII.Sensitive' }],
      },
    ]);
    const must = filter?.query?.bool?.must as Array<{
      bool: { should: Array<{ term: Record<string, string> }> };
    }>;

    expect(must).toHaveLength(2);
    expect(must[0].bool.should).toHaveLength(2);
    expect(must[1].bool.should).toEqual([
      { term: { 'tags.tagFQN': 'PII.Sensitive' } },
    ]);
  });

  it('fields without values contribute no must clause', () => {
    const filter = getBrowsePathQueryFilter([
      { key: 'tier.tagFQN', label: 'tier.tagFQN', value: [] },
      {
        key: 'tags.tagFQN',
        label: 'tags.tagFQN',
        value: [{ key: 'PII.Sensitive', label: 'PII.Sensitive' }],
      },
    ]);
    const must = filter?.query?.bool?.must as unknown[];

    expect(must).toHaveLength(1);
  });
});

describe('getCanonicalEntityType', () => {
  it('resolves lowercase aggregation keys to the EntityType enum casing', () => {
    expect(getCanonicalEntityType('tablecolumn')).toBe('tableColumn');
    expect(getCanonicalEntityType('storedprocedure')).toBe('storedProcedure');
    expect(getCanonicalEntityType('table')).toBe('table');
  });

  it('passes through unknown values unchanged', () => {
    expect(getCanonicalEntityType('somethingElse')).toBe('somethingElse');
  });
});

describe('findTreeNodeKeyByBrowsePath', () => {
  const serviceField: ExploreQuickFilterField = {
    key: 'serviceType',
    label: 'serviceType',
    value: [{ key: 'Mysql', label: 'Mysql' }],
  };
  const nodes = [
    {
      key: 'db_root',
      title: 'Databases',
      data: {
        isRoot: true,
        childEntities: [EntityType.TABLE, EntityType.TABLE_COLUMN],
      },
      children: [
        {
          key: 'svc_mysql',
          title: 'mysql',
          data: { filterField: [serviceField] },
        },
      ],
    },
  ] as unknown as ExploreTreeNode[];

  it('matches a category root by its childEntities set', () => {
    const key = findTreeNodeKeyByBrowsePath(nodes, [
      {
        key: 'entityType',
        label: 'Databases',
        value: [
          { key: 'table', label: 'table' },
          { key: 'tableColumn', label: 'tableColumn' },
        ],
      },
    ]);

    expect(key).toBe('db_root');
  });

  it('matches a nested node by its filter-field signature', () => {
    expect(findTreeNodeKeyByBrowsePath(nodes, [serviceField])).toBe(
      'svc_mysql'
    );
  });

  it('returns null when no loaded node corresponds to the path', () => {
    expect(
      findTreeNodeKeyByBrowsePath(nodes, [
        {
          key: 'serviceType',
          label: 'serviceType',
          value: [{ key: 'Redshift', label: 'Redshift' }],
        },
      ])
    ).toBeNull();
  });

  it('returns null for an empty path', () => {
    expect(findTreeNodeKeyByBrowsePath(nodes, [])).toBeNull();
  });
});
