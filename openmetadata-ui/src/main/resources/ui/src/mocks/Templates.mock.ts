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

import { IdSchema } from '@rjsf/utils';

export const MOCK_WORKFLOW_ARRAY_FIELD_TEMPLATE = {
  autofocus: false,
  disabled: false,
  formContext: { handleFocus: undefined },
  formData: ['test_value1', 'test_value2'],
  hideError: undefined,
  id: 'root/workflow-array-field-template',
  name: 'workflowArrayFieldTemplate',
  options: {
    enumOptions: [],
  },
  placeholder: '',
  rawErrors: undefined,
  readonly: false,
  required: false,
  idSchema: {
    $id: 'root/workflow-array-field-template',
  } as IdSchema,
  idSeparator: '/',
  schema: {
    description: 'this is array field',
    title: 'ArrayField',
  },
  uiSchema: {},
};
