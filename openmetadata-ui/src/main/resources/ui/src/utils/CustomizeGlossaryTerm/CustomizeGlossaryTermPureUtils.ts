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

export const getGlossaryChildTermsForCustomization = () => [
  {
    id: 'ea7c8380-34a9-4ea9-93ea-a812c0e838d6',
    name: 'Finance',
    displayName: 'Finance',
    description:
      'A finance department is the unit of a business responsible for obtaining and handling any monies on behalf of the organization',
    fullyQualifiedName: 'Business Department.Finance',
    glossary: {
      id: 'dae534b6-f5d1-4fc7-9ddf-0d1ec9df5c7e',
      type: 'glossary',
      name: 'Business Department',
      fullyQualifiedName: 'Business Department',
      description:
        'Businesses often have several departments that perform unique functions, allowing them to operate efficiently and successfully.',
      displayName: 'Business Department',
      deleted: false,
    },
    references: [],
    version: 0.9,
    updatedAt: 1727894458563,
    owners: [],
    status: 'Approved',
    deleted: false,
    mutuallyExclusive: false,
    childrenCount: 1,
  },
  {
    id: 'a8409ff4-b540-4ab0-9332-73f34125651c',
    name: 'FOO',
    displayName: '',
    description: 'VCASCAS',
    fullyQualifiedName: 'Business Department.FOO',
    synonyms: [],
    glossary: {
      id: 'dae534b6-f5d1-4fc7-9ddf-0d1ec9df5c7e',
      type: 'glossary',
      name: 'Business Department',
      fullyQualifiedName: 'Business Department',
      description:
        'Businesses often have several departments that perform unique functions, allowing them to operate efficiently and successfully.',
      displayName: 'Business Department',
      deleted: false,
    },
    references: [],
    version: 0.1,
    updatedAt: 1724662513442,
    updatedBy: 'teddy',
    owners: [],
    status: 'Approved',
    deleted: false,
    mutuallyExclusive: false,
    childrenCount: 0,
  },
  {
    id: '5c415db9-0927-4815-b31b-ae8247ea6b0a',
    name: 'Human resources',
    displayName: 'Human resources',
    description:
      'Human resources (HR) is the department in a company that handles all things related to employees.',
    fullyQualifiedName: 'Business Department.Human resources',
    synonyms: ['Manpower', 'Human capital'],
    glossary: {
      id: 'dae534b6-f5d1-4fc7-9ddf-0d1ec9df5c7e',
      type: 'glossary',
      name: 'Business Department',
      fullyQualifiedName: 'Business Department',
      description:
        'Businesses often have several departments that perform unique functions, allowing them to operate efficiently and successfully.',
      displayName: 'Business Department',
      deleted: false,
    },
    references: [],
    version: 0.2,
    updatedAt: 1701067069097,
    owners: [],
    status: 'Approved',
    deleted: false,
    mutuallyExclusive: false,
    childrenCount: 0,
  },
  {
    id: 'e866ee75-711a-4649-968d-3ea889bd75b8',
    name: 'Marketing',
    displayName: 'Marketing',
    description:
      'A marketing department is a division within a business that helps to promote its brand, products and services.',
    style: {},
    fullyQualifiedName: 'Business Department.Marketing',
    synonyms: ['Sell', 'Retails'],
    glossary: {
      id: 'dae534b6-f5d1-4fc7-9ddf-0d1ec9df5c7e',
      type: 'glossary',
      name: 'Business Department',
      fullyQualifiedName: 'Business Department',
      description:
        'Businesses often have several departments that perform unique functions, allowing them to operate efficiently and successfully.',
      displayName: 'Business Department',
      deleted: false,
    },
    references: [],
    version: 0.2,
    updatedAt: 1700558309238,
    owners: [],
    status: 'Rejected',
    deleted: false,
    mutuallyExclusive: false,
    childrenCount: 1,
  },
  {
    id: '288cfb46-a4c2-45a4-9dc0-321eac165812',
    name: 'test_business_term',
    displayName: 'Test Business Term',
    description: 'this is test_business_term',
    fullyQualifiedName: 'Business Department.test_business_term',
    version: 0.2,
    updatedAt: 1728547870161,
    owners: [],
    deleted: false,
    mutuallyExclusive: false,
  },
];
