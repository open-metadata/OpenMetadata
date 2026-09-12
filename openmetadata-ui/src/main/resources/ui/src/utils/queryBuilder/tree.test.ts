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
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import {
  EntityFields,
  EntityReferenceFields,
} from '../../enums/AdvancedSearch.enum';
import {
  getEmptyFlatJsonTree,
  getEmptyJsonTree,
  getEmptyJsonTreeForQueryBuilder,
  getEmptyQueryBuilderTree,
  loadQueryBuilderTree,
} from './tree';

// setupTests.js globally stubs `getQbConfigs` to `{}`; these cases build a real
// config to load trees against.
jest.mock('../AdvancedSearchClassBase', () =>
  jest.requireActual('../AdvancedSearchClassBase')
);

describe('queryBuilder tree seeds', () => {
  describe('getEmptyJsonTree', () => {
    it('should return a default JsonTree structure with OWNERS as the default field', () => {
      const result = getEmptyJsonTree();

      expect(result.type).toBe('group');
      expect(result.properties).toEqual({
        conjunction: 'AND',
        not: false,
      });

      const children1Keys = Object.keys(result.children1 ?? {});

      expect(children1Keys.length).toBe(1);

      const children1AsRecord = result.children1 as Record<
        string,
        {
          type: string;
          children1?: Record<
            string,
            { type: string; properties?: { field: string } }
          >;
        }
      >;
      const firstChild = children1AsRecord[children1Keys[0]];

      expect(firstChild?.type).toBe('group');

      const grandChildren1Keys = Object.keys(firstChild?.children1 ?? {});

      expect(grandChildren1Keys.length).toBe(1);

      const grandChildren1AsRecord = firstChild?.children1 as Record<
        string,
        { type: string; properties?: { field: string } }
      >;
      const grandChild = grandChildren1AsRecord[grandChildren1Keys[0]];

      expect(grandChild?.type).toBe('rule');
      expect(grandChild?.properties?.field).toBe(EntityFields.OWNERS);
    });

    it('should use the provided field when passed as parameter', () => {
      const customField = EntityFields.TAG;
      const result = getEmptyJsonTree(customField);

      const children1 = result.children1 as Record<
        string,
        { children1: Record<string, { properties: { field: string } }> }
      >;
      const firstChildKey = Object.keys(children1)[0];
      const firstChild = children1[firstChildKey] as {
        children1: Record<string, { properties: { field: string } }>;
      };
      const grandChildKey = Object.keys(firstChild.children1)[0];

      expect(firstChild.children1[grandChildKey]?.properties.field).toEqual(
        customField
      );
    });
  });

  describe('getEmptyJsonTreeForQueryBuilder', () => {
    it('should return a JsonTree structure with default parameters', () => {
      const result = getEmptyJsonTreeForQueryBuilder();

      expect(result.type).toBe('group');
      expect(result.properties).toEqual({
        conjunction: 'AND',
        not: false,
      });

      const children1Keys = Object.keys(result.children1 ?? {});

      expect(children1Keys.length).toBe(1);

      const children1AsRecord = result.children1 as Record<
        string,
        {
          type: string;
          properties?: { field: string; mode: string };
          children1?: Record<
            string,
            { type: string; properties?: { field: string; operator: string } }
          >;
        }
      >;
      const firstChild = children1AsRecord[children1Keys[0]];

      expect(firstChild?.type).toBe('rule_group');
      expect(firstChild?.properties?.field).toBe(EntityReferenceFields.OWNERS);
      expect(firstChild?.properties?.mode).toBe('some');

      const grandChildren1Keys = Object.keys(firstChild?.children1 ?? {});

      expect(grandChildren1Keys.length).toBe(1);

      const grandChildren1AsRecord = firstChild?.children1 as Record<
        string,
        { type: string; properties?: { field: string; operator: string } }
      >;
      const grandChild = grandChildren1AsRecord[grandChildren1Keys[0]];

      expect(grandChild?.type).toBe('rule');
      expect(grandChild?.properties?.field).toBe(
        `${EntityReferenceFields.OWNERS}.fullyQualifiedName`
      );
      expect(grandChild?.properties?.operator).toBe('select_equals');
    });

    it('should use custom field when provided', () => {
      const customField = EntityReferenceFields.TAG;
      const result = getEmptyJsonTreeForQueryBuilder(customField);

      const children1 = result.children1 as Record<
        string,
        {
          properties: { field: string };
          children1: Record<string, { properties: { field: string } }>;
        }
      >;
      const firstChildKey = Object.keys(children1)[0];
      const firstChild = children1[firstChildKey] as {
        properties: { field: string };
        children1: Record<string, { properties: { field: string } }>;
      };
      const grandChildKey = Object.keys(firstChild.children1)[0];

      expect(firstChild.properties.field).toEqual(customField);
      expect(firstChild.children1[grandChildKey]?.properties.field).toEqual(
        `${customField}.fullyQualifiedName`
      );
    });

    it('should use custom subField when provided', () => {
      const customSubField = 'name';
      const result = getEmptyJsonTreeForQueryBuilder(
        EntityReferenceFields.OWNERS,
        customSubField
      );

      const children1 = result.children1 as Record<
        string,
        { children1: Record<string, { properties: { field: string } }> }
      >;
      const firstChildKey = Object.keys(children1)[0];
      const firstChild = children1[firstChildKey] as {
        children1: Record<string, { properties: { field: string } }>;
      };
      const grandChildKey = Object.keys(firstChild.children1)[0];

      expect(firstChild.children1[grandChildKey]?.properties.field).toEqual(
        `${EntityReferenceFields.OWNERS}.${customSubField}`
      );
    });

    it('should have rule_group as the type for the first child', () => {
      const result = getEmptyJsonTreeForQueryBuilder();

      const children1 = result.children1 as Record<string, { type: string }>;
      const firstChildKey = Object.keys(children1)[0];

      expect(children1[firstChildKey].type).toEqual('rule_group');
    });
  });
});

describe('loadQueryBuilderTree', () => {
  const config = jest.requireActual('./config').buildQueryBuilderConfig({
    outputType: SearchOutputType.ElasticSearch,
    searchIndex: 'table',
    groupMode: 'flat',
  });

  const rootType = (tree: unknown) =>
    (QbUtils.getTree(tree as never) as { type?: string })?.type;

  it('should use a saved tree when one is given', () => {
    const saved = getEmptyFlatJsonTree('owners');
    const loaded = loadQueryBuilderTree({
      config,
      tree: saved,
      outputType: SearchOutputType.ElasticSearch,
    });

    expect(rootType(loaded)).toBe('group');
  });

  it('should seed an empty tree when there is no value', () => {
    const loaded = loadQueryBuilderTree({
      config,
      outputType: SearchOutputType.ElasticSearch,
      groupMode: 'flat',
    });

    expect(rootType(loaded)).toBe('group');
  });

  // A corrupt persisted value must not blank the builder.
  it('should fall back to the seed when the value is not JSON', () => {
    const loaded = loadQueryBuilderTree({
      config,
      value: 'not json at all',
      outputType: SearchOutputType.ElasticSearch,
    });

    expect(rootType(loaded)).toBe('group');
  });

  it('should fall back to the seed when the ES filter yields no tree', () => {
    const loaded = loadQueryBuilderTree({
      config,
      value: JSON.stringify({ query: { bool: { must: [] } } }),
      outputType: SearchOutputType.ElasticSearch,
    });

    expect(rootType(loaded)).toBe('group');
  });

  // RAQB throws outright when a saved rule names a field the config no longer
  // defines — which happens whenever a field is renamed.
  it('should fall back to the seed when JSONLogic references an unknown field', () => {
    const loaded = loadQueryBuilderTree({
      config,
      value: JSON.stringify({ '==': [{ var: 'no.such.field' }, 'x'] }),
      outputType: SearchOutputType.JSONLogic,
    });

    expect(rootType(loaded)).toBe('group');
  });
});

describe('getEmptyQueryBuilderTree', () => {
  it('should seed a rule_group for JSONLogic in either group mode', () => {
    for (const groupMode of ['flat', 'nested'] as const) {
      const seed = getEmptyQueryBuilderTree({
        outputType: SearchOutputType.JSONLogic,
        groupMode,
      });
      const child = Object.values(seed.children1 ?? {})[0] as { type: string };

      expect(child.type).toBe('rule_group');
    }
  });

  it('should seed one level deep for flat Elasticsearch', () => {
    const seed = getEmptyQueryBuilderTree({
      outputType: SearchOutputType.ElasticSearch,
      groupMode: 'flat',
    });
    const child = Object.values(seed.children1 ?? {})[0] as { type: string };

    expect(child.type).toBe('rule');
  });

  it('should seed a nested group for nested Elasticsearch', () => {
    const seed = getEmptyQueryBuilderTree({
      outputType: SearchOutputType.ElasticSearch,
      groupMode: 'nested',
    });
    const child = Object.values(seed.children1 ?? {})[0] as { type: string };

    expect(child.type).toBe('group');
  });
});

describe('loadQueryBuilderTree – fallbacks', () => {
  const esConfig = jest.requireActual('./config').buildQueryBuilderConfig({
    outputType: SearchOutputType.ElasticSearch,
    searchIndex: 'table',
    groupMode: 'flat',
  });
  const jsonLogicConfig = jest
    .requireActual('./config')
    .buildQueryBuilderConfig({
      outputType: SearchOutputType.JSONLogic,
      searchIndex: 'table',
      groupMode: 'flat',
    });

  const rootType = (tree: unknown) =>
    (QbUtils.getTree(tree as never) as { type?: string })?.type;

  it('should fall back to the seed when the filter converts to an empty tree', () => {
    const loaded = loadQueryBuilderTree({
      config: esConfig,
      value: JSON.stringify({ query: { bool: { must: [] } } }),
      outputType: SearchOutputType.ElasticSearch,
    });

    expect(rootType(loaded)).toBe('group');
  });

  it('should fall back to the seed when RAQB returns no tree', () => {
    const spy = jest
      .spyOn(QbUtils, 'loadFromJsonLogic')
      .mockReturnValue(undefined as never);

    try {
      const loaded = loadQueryBuilderTree({
        config: jsonLogicConfig,
        value: JSON.stringify({ '==': [1, 1] }),
        outputType: SearchOutputType.JSONLogic,
      });

      expect(rootType(loaded)).toBe('group');
    } finally {
      spy.mockRestore();
    }
  });

  it('should fall back to the seed when RAQB throws', () => {
    const spy = jest
      .spyOn(QbUtils, 'loadFromJsonLogic')
      .mockImplementation(() => {
        throw new Error('unknown field');
      });

    try {
      const loaded = loadQueryBuilderTree({
        config: jsonLogicConfig,
        value: JSON.stringify({ '==': [1, 1] }),
        outputType: SearchOutputType.JSONLogic,
      });

      expect(rootType(loaded)).toBe('group');
    } finally {
      spy.mockRestore();
    }
  });

  it('should rebuild the tree from a stored elasticsearch filter', () => {
    const loaded = loadQueryBuilderTree({
      config: esConfig,
      value: JSON.stringify({
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
      }),
      outputType: SearchOutputType.ElasticSearch,
    });

    expect(rootType(loaded)).toBe('group');
  });

  it('should keep a JSONLogic tree that RAQB could load', () => {
    const seeded = QbUtils.loadTree(getEmptyFlatJsonTree('owners'));
    const spy = jest
      .spyOn(QbUtils, 'loadFromJsonLogic')
      .mockReturnValue(seeded as never);

    try {
      const loaded = loadQueryBuilderTree({
        config: jsonLogicConfig,
        value: JSON.stringify({ '==': [1, 1] }),
        outputType: SearchOutputType.JSONLogic,
      });

      expect(rootType(loaded)).toBe('group');
    } finally {
      spy.mockRestore();
    }
  });

  it('should fall back to the seed when JSONLogic cannot be loaded', () => {
    const loaded = loadQueryBuilderTree({
      config: jsonLogicConfig,
      value: JSON.stringify({ '==': [{ var: 'noSuchField' }, 'x'] }),
      outputType: SearchOutputType.JSONLogic,
    });

    expect(rootType(loaded)).toBe('group');
  });

  it('should fall back to the seed when JSONLogic parsing throws', () => {
    const loaded = loadQueryBuilderTree({
      config: jsonLogicConfig,
      value: JSON.stringify({ '==': null }),
      outputType: SearchOutputType.JSONLogic,
    });

    expect(rootType(loaded)).toBe('group');
  });
});
