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

import { ContainerVersionProp } from '../components/Container/ContainerVersion/ContainerVersion.interface';
import {
  Constraint,
  DataType,
  FileFormat,
  StorageServiceType,
} from '../generated/entity/data/container';
import { ENTITY_PERMISSIONS } from '../mocks/Permissions.mock';
import {
  mockBackHandler,
  mockDomain,
  mockOwner,
  mockTier,
  mockVersionHandler,
  mockVersionList,
} from '../mocks/VersionCommon.mock';

export const mockContainerData = {
  id: 'fa390cbe-63a3-4ebb-976b-4cc9cbe5a234',
  name: 'expenditures',
  fullyQualifiedName: 's3_storage_sample.departments.finance.expenditures',
  displayName: 'Expenditures for the current year',
  description: 'Bucket containing finance expenditures information updated',
  version: 0.2,
  updatedAt: 1689130888441,
  updatedBy: 'admin',
  service: {
    id: '5bd7b845-adcd-4eb0-964f-c1c99c77bbb6',
    type: 'storageService',
    name: 's3_storage_sample',
    fullyQualifiedName: 's3_storage_sample',
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
        fullyQualifiedName: 's3_storage_sample.expenditures.department_id',
        tags: [],
        constraint: Constraint.PrimaryKey,
        ordinalPosition: 1,
      },
    ],
  },
  prefix: '/departments/finance/expenditures-2023',
  numberOfObjects: 10,
  size: 65536,
  fileFormats: [FileFormat.Zstd, FileFormat.Tsv],
  serviceType: StorageServiceType.S3,
  tags: [],
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'description',
        oldValue: 'Bucket containing finance expenditures information',
        newValue: 'Bucket containing finance expenditures information updated',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.1,
  },
  deleted: false,
};

export const containerVersionMockProps: ContainerVersionProp = {
  version: '0.3',
  currentVersionData: mockContainerData,
  isVersionLoading: false,
  owners: mockOwner,
  domains: [mockDomain],
  dataProducts: [],
  tier: mockTier,
  breadCrumbList: [],
  versionList: mockVersionList,
  deleted: false,
  backHandler: mockBackHandler,
  versionHandler: mockVersionHandler,
  entityPermissions: ENTITY_PERMISSIONS,
};
