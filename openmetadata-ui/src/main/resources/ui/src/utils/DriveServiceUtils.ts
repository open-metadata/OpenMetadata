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

import { cloneDeep } from 'lodash';
import { COMMON_UI_SCHEMA } from '../constants/ServiceUISchema.constant';
import { DriveServiceType } from '../generated/entity/services/driveService';

type SchemaModule =
  | { default: Record<string, unknown> }
  | Record<string, unknown>;
type SchemaLoader = () => Promise<SchemaModule>;

const driveSchemaLoaders: Partial<Record<DriveServiceType, SchemaLoader>> = {
  [DriveServiceType.CustomDrive]: () =>
    import(
      '../jsons/connectionSchemas/connections/drive/customDriveConnection.json'
    ),
  [DriveServiceType.GoogleDrive]: () =>
    import(
      '../jsons/connectionSchemas/connections/drive/googleDriveConnection.json'
    ),
  [DriveServiceType.SFTP]: () =>
    import('../jsons/connectionSchemas/connections/drive/sftpConnection.json'),
};

const resolveSchemaModule = (mod: SchemaModule): Record<string, unknown> => {
  const maybeDefault = (mod as { default?: Record<string, unknown> }).default;

  return maybeDefault ?? (mod as Record<string, unknown>);
};

export const getDriveConfig = async (type: DriveServiceType) => {
  const loader = driveSchemaLoaders[type];
  let schema: Record<string, unknown> = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };

  if (loader) {
    const mod = await loader();
    schema = resolveSchemaModule(mod);
  }

  return cloneDeep({ schema, uiSchema });
};
