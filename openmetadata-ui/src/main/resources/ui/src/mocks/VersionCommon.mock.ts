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

import { LabelType, State, TagSource } from '../generated/type/tagLabel';

export const mockOwner = {
  id: '38be030f-f817-4712-bc3b-ff7b9b9b805e',
  type: 'user',
  name: 'aaron_johnson0',
  fullyQualifiedName: 'aaron_johnson0',
  displayName: 'Aaron Johnson',
  deleted: false,
};

export const mockDomain = {
  id: '9602ed54-451d-4539-9b08-af611533f38b',
  type: 'domain',
  name: 'new_domain',
  fullyQualifiedName: 'new_domain',
  description: 'Testing new domain',
  displayName: 'New Domain',
  href: 'http://localhost:8585/api/v1/domains/9602ed54-451d-4539-9b08-af611533f38b',
};

export const mockTier = {
  tagFQN: 'Tier.Tier3',
  description: 'description',
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
};

export const mockVersionList = {
  entityType: 'table',
  versions: [''],
};

export const mockBackHandler = jest.fn();
export const mockVersionHandler = jest.fn();
