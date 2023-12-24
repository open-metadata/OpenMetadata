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

import { generateRandomTable } from '../common/EntityUtils';
import { DATABASE_SERVICE, VISIT_ENTITIES_DATA } from './EntityConstant';

export const TAGS_ADD_REMOVE_TABLE = generateRandomTable();

export const TAGS_ADD_REMOVE_ENTITIES = [
  {
    term: TAGS_ADD_REMOVE_TABLE.name,
    displayName: TAGS_ADD_REMOVE_TABLE.name,
    entity: 'tables',
    serviceName: DATABASE_SERVICE.service.name,
    fieldName: TAGS_ADD_REMOVE_TABLE.columns[0].name,
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    ...VISIT_ENTITIES_DATA.topic,
    fieldName: 'first_name',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    ...VISIT_ENTITIES_DATA.dashboard,
    insideEntity: 'charts',
    fieldName: 'e3cfd274-44f8-4bf3-b75d-d40cf88869ba',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    ...VISIT_ENTITIES_DATA.pipeline,
    fieldName: 'snowflake_task',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    ...VISIT_ENTITIES_DATA.mlmodel,
    fieldName: 'sales',
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/*',
  },
  {
    ...VISIT_ENTITIES_DATA.container,
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    ...VISIT_ENTITIES_DATA.storedProcedure,
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
  {
    ...VISIT_ENTITIES_DATA.dataModel,
    tags: ['PersonalData.Personal', 'PII.Sensitive'],
    permissionApi: '/api/v1/permissions/*/name/*',
  },
];
