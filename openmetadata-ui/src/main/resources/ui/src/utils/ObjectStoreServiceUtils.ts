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
import { COMMON_UI_SCHEMA } from 'constants/Services.constant';
import { ObjectStoreServiceType } from 'generated/entity/data/container';
import s3Connection from 'jsons/connectionSchemas/connections/objectstore/s3ObjectStoreConnection.json';
import { cloneDeep } from 'lodash';

export const getObjectStoreConfig = (type: ObjectStoreServiceType) => {
  let schema = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };
  switch (type) {
    case ObjectStoreServiceType.S3: {
      schema = s3Connection;

      break;
    }
  }

  return cloneDeep({ schema, uiSchema });
};
