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

import { EntityType } from '../enums/entity.enum';
import {
  Constraint,
  Container,
  DataType,
  FileFormat,
  StorageServiceType,
} from '../generated/entity/data/container';

export const CONTAINER_DUMMY_DATA: Container = {
  id: 'af3abc04-30fe-44b2-b3f5-4712e3273c75',
  name: 'finance',
  fullyQualifiedName: 's3_storage_sample.departments.finance',
  displayName: 'Finance department',
  description: 'Bucket containing finance department information',
  version: 0.1,
  owners: [],
  service: {
    id: 'fd6feb87-1cf0-40be-8fa2-99387a2fc929',
    type: 'storageService',
    name: 's3_storage_sample',
    fullyQualifiedName: 's3_storage_sample',
    displayName: 's3_storage_sample',
    deleted: false,
  },
  parent: {
    id: '99d932f3-315f-464c-aae1-d128c81c8146',
    type: 'container',
    name: 'departments',
    fullyQualifiedName: 's3_storage_sample.departments',
    description: 'Bucket containing company department information',
    displayName: 'Company departments',
    deleted: false,
  },
  dataModel: {
    isPartitioned: false,
    columns: [
      {
        name: 'department_id',
        dataType: DataType.Numeric,
        dataTypeDisplay: 'numeric',
        description:
          'The ID of the department. This column is the primary key for this table.',
        fullyQualifiedName:
          's3_storage_sample.departments.finance.department_id',
        tags: [],
        constraint: Constraint.PrimaryKey,
        ordinalPosition: 1,
      },
      {
        name: 'budget_total_value',
        dataType: DataType.Numeric,
        dataTypeDisplay: 'numeric',
        description: "The department's budget for the current year.",
        fullyQualifiedName:
          's3_storage_sample.departments.finance.budget_total_value',
        tags: [],
        ordinalPosition: 2,
      },
      {
        name: 'notes',
        dataType: DataType.Varchar,
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'Notes concerning sustainability for the budget.',
        fullyQualifiedName: 's3_storage_sample.departments.finance.notes',
        tags: [],
        ordinalPosition: 3,
      },
      {
        name: 'budget_executor',
        dataType: DataType.Varchar,
        dataTypeDisplay: 'varchar',
        description: 'The responsible finance lead for the budget execution',
        fullyQualifiedName:
          's3_storage_sample.departments.finance.budget_executor',
        tags: [],
        ordinalPosition: 4,
      },
    ],
  },
  prefix: '/departments/finance/',
  numberOfObjects: 75,
  size: 286720,
  fileFormats: [FileFormat.Zip, FileFormat.CSV],
  serviceType: StorageServiceType.S3,
  followers: [],
  tags: [],
  deleted: false,
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
  children: [
    {
      id: '67836bbf-67e1-4e6b-8fa4-7e2f39df9a2e',
      name: 'expenditures',
      fullyQualifiedName: 's3_storage_sample.departments.finance.expenditures',
      displayName: 'Expenditures for the current year',
      description: 'Bucket containing finance expenditures information',
      type: EntityType.CONTAINER,
      deleted: false,
    },
  ],
};
