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
export const MOCK_SELECT_WIDGET = {
  autofocus: false,
  disabled: false,
  formContext: { handleFocus: undefined },
  hideError: undefined,
  hideLabel: false,
  id: 'root/searchIndexMappingLanguage',
  label: 'Search Index Language',
  name: 'searchIndexMappingLanguage',
  options: {
    enumOptions: [
      { label: 'EN', value: 'EN' },
      { label: 'JP', value: 'JP' },
      { label: 'ZH', value: 'ZH' },
    ],
  },
  placeholder: '',
  rawErrors: undefined,
  readonly: false,
  required: false,
  schema: {
    description: 'Recreate Indexes with updated Language',
    title: 'Search Index Language',
    javaType: 'org.openmetadata.schema.type.IndexMappingLanguage',
    enum: ['EN', 'JP', 'ZH'],
  },
  uiSchema: {},
  value: 'JP',
};
