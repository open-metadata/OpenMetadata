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
import { buildQueryBuilderConfig } from './queryBuilder/config';
import { formatQuery } from './queryBuilder/formatters';
import { QUERY_BUILDER_GROUP_MODE } from './queryBuilder/types';

jest.mock('./AdvancedSearchClassBase', () =>
  jest.requireActual('./AdvancedSearchClassBase')
);

const advancedSearchClassBase = jest.requireActual(
  './AdvancedSearchClassBase'
).default;

// Every custom property type the advanced search config knows, table-cp aside
// (a `some` group, covered in AdvancedSearchClassBase.tableCustomProperty.test).
const PROPERTIES = [
  { name: 'strCP', type: 'string' },
  { name: 'mdCP', type: 'markdown' },
  { name: 'sqlQueryCP', type: 'sqlQuery' },
  { name: 'emailCP', type: 'email' },
  { name: 'durationCP', type: 'duration' },
  { name: 'timeCP', type: 'time-cp' },
  { name: 'dateCP', type: 'date-cp' },
  { name: 'dateTimeCP', type: 'dateTime-cp' },
  { name: 'integerCP', type: 'integer' },
  { name: 'numberCP', type: 'number' },
  { name: 'timestampCP', type: 'timestamp' },
  {
    name: 'enumCP',
    type: 'enum',
    customPropertyConfig: { config: { values: ['a', 'b'] } },
  },
  { name: 'refCP', type: 'entityReference' },
  { name: 'refsCP', type: 'array<entityReference>' },
  { name: 'hyperlinkCP', type: 'hyperlink-cp' },
  { name: 'intervalCP', type: 'timeInterval' },
];

type Entry = {
  subfieldsKey: string;
  dataObject: { operators?: string[]; type: string };
};

const sampleValue = (type: string) => {
  switch (type) {
    case 'number':
      return [12];
    case 'date':
      return ['2024-01-01'];
    case 'multiselect':
      return [['a']];
    default:
      return ['abc'];
  }
};

const entriesFor = (property: (typeof PROPERTIES)[number]) => {
  const result = advancedSearchClassBase.getCustomPropertiesSubFields(
    property,
    SearchOutputType.JSONLogic
  );

  return (Array.isArray(result) ? result : [result]) as Entry[];
};

const formatEntry = (entries: Entry[], entry: Entry) => {
  const base = buildQueryBuilderConfig({
    outputType: SearchOutputType.JSONLogic,
    searchIndex: SearchIndex.TABLE,
    entityType: EntityType.TABLE,
    groupMode: QUERY_BUILDER_GROUP_MODE.FLAT,
  });
  const config = {
    ...base,
    fields: {
      ...base.fields,
      extension: {
        ...(base.fields.extension as object),
        subfields: Object.fromEntries(
          entries.map((e) => [e.subfieldsKey, e.dataObject])
        ),
      },
    },
  } as unknown as typeof base;
  const { operators, type } = entry.dataObject;
  const tree = QbUtils.checkTree(
    QbUtils.loadTree({
      id: 'aaaaaaaa-1111-4111-8111-111111111111',
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        r: {
          type: 'rule',
          id: 'r',
          properties: {
            field: `extension.${entry.subfieldsKey}`,
            operator: operators?.[0] ?? 'select_equals',
            value: sampleValue(type),
            valueSrc: ['value'],
          },
        },
      },
    } as never),
    config
  );

  return formatQuery(tree, config, SearchOutputType.JSONLogic).value;
};

describe('custom property rules in JSONLogic output', () => {
  // Elasticsearch needs `.keyword` on text fields; a workflow evaluates the
  // raw entity JSON, where that path resolves to nothing.
  it.each(PROPERTIES.map((p) => [p.type, p] as const))(
    '%s should reference extension.<field> without `.keyword`',
    (_type, property) => {
      const entries = entriesFor(property);

      expect(entries.length).toBeGreaterThan(0);

      entries.forEach((entry) => {
        const logic = formatEntry(entries, entry);

        expect(logic).toContain(`"var":"extension.${entry.subfieldsKey}"`);
        expect(logic).not.toContain('keyword');
      });
    }
  );
});
