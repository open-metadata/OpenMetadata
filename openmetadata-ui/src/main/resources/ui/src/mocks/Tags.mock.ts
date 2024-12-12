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

export const MOCK_TAG_ENCODED_FQN = '"%22Mock.Tag%22.Tag_1"';

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

export const MOCK_TAG_DATA = {
  id: 'e8bc85c8-a87f-471c-872e-46904c5ea888',
  name: 'search_part_2',
  displayName: '',
  fullyQualifiedName: 'advanceSearch.search_part_2',
  description: 'this is search_part_2',
  style: {},
  classification: {
    id: '16c5865a-8804-4474-a1dd-14ee9da443b2',
    type: 'classification',
    name: 'advanceSearch',
    fullyQualifiedName: 'advanceSearch',
    description: 'advanceSearch',
    displayName: '',
    deleted: false,
    href: 'http://sandbox-beta.open-metadata.org/api/v1/classifications/16c5865a-8804-4474-a1dd-14ee9da443b2',
  },
  version: 0.1,
  updatedAt: 1704261482857,
  updatedBy: 'ashish',
  href: 'http://sandbox-beta.open-metadata.org/api/v1/tags/e8bc85c8-a87f-471c-872e-46904c5ea888',
  deprecated: false,
  deleted: false,
  provider: 'user',
  mutuallyExclusive: false,
};
