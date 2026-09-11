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

const advancedSearchClassBase = jest.requireActual(
  './AdvancedSearchClassBase'
).default;

const PROPERTIES = [
  { name: 'strCP', type: 'string' },
  { name: 'intCP', type: 'integer' },
  { name: 'dateCP', type: 'date-cp' },
  { name: 'mdCP', type: 'markdown' },
  {
    name: 'enumCP',
    type: 'enum',
    customPropertyConfig: { config: { values: ['a', 'b'] } },
  },
  { name: 'refCP', type: 'entityReference' },
  { name: 'refsCP', type: 'array<entityReference>' },
  { name: 'linkCP', type: 'hyperlink-cp' },
  { name: 'intervalCP', type: 'timeInterval' },
  {
    name: 'tableCP',
    type: 'table-cp',
    customPropertyConfig: { config: { columns: ['name'] } },
  },
];

const base = buildQueryBuilderConfig({
  outputType: SearchOutputType.ElasticSearch,
  searchIndex: SearchIndex.TABLE,
  entityType: EntityType.TABLE,
  groupMode: QUERY_BUILDER_GROUP_MODE.FLAT,
});

const subfields: Record<string, Record<string, unknown>> = {};
PROPERTIES.forEach((p) => {
  const r = advancedSearchClassBase.getCustomPropertiesSubFields(
    p,
    SearchOutputType.ElasticSearch
  );
  (Array.isArray(r) ? r : [r]).forEach(
    (e: { subfieldsKey: string; dataObject: Record<string, unknown> }) => {
      subfields[e.subfieldsKey] = e.dataObject;
    }
  );
});

const config = {
  ...base,
  fields: {
    ...base.fields,
    extension: { ...(base.fields.extension as object), subfields },
  },
} as unknown as typeof base;

const sampleValue = (type: string, operator: string): unknown[] => {
  if (['is_null', 'is_not_null'].includes(operator)) {
    return [];
  }
  if (['between', 'not_between'].includes(operator)) {
    return type === 'date' ? ['2024-01-01', '2024-02-01'] : [1, 9];
  }
  if (type === 'number') {
    return [42];
  }
  if (type === 'date') {
    return ['2024-01-01'];
  }
  if (type === 'multiselect') {
    return [['a']];
  }

  return ['abc'];
};

const buildTree = (field: string, operator: string, value: unknown[]) =>
  QbUtils.checkTree(
    QbUtils.loadTree({
      id: 'aaaaaaaa-1111-4111-8111-111111111111',
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        r: {
          type: 'rule',
          id: 'r',
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

const leafOf = (
  node: Record<string, unknown>
): Record<string, unknown> | undefined => {
  if (node.type === 'rule') {
    return node.properties as Record<string, unknown>;
  }
  const kids = Object.values(
    (node.children1 ?? {}) as Record<string, Record<string, unknown>>
  );

  for (const k of kids) {
    const found = leafOf(k);
    if (found) {
      return found;
    }
  }

  return undefined;
};

// `is_null` records no value field, so a property declaring two keys — a time
// interval's start and end — cannot be told apart on the way back. Both ask the
// same question of the same stored entry, so the reader normalises to the key
// the config declares first.
const NORMALISED_TO_FIRST_BOUND = ['is_null', 'is_not_null'];

/**
 * Every custom-property type against every operator it offers, written out and
 * read back. The writer picks a different query shape for almost every pair, so
 * covering them one at a time only ever proved the pair that was tried.
 */
describe('custom property round trip matrix', () => {
  const cases = Object.entries(subfields).flatMap(([key, def]) =>
    ((def.operators as string[]) ?? []).map((operator) => ({
      def,
      key,
      operator,
      type: String(def.type),
    }))
  );

  it('should cover every type and operator', () => {
    expect(cases.length).toBeGreaterThan(40);
  });

  it.each(cases.map((c) => [`${c.key} [${c.type}] ${c.operator}`, c]))(
    '%s',
    (_name, { key, operator, type }) => {
      const field = `extension.${key}`;
      const tree = buildTree(field, operator, sampleValue(type, operator));
      const built = leafOf(
        QbUtils.getTree(tree) as unknown as Record<string, unknown>
      );

      // The config has to accept the rule before the round trip means anything.
      expect(built?.operator).toBe(operator);

      const saved = formatQuery(
        tree,
        config,
        SearchOutputType.ElasticSearch
      ).value;

      expect(saved).not.toBe('');

      const back = leafOf(
        getJsonTreeFromQueryFilter(
          JSON.parse(saved),
          config.fields
        ) as unknown as Record<string, unknown>
      );

      expect(back?.operator).toBe(operator);
      expect(back?.value).toEqual(built?.value);
      expect(back?.field).toBe(
        NORMALISED_TO_FIRST_BOUND.includes(operator) &&
          key.startsWith('intervalCP')
          ? 'extension.intervalCP.start'
          : field
      );
    }
  );
});
