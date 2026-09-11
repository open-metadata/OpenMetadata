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
import { loadQueryBuilderTree } from './queryBuilder/tree';
import { QUERY_BUILDER_GROUP_MODE } from './queryBuilder/types';

jest.mock('./AdvancedSearchClassBase', () =>
  jest.requireActual('./AdvancedSearchClassBase')
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const advancedSearchClassBase = jest.requireActual(
  './AdvancedSearchClassBase'
).default;

const TABLE_PROPERTY = {
  name: 'testCPTable',
  type: 'table-cp',
  customPropertyConfig: { config: { columns: ['id', 'name'] } },
};

const subfieldsFor = (searchOutputType: SearchOutputType) => {
  const result = advancedSearchClassBase.getCustomPropertiesSubFields(
    TABLE_PROPERTY,
    searchOutputType
  );

  return (Array.isArray(result) ? result : [result]) as Array<{
    subfieldsKey: string;
    dataObject: Record<string, unknown>;
  }>;
};

describe('a table custom property', () => {
  // A dotted field resolves to nothing on an array, so such a rule was false
  // for every row.
  it('should become one `some` group over its rows for JSONLogic', () => {
    const [entry, ...rest] = subfieldsFor(SearchOutputType.JSONLogic);

    expect(rest).toHaveLength(0);
    expect(entry.subfieldsKey).toBe('testCPTable.rows');
    expect(entry.dataObject.type).toBe('!group');
    expect(entry.dataObject.mode).toBe('some');
    expect(Object.keys(entry.dataObject.subfields as object)).toEqual([
      'id',
      'name',
    ]);
  });

  // Elasticsearch indexes one entry per column, so it needs the flat keys.
  it('should stay one flat field per column for Elasticsearch', () => {
    expect(
      subfieldsFor(SearchOutputType.ElasticSearch).map(
        (entry) => entry.subfieldsKey
      )
    ).toEqual(['testCPTable.rows.id', 'testCPTable.rows.name']);
  });

  const buildConfig = () => {
    const base = buildQueryBuilderConfig({
      outputType: SearchOutputType.JSONLogic,
      searchIndex: SearchIndex.TABLE,
      entityType: EntityType.TABLE,
      groupMode: QUERY_BUILDER_GROUP_MODE.FLAT,
    });
    const [entry] = subfieldsFor(SearchOutputType.JSONLogic);

    return {
      ...base,
      fields: {
        ...base.fields,
        extension: {
          label: 'Custom Properties',
          type: '!struct',
          subfields: { [entry.subfieldsKey]: entry.dataObject },
        },
      },
    } as unknown as typeof base;
  };

  const EXPECTED_RULE =
    '{"and":[{"some":[{"var":"extension.testCPTable.rows"},{"==":[{"var":"name"},"karan"]}]}]}';

  it('should emit the rule the workflow engine can evaluate', () => {
    const config = buildConfig();
    const tree = QbUtils.checkTree(
      QbUtils.loadTree({
        id: 'aaaaaaaa-1111-4111-8111-111111111111',
        type: 'group',
        properties: { conjunction: 'AND', not: false },
        children1: {
          'bbbbbbbb-2222-4222-8222-222222222222': {
            type: 'rule_group',
            id: 'bbbbbbbb-2222-4222-8222-222222222222',
            properties: {
              conjunction: 'AND',
              not: false,
              mode: 'some',
              field: 'extension.testCPTable.rows',
              fieldSrc: 'field',
            },
            children1: {
              'cccccccc-3333-4333-8333-333333333333': {
                type: 'rule',
                properties: {
                  field: 'extension.testCPTable.rows.name',
                  operator: 'equal',
                  value: ['karan'],
                  valueSrc: ['value'],
                  fieldSrc: 'field',
                },
              },
            },
          },
        },
      } as never),
      config
    );

    expect(formatQuery(tree, config, SearchOutputType.JSONLogic).value).toBe(
      EXPECTED_RULE
    );
  });

  // A workflow saved before the fix still holds the flat form; loading has to
  // repair it so re-saving stores something that matches.
  it.each([
    [
      'the flat form it used to store',
      '{"and":[{"==":[{"var":"extension.testCPTable.rows.name"},"karan"]}]}',
    ],
    ['the corrected form', EXPECTED_RULE],
  ])('should round-trip %s', (_name, saved) => {
    const config = buildConfig();

    expect(
      formatQuery(
        loadQueryBuilderTree({
          config,
          groupMode: QUERY_BUILDER_GROUP_MODE.FLAT,
          outputType: SearchOutputType.JSONLogic,
          value: saved,
        }),
        config,
        SearchOutputType.JSONLogic
      ).value
    ).toBe(EXPECTED_RULE);
  });
});
