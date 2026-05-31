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
import {
  getUISchemaWithAuthFieldsAsSelect,
  getUISchemaWithNestedDefaultFilterFieldsHidden,
  hasMissingRequiredFlatCredential,
} from './ServiceConnectionUtils';

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
  {} as Record<string, unknown>
);

const mockUISchemaAdditionalFields = reduce(
  Object.values(ServiceNestedConnectionFields),
  (acc, field) => {
    acc[field] = mockExpectedHiddenFields;

    return acc;
  },
  {} as Record<string, unknown>
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

describe('getUISchemaWithAuthFieldsAsSelect', () => {
  it('marks auth oneOf fields as fully handled by the custom auth selector', () => {
    const result = getUISchemaWithAuthFieldsAsSelect(
      {
        properties: {
          authType: {
            oneOf: [
              {
                title: 'Basic Auth',
                type: 'object',
              },
            ],
          },
        },
      },
      {}
    );

    expect(result.authType).toEqual({
      'ui:field': 'authSelect',
      'ui:fieldReplacesAnyOrOneOf': true,
    });
  });
});

describe('hasMissingRequiredFlatCredential', () => {
  const schema = {
    properties: {
      password: {
        format: 'password',
      },
      privateKey: {
        format: 'password',
      },
      snowflakePrivatekeyPassphrase: {
        format: 'password',
      },
    },
  };

  it('returns true when flat credential fields are empty', () => {
    expect(hasMissingRequiredFlatCredential(schema, {})).toBe(true);
  });

  it('returns false when one credential method has a value', () => {
    expect(
      hasMissingRequiredFlatCredential(schema, {
        privateKey: 'private-key-value',
      })
    ).toBe(false);
  });

  it('does not treat a passphrase-only value as the credential method', () => {
    expect(
      hasMissingRequiredFlatCredential(schema, {
        snowflakePrivatekeyPassphrase: 'passphrase',
      })
    ).toBe(true);
  });

  it('lets authType schemas rely on JSON schema validation', () => {
    expect(
      hasMissingRequiredFlatCredential(
        {
          properties: {
            authType: {
              oneOf: [],
            },
            password: {
              format: 'password',
            },
          },
        },
        {}
      )
    ).toBe(false);
  });
});
