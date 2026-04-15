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
  DatabaseService,
  DatabaseServiceType,
} from '../generated/entity/services/databaseService';

export const SERVICE_DUMMY_DATA: DatabaseService = {
  id: 'c4f1d0d5-ace6-4e57-b734-8e7f0a5e2c9f',
  name: 'sample_data',
  fullyQualifiedName: 'sample_data',
  displayName: 'Sample Data',
  description:
    'This **mock** service contains sample databases with schemas and tables for demonstration purposes.',
  serviceType: DatabaseServiceType.BigQuery,
  tags: [],
  version: 1.0,
  updatedAt: 1736405710107,
  updatedBy: 'admin',
  owners: [
    {
      id: '50bb97a5-cf0c-4273-930e-b3e802b52ee1',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      displayName: 'Admin',
      deleted: false,
    },
  ],
  deleted: false,
  domains: [],
  followers: [],
};
