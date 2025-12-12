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
import { COMMON_UI_SCHEMA } from '../constants/Services.constant';
import { Type } from '../generated/entity/services/securityService';

export const getSecurityConfig = (type: Type) => {
  let schema = {};
  const uiSchema = { ...COMMON_UI_SCHEMA };

  switch (type) {
    case Type.Ranger: {
      schema = require('../jsons/connectionSchemas/connections/security/rangerConnection.json');

      break;
    }
    default:
      break;
  }

  return cloneDeep({ schema, uiSchema });
};
