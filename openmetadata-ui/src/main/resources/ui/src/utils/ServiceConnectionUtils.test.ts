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
import { reduce } from 'lodash';
import { SERVICE_FILTER_PATTERN_FIELDS } from '../constants/ServiceConnection.constants';
import { ServiceNestedConnectionFields } from '../enums/service.enum';
import { getUISchemaWithNestedDefaultFilterFieldsHidden } from './ServiceConnectionUtils';

// The function adds all filter pattern fields to each nested connection field
const mockExpectedHiddenFields = reduce(
  SERVICE_FILTER_PATTERN_FIELDS,
  (acc, field) => {
    acc[field] = {
      'ui:widget': 'hidden',
      'ui:hideError': true,
    };

    return acc;
  },
  {} as Record<string, any>
);

const mockUISchemaAdditionalFields = reduce(
  Object.values(ServiceNestedConnectionFields),
  (acc, field) => {
    acc[field] = mockExpectedHiddenFields;

    return acc;
  },
  {} as Record<string, any>
);

describe('getUISchemaWithNestedDefaultFilterFieldsHidden', () => {
  it('should preserve top level fields', () => {
    const inputSchema = {
      topLevelField1: {
        'ui:widget': 'text',
      },
      topLevelField2: {
        'ui:widget': 'text',
      },
    };

    const result = getUISchemaWithNestedDefaultFilterFieldsHidden(inputSchema);

    expect(result).toEqual({ ...inputSchema, ...mockUISchemaAdditionalFields });
  });

  it('should preserve nested fields extra properties', () => {
    const inputSchema = {
      topLevelField1: {
        'ui:widget': 'text',
      },
      [ServiceNestedConnectionFields.CONNECTION]: {
        preserveProperty: 'value',
      },
    };

    const result = getUISchemaWithNestedDefaultFilterFieldsHidden(inputSchema);

    expect(result).toEqual({
      ...inputSchema,
      ...mockUISchemaAdditionalFields,
      [ServiceNestedConnectionFields.CONNECTION]: {
        preserveProperty: 'value',
        ...mockExpectedHiddenFields,
      },
    });
  });
});
