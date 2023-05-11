/*
 *  Copyright 2022 Collate.
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

export const mockAdvancedFieldDefaultOptions = {
  data: {
    took: 3,
    _shards: {
      total: 1,
      successful: 1,
      skipped: 0,
      failed: 0,
    },
    hits: {
      total: {
        value: 84,
        relation: 'eq',
      },
      hits: [],
    },
    aggregations: {
      'sterms#database.name': {
        buckets: [
          {
            key: 'ecommerce_db',
          },
          {
            key: 'ecommerce_db1',
          },
          {
            key: 'modified-leaf-330420',
          },
          {
            key: 'modified-leaf-330421',
          },
        ],
      },
    },
  },
};

export const mockAdvancedFieldDuplicateOptions = {
  data: {
    took: 3,
    _shards: {
      total: 1,
      successful: 1,
      skipped: 0,
      failed: 0,
    },
    hits: {
      total: {
        value: 84,
        relation: 'eq',
      },
      hits: [],
    },
    aggregations: {
      'sterms#database.name': {
        buckets: [
          {
            key: 'ecommerce_db',
          },
          {
            key: 'ecommerce_db',
          },
          {
            key: 'modified-leaf-330420',
          },
          {
            key: 'modified-leaf-330421',
          },
        ],
      },
    },
  },
};
