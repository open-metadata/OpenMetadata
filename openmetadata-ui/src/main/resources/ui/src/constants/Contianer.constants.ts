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
  FileFormat,
  StorageServiceType,
} from '../generated/entity/data/container';

export const CONTAINER_DUMMY_DATA = {
  id: '4e90debf-d063-49fd-9a5d-71ee43e6840a',
  name: 'departments',
  fullyQualifiedName: 's3_storage_sample.departments',
  displayName: 'Company departments',
  description: 'Bucket containing company department information. asd',
  version: 0.3,
  updatedAt: 1722838506844,
  updatedBy: 'sachin',
  service: {
    id: '5354aaf3-063e-47aa-9f1d-bae19755e905',
    type: 'storageService',
    name: 's3_storage_sample',
    fullyQualifiedName: 's3_storage_sample',
    displayName: 's3_storage_sample',
    deleted: false,
  },
  children: [
    {
      id: '11e8f1c5-77c8-4a27-a546-c6561baeba18',
      type: 'container',
      name: 'engineering',
      fullyQualifiedName: 's3_storage_sample.departments.engineering',
      description: 'Bucket containing engineering department information',
      displayName: 'Engineering department',
      deleted: false,
    },
    {
      id: 'c704e3d2-33ec-4cf0-a3fc-5e8d181c2723',
      type: 'container',
      name: 'finance',
      fullyQualifiedName: 's3_storage_sample.departments.finance',
      description: 'Bucket containing finance department information',
      displayName: 'Finance department',
      deleted: false,
    },
    {
      id: 'ffe5b6be-57cd-4cdc-9e0a-09677658160c',
      type: 'container',
      name: 'media',
      fullyQualifiedName: 's3_storage_sample.departments.media',
      description: 'Bucket containing media department information',
      displayName: 'Media department',
      deleted: false,
    },
  ],
  prefix: '/departments/',
  numberOfObjects: 2,
  size: 2048,
  fileFormats: [FileFormat.CSV],
  serviceType: StorageServiceType.S3,
  deleted: false,
};
