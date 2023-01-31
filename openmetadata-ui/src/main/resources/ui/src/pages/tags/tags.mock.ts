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
export const MOCK_ALL_CLASSIFICATIONS = {
  data: [
    {
      id: '5e77a82e-4bc8-46eb-af52-a383a505eea6',
      name: 'PersonalData',
      fullyQualifiedName: 'PersonalData',
      description:
        'Tags related classifying **Personal data** as defined by **GDPR.**<br/><br/>',
      version: 0.2,
      updatedAt: 1672147362401,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/classifications/5e77a82e-4bc8-46eb-af52-a383a505eea6',
      termCount: 2,
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [
          {
            name: 'description',
            oldValue: '',
            newValue:
              'Tags related classifying **Personal data** as defined by **GDPR.**<br/><br/>',
          },
          {
            name: 'mutuallyExclusive',
            oldValue: true,
            newValue: false,
          },
        ],
        fieldsDeleted: [],
        previousVersion: 0.1,
      },
      deleted: false,
      provider: 'system',
      mutuallyExclusive: false,
    },
    {
      id: '5d626378-ca93-4ce2-ac20-52908961d26e',
      name: 'PII',
      fullyQualifiedName: 'PII',
      description:
        'Personally Identifiable Information information that, when used alone or with other relevant data, can identify an individual.',
      version: 0.1,
      updatedAt: 1672135714322,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/classifications/5d626378-ca93-4ce2-ac20-52908961d26e',
      deleted: false,
      provider: 'system',
      mutuallyExclusive: true,
      termCount: 3,
    },
    {
      id: '9005388e-5355-412c-8ba9-fc6dbe192a45',
      name: 'test-category',
      fullyQualifiedName: 'test-category',
      description: '',
      version: 0.1,
      updatedAt: 1672147038831,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/classifications/9005388e-5355-412c-8ba9-fc6dbe192a45',
      deleted: false,
      provider: 'user',
      mutuallyExclusive: false,
      termCount: 5,
    },
  ],
  paging: {
    total: 3,
  },
};

export const MOCK_TAGS = {
  data: [
    {
      id: 'ba6fd24a-8193-4ac8-879d-c9eb6be3cd1e',
      name: 'Personal',
      fullyQualifiedName: 'PersonalData.Personal',
      description:
        'Data that can be used to directly or indirectly identify a person.',
      classification: {
        id: '5e77a82e-4bc8-46eb-af52-a383a505eea6',
        type: 'classification',
        name: 'PersonalData',
        fullyQualifiedName: 'PersonalData',
        description:
          'Tags related classifying **Personal data** as defined by **GDPR.**<br/><br/>_Note to Legal',
        deleted: false,
        href: 'http://localhost:8585/api/v1/classifications/5e77a82e-4bc8-46eb-af52-a383a505eea6',
      },
      version: 0.1,
      updatedAt: 1672135714301,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/tags/ba6fd24a-8193-4ac8-879d-c9eb6be3cd1e',
      usageCount: 3,
      deprecated: false,
      deleted: false,
      provider: 'system',
      mutuallyExclusive: false,
    },
    {
      id: 'a7365365-9f36-4771-9e64-afc2463a2b09',
      name: 'SpecialCategory',
      fullyQualifiedName: 'PersonalData.SpecialCategory',
      description:
        'GDPR special category data is personal information of data subjects that is especially sensitive.',
      classification: {
        id: '5e77a82e-4bc8-46eb-af52-a383a505eea6',
        type: 'classification',
        name: 'PersonalData',
        fullyQualifiedName: 'PersonalData',
        description:
          'Tags related classifying **Personal data** as defined by **GDPR.**<br/><br/>_Note to Legal',
        deleted: false,
        href: 'http://localhost:8585/api/v1/classifications/5e77a82e-4bc8-46eb-af52-a383a505eea6',
      },
      version: 0.1,
      updatedAt: 1672135714312,
      updatedBy: 'admin',
      href: 'http://localhost:8585/api/v1/tags/a7365365-9f36-4771-9e64-afc2463a2b09',
      usageCount: 0,
      deprecated: false,
      deleted: false,
      provider: 'system',
      mutuallyExclusive: false,
    },
  ],
  paging: {
    after: 'UGVyc29uYWxEYXRhLnRlc3R0YWc4OQ==',
    total: 4,
  },
};

export const MOCK_TAGS_CATEGORY = [
  {
    id: 'test',
    description: 'description',
    href: 'link',
    name: 'PersonalData',
    usageCount: 3,
  },
  {
    id: 'test2',
    children: [],
    description: 'description',
    href: 'link',
    name: 'PII',
    usageCount: 2,
  },
];

export const MOCK_DELETE_CLASSIFICATION = {
  id: 'b08c092f-a3f1-4ca6-bcc2-b8123b042cb9',
  name: 'testClassify145',
  fullyQualifiedName: 'testClassify145',
  description: '',
  version: 0.2,
  updatedAt: 1672231948467,
  updatedBy: 'admin',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'deleted',
        oldValue: false,
        newValue: true,
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.1,
  },
  deleted: true,
  provider: 'user',
  mutuallyExclusive: false,
};

export const MOCK_DELETE_TAG = {
  id: '5e77a82e-4bc8-46eb-af52-a383a505eea6',
  type: 'classification',
  name: 'PersonalData',
  fullyQualifiedName: 'PersonalData',
  description:
    'Tags related classifying **Personal data** as defined by **GDPR.**<br/><br/>_',
  deleted: false,
  href: 'http://localhost:8585/api/v1/classifications/5e77a82e-4bc8-46eb-af52-a383a505eea6',
};
