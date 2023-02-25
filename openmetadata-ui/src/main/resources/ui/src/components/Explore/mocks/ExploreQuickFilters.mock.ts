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

export const mockAdvancedFieldOptions = {
  data: {
    suggest: {
      'metadata-suggest': [
        {
          text: 'e',
          offset: 0,
          length: 1,
          options: [
            {
              text: 'ecommerce_db',
              _source: {
                id: '0e8ec01e-a57f-4173-8d30-deda453174d0',
                name: 'dim.api/client',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify."dim.api/client"',
                version: 5.7,
                updatedAt: 1670495113513,
                updatedBy: 'admin',
                href: 'http://localhost:8585/api/v1/tables/0e8ec01e-a57f-4173-8d30-deda453174d0',
                tableType: 'Regular',
              },
            },
            {
              text: 'ecommerce_db1',
              _source: {
                id: '0e8ec01e-a57f-4173-8d30-deda453174d0',
                name: 'dim.api/client1',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify."dim.api/client"',
                version: 5.7,
                updatedAt: 1670495113513,
                updatedBy: 'admin',
                href: 'http://localhost:8585/api/v1/tables/0e8ec01e-a57f-4173-8d30-deda453174d0',
                tableType: 'Regular',
              },
            },
          ],
        },
      ],
    },
  },
};

export const mockAdvancedFieldDuplicateOptions = {
  data: {
    suggest: {
      'metadata-suggest': [
        {
          text: 'e',
          offset: 0,
          length: 1,
          options: [
            {
              text: 'ecommerce_db',
              _source: {
                id: '0e8ec01e-a57f-4173-8d30-deda453174d0',
                name: 'dim.api/client',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify."dim.api/client"',
                version: 5.7,
                updatedAt: 1670495113513,
                updatedBy: 'admin',
                href: 'http://localhost:8585/api/v1/tables/0e8ec01e-a57f-4173-8d30-deda453174d0',
                tableType: 'Regular',
              },
            },
            {
              text: 'ecommerce_db',
              _source: {
                id: '0e8ec01e-a57f-4173-8d30-deda453174d0',
                name: 'dim.api/client',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify."dim.api/client"',
                version: 5.7,
                updatedAt: 1670495113513,
                updatedBy: 'admin',
                href: 'http://localhost:8585/api/v1/tables/0e8ec01e-a57f-4173-8d30-deda453174d0',
                tableType: 'Regular',
              },
            },
            {
              text: 'ecommerce_db1',
              _source: {
                id: '0e8ec01e-a57f-4173-8d30-deda453174d0',
                name: 'dim.api/client1',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify."dim.api/client"',
                version: 5.7,
                updatedAt: 1670495113513,
                updatedBy: 'admin',
                href: 'http://localhost:8585/api/v1/tables/0e8ec01e-a57f-4173-8d30-deda453174d0',
                tableType: 'Regular',
              },
            },
          ],
        },
      ],
    },
  },
};

export const mockTagSuggestions = {
  data: {
    suggest: {
      'metadata-suggest': [
        {
          text: 'pi',
          offset: 0,
          length: 2,
          options: [
            {
              text: 'PII.NonSensitive',
              _source: {
                id: '5555ba21-644f-45f7-bb00-4257a120e94f',
                name: 'NonSensitive',
                fullyQualifiedName: 'PII.NonSensitive',
              },
            },
            {
              text: 'PII.None',
              _source: {
                id: 'c3abf789-518d-47f2-9c15-569c9bb1da90',
                name: 'None',
                fullyQualifiedName: 'PII.None',
              },
            },
            {
              text: 'PII.Sensitive',
              _source: {
                id: 'f011a65f-939a-4ee5-b849-7e1f3e22acad',
                name: 'Sensitive',
                fullyQualifiedName: 'PII.Sensitive',
              },
            },
          ],
        },
      ],
    },
  },
};

export const mockUserSuggestions = {
  data: {
    suggest: {
      'metadata-suggest': [
        {
          text: 'aa',
          offset: 0,
          length: 2,
          options: [
            {
              text: 'Aaron Johnson',
              _source: {
                id: '0b4bfce9-0fcb-4578-b563-f566f8c45e10',
                name: 'aaron_johnson0',
                fullyQualifiedName: 'aaron_johnson0',
              },
            },
            {
              text: 'Aaron Singh',
              _source: {
                id: '4e7b5402-d88a-4eb3-a4a6-788e5dc6f59b',
                name: 'aaron_singh2',
                fullyQualifiedName: 'aaron_singh2',
              },
            },
            {
              text: 'Aaron Warren',
              _source: {
                id: 'a2802c79-9007-4e75-a04c-0978a406fcd7',
                name: 'aaron_warren5',
                fullyQualifiedName: 'aaron_warren5',
              },
            },
          ],
        },
      ],
    },
  },
};
