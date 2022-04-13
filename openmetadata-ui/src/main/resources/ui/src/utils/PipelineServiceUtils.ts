/*
 *  Copyright 2021 Collate
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

import { JSONSchema7 } from 'json-schema';
import { cloneDeep } from 'lodash';

export const getPipelineConfig = () => {
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'PipelineConnection',
    description: 'Pipeline Connection Config',
    type: 'object',
    properties: {
      pipelineUrl: {
        description: 'Pipeline Service Management/UI URL.',
        type: 'string',
        format: 'uri',
      },
    },
    additionalProperties: false,
  } as JSONSchema7;
  const uiSchema = {};

  return cloneDeep({ schema, uiSchema });
};
