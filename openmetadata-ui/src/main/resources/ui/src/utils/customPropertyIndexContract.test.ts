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
import { BasicConfig } from '@react-awesome-query-builder/ui';
import { SearchOutputType } from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { elasticSearchFormat } from './QueryBuilderElasticsearchFormatUtils';

jest.mock('./AdvancedSearchClassBase', () =>
  jest.requireActual('./AdvancedSearchClassBase')
);

const advancedSearchClassBase = jest.requireActual(
  './AdvancedSearchClassBase'
).default;

const INDEX_CONTRACT: Array<{
  type: string;
  fieldKey: string;
  // The `customPropertiesTyped.name` term identifying the indexed entry.
  nestedName: string;
  // The `customPropertiesTyped.*` sub-field the value clause must target.
  queries: string;
}> = [
  {
    type: 'string',
    fieldKey: 'strCP.keyword',
    nestedName: 'strCP',
    queries: 'stringValue',
  },
  {
    type: 'integer',
    fieldKey: 'intCP',
    nestedName: 'intCP',
    queries: 'longValue',
  },
  {
    type: 'number',
    fieldKey: 'numCP',
    nestedName: 'numCP',
    queries: 'longValue',
  },
  {
    type: 'timestamp',
    fieldKey: 'tsCP',
    nestedName: 'tsCP',
    queries: 'longValue',
  },
  {
    type: 'date-cp',
    fieldKey: 'dateCP.keyword',
    nestedName: 'dateCP',
    queries: 'stringValue',
  },
  {
    type: 'dateTime-cp',
    fieldKey: 'dtCP.keyword',
    nestedName: 'dtCP',
    queries: 'stringValue',
  },
  {
    type: 'time-cp',
    fieldKey: 'timeCP.keyword',
    nestedName: 'timeCP',
    queries: 'stringValue',
  },
  {
    type: 'markdown',
    fieldKey: 'mdCP.keyword',
    nestedName: 'mdCP',
    queries: 'stringValue',
  },
  {
    type: 'sqlQuery',
    fieldKey: 'sqlCP.keyword',
    nestedName: 'sqlCP',
    queries: 'stringValue',
  },
  {
    type: 'enum',
    fieldKey: 'enumCP.keyword',
    nestedName: 'enumCP',
    queries: 'stringValue',
  },
  // displayName lands in stringValue, not refName.
  {
    type: 'entityReference',
    fieldKey: 'refCP.displayName.keyword',
    nestedName: 'refCP',
    queries: 'stringValue',
  },
  {
    type: 'array<entityReference>',
    fieldKey: 'refsCP.displayName.keyword',
    nestedName: 'refsCP',
    queries: 'stringValue',
  },
  // Each half of a hyperlink is its own indexed entry, named for the half.
  {
    type: 'hyperlink-cp',
    fieldKey: 'linkCP.url',
    nestedName: 'linkCP.url',
    queries: 'stringValue',
  },
  {
    type: 'hyperlink-cp',
    fieldKey: 'linkCP.displayText',
    nestedName: 'linkCP.displayText',
    queries: 'stringValue',
  },
  {
    type: 'timeInterval',
    fieldKey: 'intervalCP.start',
    nestedName: 'intervalCP',
    queries: 'start',
  },
  {
    type: 'timeInterval',
    fieldKey: 'intervalCP.end',
    nestedName: 'intervalCP',
    queries: 'end',
  },
  // One entry per column, named for the column.
  {
    type: 'table-cp',
    fieldKey: 'tableCP.rows.name',
    nestedName: 'tableCP.rows.name',
    queries: 'stringValue',
  },
];

// Every sub-field `customPropertiesTyped` declares (indexMappingsTemplate.json).
// A typo'd or invented name would otherwise sail through as a silent no-match.
const MAPPED_SUB_FIELDS = [
  'stringValue',
  'textValue',
  'longValue',
  'doubleValue',
  'start',
  'end',
  'refId',
  'refType',
  'refName',
  'refFqn',
];

const PROPERTIES = [
  { name: 'strCP', type: 'string' },
  { name: 'intCP', type: 'integer' },
  { name: 'numCP', type: 'number' },
  { name: 'tsCP', type: 'timestamp' },
  { name: 'dateCP', type: 'date-cp' },
  { name: 'dtCP', type: 'dateTime-cp' },
  { name: 'timeCP', type: 'time-cp' },
  { name: 'mdCP', type: 'markdown' },
  { name: 'sqlCP', type: 'sqlQuery' },
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

// A numeric type routes on its declared type, but only a numeric value proves it.
const NUMERIC_TYPES = ['integer', 'number', 'timestamp'];
const SAMPLE = 'SENTINEL';

const EXACT_MATCH_OPERATORS = [
  'select_equals',
  'multiselect_equals',
  'equal',
] as const;

// Immutable-compatible stub: elasticSearchFormat only calls .get().
const makeRule = (field: string, operator: string, value: unknown) => {
  const properties: Record<string, unknown> = {
    field,
    operator,
    value: { toJS: () => [value] },
    valueSrc: { get: () => 'value' },
    valueType: { get: () => 'text' },
  };
  const node: Record<string, unknown> = {
    type: 'rule',
    properties: { get: (prop: string) => properties[prop] },
  };

  return { get: (key: string) => node[key] };
};

type SubField = {
  subfieldsKey: string;
  dataObject: { operators?: string[] };
};

const buildActualContract = () =>
  PROPERTIES.flatMap((property) => {
    const produced = advancedSearchClassBase.getCustomPropertiesSubFields(
      property,
      SearchOutputType.ElasticSearch
    );

    return (Array.isArray(produced) ? produced : [produced]).map(
      ({ subfieldsKey, dataObject }: SubField) => {
        const operators = dataObject.operators ?? [];
        const operator =
          EXACT_MATCH_OPERATORS.find((candidate) =>
            operators.includes(candidate)
          ) ?? 'equal';
        const value = NUMERIC_TYPES.includes(property.type) ? 42 : SAMPLE;
        const config = {
          ...BasicConfig,
          fields: {
            ...BasicConfig.fields,
            extension: {
              subfields: {
                [subfieldsKey]: { __omPropertyType: property.type },
              },
            },
          },
        };

        const json = JSON.stringify(
          elasticSearchFormat(
            makeRule(`extension.${subfieldsKey}`, operator, value) as never,
            config as never
          )
        );

        return {
          type: property.type,
          fieldKey: subfieldsKey,
          nestedName:
            json.match(/"customPropertiesTyped\.name":"([^"]+)"/)?.[1] ??
            '(none)',
          // An entityReference matches case-insensitively, so its term body is an
          // object rather than the bare value.
          queries:
            json.match(
              new RegExp(
                `"customPropertiesTyped\\.(\\w+)":(?:\\{"value":)?"?(?:${SAMPLE}|42)"?`
              )
            )?.[1] ?? '(none)',
        };
      }
    );
  });

describe('custom property index contract', () => {
  it('should query the sub-field the indexer writes, for every property type', () => {
    expect(buildActualContract()).toEqual(INDEX_CONTRACT);
  });

  it('should only reach for sub-fields customPropertiesTyped actually maps', () => {
    const unmapped = buildActualContract().filter(
      (row) => !MAPPED_SUB_FIELDS.includes(row.queries)
    );

    expect(unmapped).toEqual([]);
  });

  it('should cover every type the indexer branches on', () => {
    const covered = new Set(INDEX_CONTRACT.map((row) => row.type));

    expect([...covered].sort()).toEqual([
      'array<entityReference>',
      'date-cp',
      'dateTime-cp',
      'entityReference',
      'enum',
      'hyperlink-cp',
      'integer',
      'markdown',
      'number',
      'sqlQuery',
      'string',
      'table-cp',
      'time-cp',
      'timeInterval',
      'timestamp',
    ]);
  });
});
