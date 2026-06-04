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

import { AntdConfig } from '@react-awesome-query-builder/antd';
import { elasticSearchFormat } from './QueryBuilderElasticsearchFormatUtils';

// Minimal Immutable-compatible tree stub.
// elasticSearchFormat only calls .get() on the tree and its properties map.
const makeTree = (operator, value) => ({
  get(key) {
    if (key === 'type') {
      return 'rule';
    }
    if (key === 'properties') {
      return {
        get(k) {
          if (k === 'field') {
            return 'extension.table.myNumber';
          }
          if (k === 'operator') {
            return operator;
          }
          if (k === 'value') {
            return { toJS: () => value };
          }
          if (k === 'valueSrc') {
            return { get: () => 'value' };
          }

          return undefined;
        },
      };
    }

    return undefined;
  },
});

// Extend AntdConfig with extension field metadata so lookupOmPropertyType
// resolves the OM type, which is required for the scoped between/not_between fix.
const configWithNumberType = {
  ...AntdConfig,
  fields: {
    ...AntdConfig.fields,
    extension: {
      subfields: {
        table: {
          subfields: {
            myNumber: {
              __omPropertyType: 'number',
            },
          },
        },
      },
    },
  },
};

describe('elasticSearchFormat – extension number field range operators (Issue #27482)', () => {
  it('between: should include both gte and lte bounds in the nested range query', () => {
    const result = JSON.stringify(
      elasticSearchFormat(makeTree('between', [5, 20]), configWithNumberType)
    );

    expect(result).toContain('"gte":5');
    expect(result).toContain('"lte":20');
  });

  it('not_between: should wrap gte/lte range in a must_not clause', () => {
    const result = JSON.stringify(
      elasticSearchFormat(
        makeTree('not_between', [10, 50]),
        configWithNumberType
      )
    );

    expect(result).toContain('"must_not"');
    expect(result).toContain('"gte":10');
    expect(result).toContain('"lte":50');
  });
});
