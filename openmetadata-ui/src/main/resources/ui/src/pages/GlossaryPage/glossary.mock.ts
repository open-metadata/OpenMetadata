/*
 *  Copyright 2021 Collate
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

export const MOCK_GLOSSARY = {
  id: '35f8ca1c-65a7-403f-af1f-d86683f5e16d',
  name: 'Business glossary',
  fullyQualifiedName: 'Business glossary',
  displayName: 'Business glossary',
  description: 'Lorem Ipsum is simply ',
  version: 1.7,
  updatedAt: 1654247462471,
  updatedBy: 'anonymous',
  href: 'http://localhost:8585/api/v1/glossaries/35f8ca1c-65a7-403f-af1f-d86683f5e16d',
  reviewers: [
    {
      id: '790d6873-dbe1-4297-8e0a-59d4f88eaf9d',
      type: 'user',
      name: 'aaron_singh2',
      fullyQualifiedName: 'aaron_singh2',
      displayName: 'Aaron Singh',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/790d6873-dbe1-4297-8e0a-59d4f88eaf9d',
    },
    {
      id: '6f5ffe31-437f-496f-92fe-15886fe67f43',
      type: 'user',
      name: 'aaron_warren5',
      fullyQualifiedName: 'aaron_warren5',
      displayName: 'Aaron Warren',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/6f5ffe31-437f-496f-92fe-15886fe67f43',
    },
    {
      id: '7abd5d27-b8cf-4dc7-a98b-faa91e4d1ceb',
      type: 'user',
      name: 'adam_rodriguez9',
      fullyQualifiedName: 'adam_rodriguez9',
      displayName: 'Adam Rodriguez',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/7abd5d27-b8cf-4dc7-a98b-faa91e4d1ceb',
    },
  ],
  owner: {
    id: 'cffe41bc-2306-4fff-8b92-9ecf3e414127',
    type: 'user',
    name: 'aaron_johnson0',
    fullyQualifiedName: 'aaron_johnson0',
    displayName: 'Aaron Johnson',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/cffe41bc-2306-4fff-8b92-9ecf3e414127',
  },
  tags: [
    {
      tagFQN: 'PersonalData.SpecialCategory',
      description: 'GDPR special category ',
      source: 'Tag',
      labelType: 'Manual',
      state: 'Confirmed',
    },
    {
      tagFQN: 'PII.Sensitive',
      description:
        'PII which if lost, compromised, or disclosed without authorization, could result in substantial harm, embarrassment, inconvenience, or unfairness to an individual.',
      source: 'Tag',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 1.6,
  },
  deleted: false,
};
