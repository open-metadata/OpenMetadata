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
import { ContractStatus } from '../generated/entity/data/dataContract';
import {
  Constraint,
  DataType,
  LabelType,
  State,
} from '../generated/entity/data/table';
import { ContractExecutionStatus } from '../generated/type/contractExecutionStatus';
import { TagSource } from '../generated/type/tagLabel';

export const MOCK_DATA_CONTRACT = {
  id: 'bf7b3a0d-6a85-4dd6-95e3-243a1769d1a9',
  name: 'Customer 360',
  fullyQualifiedName:
    'redshift prod.dev.dbt_jaffle.customers.dataContract_Customer 360',
  description: '<strong>Customer 360 Data Contract</strong> ',
  version: 0.2,
  updatedAt: 1755860378527,
  updatedBy: 'joseph',
  status: ContractStatus.Active,
  entity: {
    id: 'ee9d44a0-815d-4ac9-8422-4f9d02ddf04d',
    type: 'table',
    href: 'https://demo.getcollate.io/v1/tables/ee9d44a0-815d-4ac9-8422-4f9d02ddf04d',
  },
  testSuite: {
    id: '24859b7c-a2ef-4e0e-b3b7-67a61ed14bc9',
    type: 'testSuite',
    fullyQualifiedName: 'bf7b3a0d-6a85-4dd6-95e3-243a1769d1a9',
  },
  schema: [
    {
      name: 'customer_id',
      dataType: DataType.Array,
      dataLength: 1,
      dataTypeDisplay: 'integer',
      description: 'Unique identifier for each customer',
      fullyQualifiedName: 'redshift prod.dev.dbt_jaffle.customers.customer_id',
      tags: [
        {
          tagFQN: 'PII.NonSensitive',
          name: 'NonSensitive',
          displayName: 'Non Sensitive ',
          description:
            'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
          style: {},
          source: TagSource.Classification,
          labelType: LabelType.Automated,
          state: State.Suggested,
        },
      ],
      constraint: Constraint.Null,
      children: [],
    },
  ],
  semantics: [
    {
      name: 'Tiering Elements',
      description: '',
      // eslint-disable-next-line max-len
      rule: '{"and":[{"some":[{"var":"owners"},{"==":[{"var":"fullyQualifiedName"},"customer team"]}]},{"some":[{"var":"dataProduct"},{"==":[{"var":"fullyQualifiedName"},"C360"]}]},{"==":[{"var":"tier.tagFQN"},"Tier.Tier1"]}]}',
      enabled: true,
      ignoredEntities: [],
    },
  ],
  qualityExpectations: [
    {
      id: 'f496f0d9-58c3-4a0e-a836-2479b457c68e',
      type: 'testCase',
      name: 'CLV Must be Positive',
      description:
        '<p>The customer lifetime value must always be greater or equal to zero </p>',
    },
    {
      id: 'e57ffd73-b8f1-4f5f-91b1-7ebe614dc26e',
      type: 'testCase',
      name: 'Customer ID To Be Unique',
    },
    {
      id: '484e016e-ed87-4f6c-ae77-7d5b16f07ad0',
      type: 'testCase',
      name: 'Table Row Count To Equal',
    },
  ],
  reviewers: [],
  changeDescription: {
    fieldsAdded: [
      {
        name: 'latestResult',
        newValue: {
          status: ContractExecutionStatus.Failed,
          resultId: '04551202-c2b9-4d7b-aecf-6c9c8fe22c1c',
          timestamp: 1756944000095,
        },
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.1,
    changeSummary: {},
  },
  incrementalChangeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.2,
  },
  deleted: false,
  latestResult: {
    timestamp: 1756944000095,
    status: ContractExecutionStatus.Failed,
    resultId: '04551202-c2b9-4d7b-aecf-6c9c8fe22c1c',
  },
};
