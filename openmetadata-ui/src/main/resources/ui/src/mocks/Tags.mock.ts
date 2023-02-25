/*
 *  Copyright 2023 Collate.
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

export const mockTagList = [
  {
    id: 'e649c601-44d3-449d-bc04-fbbaf83baf19',
    name: 'PersonalData',
    fullyQualifiedName: 'PersonalData',
    description: 'description',
    version: 0.1,
    updatedAt: 1672922279939,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/classifications/e649c601-44d3-449d-bc04-fbbaf83baf19',
    deleted: false,
    provider: 'system',
    mutuallyExclusive: true,
  },
];

export const mockTagsApiResponse = {
  data: [
    {
      id: '0897311f-1321-4e1c-a857-aab7dedc632d',
      name: 'Personal',
      fullyQualifiedName: 'PersonalData.Personal',
      description:
        'Data that can be used to directly or indirectly identify a person.',
      classification: {
        id: '5ce3825b-3227-4326-8beb-37ed2784149e',
        type: 'classification',
        name: 'PersonalData',
        fullyQualifiedName: 'PersonalData',
        description:
          'Tags related classifying **Personal data** as defined by **GDPR.**<br/><br/>',
        deleted: false,
        href: 'http://localhost:8585/api/v1/classifications/5ce3825b-3227-4326-8beb-37ed2784149e',
      },
      version: 0.1,
      updatedAt: 1675078969456,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/tags/0897311f-1321-4e1c-a857-aab7dedc632d',
      deprecated: false,
      deleted: false,
      provider: 'system',
      mutuallyExclusive: false,
    },
    {
      id: '68a9fa7f-9342-404a-b31a-112dea0e0f81',
      name: 'SpecialCategory',
      fullyQualifiedName: 'PersonalData.SpecialCategory',
      description:
        'GDPR special category data is personal information of data subjects that is especially sensitive',
      classification: {
        id: '5ce3825b-3227-4326-8beb-37ed2784149e',
        type: 'classification',
        name: 'PersonalData',
        fullyQualifiedName: 'PersonalData',
        description:
          'Tags related classifying **Personal data** as defined by **GDPR.**<br/><br/>',
        deleted: false,
        href: 'http://localhost:8585/api/v1/classifications/5ce3825b-3227-4326-8beb-37ed2784149e',
      },
      version: 0.1,
      updatedAt: 1675078969475,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/tags/68a9fa7f-9342-404a-b31a-112dea0e0f81',
      deprecated: false,
      deleted: false,
      provider: 'system',
      mutuallyExclusive: false,
    },
  ],
  paging: { total: 2 },
};
