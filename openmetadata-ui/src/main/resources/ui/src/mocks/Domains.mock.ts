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
import { DomainType } from '../generated/api/domains/createDomain';
import { Domain } from '../generated/entity/domains/domain';

export const MOCK_DOMAIN = {
  id: '5f4326d3-9dfc-4e43-8f0c-d88d4a293ede',
  domainType: DomainType.Aggregate,
  name: 'Test DM',
  fullyQualifiedName: 'Test DM',
  displayName: 'Test DM1234',
  description: 'Demo description',
  version: 0.1,
  updatedAt: 1693984853388,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/domains/5f4326d3-9dfc-4e43-8f0c-d88d4a293ede',
  owner: {
    id: 'b4b299c1-992a-4a28-a153-7bca6d62de1d',
    type: 'user',
    name: 'aaron.singh2',
    fullyQualifiedName: '"aaron.singh2"',
    displayName: 'Aaron Singh',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/b4b299c1-992a-4a28-a153-7bca6d62de1d',
  },
  experts: [],
};

export const DOMAINS_LIST: Domain[] = [
  {
    id: '353a1cf3-1608-4405-b2e9-58bfe52fa8d2',
    domainType: DomainType.Aggregate,
    name: 'Domain1',
    fullyQualifiedName: 'Domain1',
    displayName: 'Domain1',
    description: 'Domain1',
    version: 0.4,
    updatedAt: 1694584150825,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/domains/353a1cf3-1608-4405-b2e9-58bfe52fa8d2',
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [
        {
          name: 'domainType',
          oldValue: 'Consumer-aligned',
          newValue: 'Source-aligned',
        },
      ],
      fieldsDeleted: [],
      previousVersion: 0.3,
    },
  },
  {
    id: '0e5307a6-d2bd-44ea-a3ae-22daac806575',
    domainType: DomainType.Aggregate,
    name: 'Domain2',
    fullyQualifiedName: 'Domain2',
    displayName: 'Domain2',
    description: 'Domain2',
    version: 0.1,
    updatedAt: 1694609430230,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/domains/0e5307a6-d2bd-44ea-a3ae-22daac806575',
  },
];
