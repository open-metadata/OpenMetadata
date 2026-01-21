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

import {
  Domain,
  DomainType,
} from '../../../../generated/entity/domains/domain';
import {
  LabelType,
  State,
  TagSource,
} from '../../../../generated/tests/testCase';

export const mockDomainEntityDetails: Domain = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Marketing',
  fullyQualifiedName: 'Marketing',
  displayName: 'Marketing Domain',
  description: 'Marketing domain for all marketing-related data assets',
  domainType: DomainType.Aggregate,
  version: 0.1,
  updatedAt: 1672668265493,
  updatedBy: 'admin',
  href: 'http://openmetadata-server:8585/api/v1/domains/123e4567-e89b-12d3-a456-426614174000',
  owners: [
    {
      id: 'owner-id-1',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
    },
  ],
  tags: [
    {
      tagFQN: 'PII.Sensitive',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  experts: [
    {
      id: 'expert-id-1',
      type: 'user',
      name: 'expert1',
      fullyQualifiedName: 'expert1',
      deleted: false,
    },
  ],
};
