/*
 *  Copyright 2024 Collate.
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
import { COMMON_UI_SCHEMA } from '../constants/Services.constant';
import { StorageServiceType } from '../generated/entity/services/storageService';

type SchemaModule =
  | { default: Record<string, unknown> }
  | Record<string, unknown>;
type SchemaLoader = () => Promise<SchemaModule>;

const storageSchemaLoaders: Partial<Record<StorageServiceType, SchemaLoader>> =
  {
    [StorageServiceType.S3]: () =>
      import(
        '../jsons/connectionSchemas/connections/storage/s3Connection.json'
      ),
    [StorageServiceType.Gcs]: () =>
      import(
        '../jsons/connectionSchemas/connections/storage/gcsConnection.json'
      ),
    [StorageServiceType.CustomStorage]: () =>
      import(
        '../jsons/connectionSchemas/connections/storage/customStorageConnection.json'
      ),
  };

const resolveSchemaModule = (mod: SchemaModule): Record<string, unknown> => {
  const maybeDefault = (mod as { default?: Record<string, unknown> }).default;

  return maybeDefault ?? (mod as Record<string, unknown>);
};

export const getStorageConfig = async (type: StorageServiceType) => {
  const loader = storageSchemaLoaders[type];
  let schema: Record<string, unknown> = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };

  if (loader) {
    const mod = await loader();
    schema = resolveSchemaModule(mod);
  }

  return cloneDeep({ schema, uiSchema });
};
