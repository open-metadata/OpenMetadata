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

import { render, screen } from '@testing-library/react';
import teradataSchema from '../jsons/connectionSchemas/connections/database/teradataConnection.json';
import mlflowSchema from '../jsons/connectionSchemas/connections/mlmodel/mlflowConnection.json';
import { getKeyValues } from './ServiceConnectionDetailsUtils';

describe('getKeyValues', () => {
  it.each([
    {
      schema: mlflowSchema,
      field: 'registryUri',
      value: 'http://localhost:5000',
      serviceCategory: 'mlmodelServices',
    },
    {
      schema: teradataSchema,
      field: 'logdata',
      value: 'EXAMPLE.REALM',
      serviceCategory: 'databaseServices',
    },
  ])(
    'renders $field as a password input using the generated schema',
    ({ schema, field, value, serviceCategory }) => {
      render(
        <>
          {getKeyValues({
            obj: { [field]: value },
            schemaPropertyObject: schema.properties,
            schema,
            serviceCategory,
          })}
        </>
      );

      expect(screen.getByTestId('input-field')).toHaveAttribute(
        'type',
        'password'
      );
      expect(screen.getByTestId('input-field')).toHaveValue(value);
    }
  );
});
