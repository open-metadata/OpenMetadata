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
import { SearchOutputType } from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { getJsonTreeFromQueryFilter } from './QueryBuilderPureUtils';
import { buildQueryBuilderConfig } from './queryBuilder/config';
import { formatQuery } from './queryBuilder/formatters';
import { QUERY_BUILDER_GROUP_MODE } from './queryBuilder/types';

jest.mock('./AdvancedSearchClassBase', () =>
  jest.requireActual('./AdvancedSearchClassBase')
);

const base = buildQueryBuilderConfig({
  outputType: SearchOutputType.ElasticSearch,
  searchIndex: SearchIndex.TABLE,
  entityType: EntityType.TABLE,
  groupMode: QUERY_BUILDER_GROUP_MODE.FLAT,
  showLabels: false,
  useFriendlyOperatorLabels: true,
});

const cp = (
  type: string,
  extra: Record<string, unknown> = {},
  omType = 'string'
) => ({
  type,
  label: 'CP',
  valueSources: ['value'],
  __omPropertyType: omType,
  ...extra,
});

const config = {
  ...base,
  fields: {
    ...base.fields,
    extension: {
      ...(base.fields.extension as object),
      subfields: {
        'strCP.keyword': cp('text', {
          operators: [
            'equal',
            'not_equal',
            'like',
            'not_like',
            'is_null',
            'is_not_null',
          ],
        }),
        numCP: cp(
          'number',
          {
            operators: [
              'equal',
              'not_equal',
              'between',
              'not_between',
              'is_null',
              'is_not_null',
            ],
          },
          'integer'
        ),
        'tableCP.rows.name': cp(
          'text',
          {
            operators: ['equal', 'not_equal', 'like', 'not_like'],
          },
          'table-cp'
        ),
        'refCP.displayName.keyword': cp(
          'select',
          {
            operators: [
              'select_equals',
              'select_not_equals',
              'is_null',
              'is_not_null',
            ],
          },
          'entityReference'
        ),
      },
    },
  },
} as unknown as typeof base;

const ruleTree = (field: string, operator: string, value: unknown[]) =>
  QbUtils.checkTree(
    QbUtils.loadTree({
      id: 'aaaaaaaa-1111-4111-8111-111111111111',
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        'bbbbbbbb-2222-4222-8222-222222222222': {
          type: 'rule',
          properties: {
            field,
            operator,
            value,
            valueSrc: value.map(() => 'value'),
          },
        },
      },
    } as never),
    config
  );

interface ParsedNode {
  type?: string;
  properties?: { field?: string; operator?: string; value?: unknown[] };
  children1?: Record<string, ParsedNode>;
}

/** Leaf rules plus the `rule_group` chain wrapping each; the canvas draws one
 * Field control per wrapper. */
const collectRules = (
  node: ParsedNode,
  levels: string[] = []
): Array<{ levels: string[]; properties: ParsedNode['properties'] }> => {
  if (node.type === 'rule') {
    return [{ levels, properties: node.properties }];
  }

  const nextLevels =
    node.type === 'rule_group' && node.properties?.field
      ? [...levels, node.properties.field]
      : levels;

  return Object.values(node.children1 ?? {}).flatMap((child) =>
    collectRules(child, nextLevels)
  );
};

const reparse = (saved: string) =>
  collectRules(
    getJsonTreeFromQueryFilter(
      JSON.parse(saved),
      config.fields
    ) as unknown as ParsedNode
  );

describe('custom property ES round trip', () => {
  it.each([
    ['string equal', 'extension.strCP.keyword', 'equal', ['anuj']],
    ['string not_equal', 'extension.strCP.keyword', 'not_equal', ['anuj']],
    ['string like', 'extension.strCP.keyword', 'like', ['anu']],
    ['string not_like', 'extension.strCP.keyword', 'not_like', ['anu']],
    ['string is_null', 'extension.strCP.keyword', 'is_null', []],
    ['string is_not_null', 'extension.strCP.keyword', 'is_not_null', []],
    ['number equal', 'extension.numCP', 'equal', [42]],
    ['number between', 'extension.numCP', 'between', [1, 9]],
    ['table-cp equal', 'extension.tableCP.rows.name', 'equal', ['anuj']],
    ['table-cp like', 'extension.tableCP.rows.name', 'like', ['anu']],
    [
      'entityRef equal',
      'extension.refCP.displayName.keyword',
      'select_equals',
      ['Aaron'],
    ],
    [
      'entityRef not equal',
      'extension.refCP.displayName.keyword',
      'select_not_equals',
      ['Aaron'],
    ],
  ])('%s', (_name, field, operator, value) => {
    const { value: saved } = formatQuery(
      ruleTree(field, operator, value),
      config,
      SearchOutputType.ElasticSearch
    );

    expect(saved).not.toBe('');

    const rules = reparse(saved);

    expect(rules).toHaveLength(1);
    expect(rules[0]?.properties?.field).toBe(field);
    expect(rules[0]?.properties?.operator).toBe(operator);
    expect(rules[0]?.properties?.value).toEqual(value);
    // The canvas needs the wrapper to draw the "Custom Properties" control.
    expect(rules[0]?.levels).toEqual(['extension']);
  });

  it('keeps a plain rule and a custom-property rule side by side', () => {
    const tree = QbUtils.checkTree(
      QbUtils.loadTree({
        id: 'aaaaaaaa-1111-4111-8111-111111111111',
        type: 'group',
        properties: { conjunction: 'AND', not: false },
        children1: {
          'bbbbbbbb-2222-4222-8222-222222222222': {
            type: 'rule',
            properties: {
              field: 'ownerDisplayName',
              operator: 'select_equals',
              value: ['Aaron Johnson'],
              valueSrc: ['value'],
            },
          },
          'cccccccc-3333-4333-8333-333333333333': {
            type: 'rule',
            properties: {
              field: 'extension.strCP.keyword',
              operator: 'equal',
              value: ['anuj'],
              valueSrc: ['value'],
            },
          },
        },
      } as never),
      config
    );

    const { value: saved } = formatQuery(
      tree,
      config,
      SearchOutputType.ElasticSearch
    );
    const rules = reparse(saved);

    expect(rules.map((r) => r.properties?.field)).toEqual([
      'ownerDisplayName',
      'extension.strCP.keyword',
    ]);
    expect(rules.map((r) => r.levels)).toEqual([[], ['extension']]);
  });

  it('reads a clause the group formatter wrapped further', () => {
    const saved =
      '{"query":{"bool":{"must":[{"bool":{"must":[{"bool":{"should":' +
      '[{"bool":{"must":[{"nested":{"path":"customPropertiesTyped",' +
      '"ignore_unmapped":true,"query":{"bool":{"must":[{"term":' +
      '{"customPropertiesTyped.name":"strCP"}},{"wildcard":' +
      '{"customPropertiesTyped.stringValue":{"value":"*test*"}}}]}}}},' +
      '{"term":{"entityType":"table"}}]}}]}}]}}]}}}';

    const rules = reparse(saved);

    expect(rules).toHaveLength(1);
    expect(rules[0]?.properties?.field).toBe('extension.strCP.keyword');
    expect(rules[0]?.properties?.operator).toBe('like');
    expect(rules[0]?.properties?.value).toEqual(['test']);
    expect(rules[0]?.levels).toEqual(['extension']);
  });

  it('keeps a genuine entityType rule', () => {
    const saved = JSON.stringify({
      query: { bool: { must: [{ term: { entityType: 'table' } }] } },
    });

    expect(reparse(saved).map((r) => r.properties?.field)).toEqual([
      'entityType',
    ]);
  });
});
