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

import { QbUtils } from '@react-awesome-query-builder/antd';
import { SearchIndex } from '../enums/search.enum';
import { SearchOutputType } from '../generated/type/searchOutputType';
import { elasticSearchFormat } from './QueryBuilderElasticsearchFormatUtils';
import { getTreeConfig } from './AdvancedSearchUtils';

describe('QueryBuilderElasticsearchFormatUtils', () => {
  it('builds a bounded range query for number custom properties with between operator', () => {
    const config = getTreeConfig({
      searchOutputType: SearchOutputType.ElasticSearch,
      searchIndex: SearchIndex.TABLE,
      isExplorePage: true,
    });

    const jsonTree = {
      id: 'root',
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        rules: {
          type: 'rule',
          id: 'rules',
          properties: {
            field: 'extension.table.myNumberProperty',
            operator: 'between',
            value: [[1, 5]],
            valueSrc: ['value'],
          },
        },
      },
    };

    const tree = QbUtils.checkTree(QbUtils.loadTree(jsonTree), config);
    const query = elasticSearchFormat(tree, config);

    // Should apply both gte and lte bounds (and not degrade to "exists"/unbounded query)
    expect(query).toEqual(
      expect.objectContaining({
        bool: expect.objectContaining({
          must: expect.arrayContaining([
            expect.objectContaining({
              bool: expect.objectContaining({
                should: expect.arrayContaining([
                  expect.objectContaining({
                    nested: expect.objectContaining({
                      path: 'customPropertiesTyped',
                      query: expect.objectContaining({
                        bool: expect.objectContaining({
                          must: expect.arrayContaining([
                            {
                              term: {
                                'customPropertiesTyped.name': 'myNumberProperty',
                              },
                            },
                            expect.objectContaining({
                              range: expect.objectContaining({
                                'customPropertiesTyped.longValue': {
                                  gte: 1,
                                  lte: 5,
                                },
                              }),
                            }),
                          ]),
                        }),
                      }),
                    }),
                  }),
                ]),
              }),
            }),
            {
              term: {
                entityType: 'table',
              },
            },
          ]),
        }),
      })
    );
  });
});

