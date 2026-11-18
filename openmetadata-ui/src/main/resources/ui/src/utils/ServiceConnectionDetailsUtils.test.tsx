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
import databricksPipelineSchema from '../jsons/connectionSchemas/connections/pipeline/databricksPipelineConnection.json';
import {
  getKeyValues,
  getSchemaProperties,
} from './ServiceConnectionDetailsUtils';

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

const SFTP_SCHEMA = {
  properties: {
    host: { title: 'Host', type: 'string' },
    authType: {
      title: 'Authentication Type',
      oneOf: [
        {
          title: 'Username/Password Authentication',
          type: 'object',
          properties: {
            username: { title: 'Username', type: 'string' },
            password: { title: 'Password', type: 'string', format: 'password' },
          },
        },
        {
          title: 'Private Key Authentication',
          type: 'object',
          properties: {
            username: { title: 'Username', type: 'string' },
            privateKey: {
              title: 'Private Key',
              type: 'string',
              format: 'password',
            },
          },
        },
      ],
    },
  },
};

describe('getSchemaProperties', () => {
  it('resolves the properties of the oneOf branch matching the stored value', () => {
    expect(
      getSchemaProperties(
        SFTP_SCHEMA.properties.authType,
        { username: 'sftp-user', password: '*********' },
        SFTP_SCHEMA
      )
    ).toEqual({
      username: { title: 'Username', type: 'string' },
      password: { title: 'Password', type: 'string', format: 'password' },
      privateKey: { title: 'Private Key', type: 'string', format: 'password' },
    });
  });

  it('keeps every branch so a secret declared in any of them stays marked', () => {
    const resolved = getSchemaProperties(
      SFTP_SCHEMA.properties.authType,
      {},
      SFTP_SCHEMA
    );

    expect(resolved.password).toHaveProperty('format', 'password');
    expect(resolved.privateKey).toHaveProperty('format', 'password');
  });

  it('follows a local $ref before reading the branches', () => {
    const schema = {
      definitions: { auth: SFTP_SCHEMA.properties.authType },
      properties: { authType: { $ref: '#/definitions/auth' } },
    };

    expect(
      getSchemaProperties(schema.properties.authType, { password: 'x' }, schema)
    ).toHaveProperty('password.format', 'password');
  });

  it('returns an empty object for a property with neither properties nor branches', () => {
    expect(getSchemaProperties({ type: 'string' }, {}, SFTP_SCHEMA)).toEqual(
      {}
    );
    expect(getSchemaProperties(undefined, {}, SFTP_SCHEMA)).toEqual({});
  });

  it('stops at a $ref that points nowhere instead of throwing', () => {
    const schema = {
      definitions: {},
      properties: { authType: { $ref: '#/definitions/missing' } },
    };

    expect(getSchemaProperties(schema.properties.authType, {}, schema)).toEqual(
      {}
    );
  });

  it('does not loop on a self-referential $ref', () => {
    const schema = {
      definitions: { loop: { $ref: '#/definitions/loop' } },
      properties: { authType: { $ref: '#/definitions/loop' } },
    };

    expect(getSchemaProperties(schema.properties.authType, {}, schema)).toEqual(
      {}
    );
  });
});

describe('getKeyValues with secrets nested in a oneOf', () => {
  const renderConnection = (
    connection: Record<string, unknown>,
    schema: { properties: Record<string, unknown> },
    serviceCategory: string
  ) =>
    render(
      <div>
        {getKeyValues({
          obj: connection,
          schemaPropertyObject: schema.properties,
          schema,
          serviceCategory,
        })}
      </div>
    );

  const findInput = (value: string) =>
    screen
      .getAllByTestId('input-field')
      .find((input) => (input as HTMLInputElement).value === value);

  it('renders an SFTP password nested in a oneOf branch as a password input', () => {
    renderConnection(
      {
        host: 'sftp.example.com',
        authType: { username: 'sftp-user', password: '*********' },
      },
      SFTP_SCHEMA,
      'driveServices'
    );

    expect(findInput('*********')).toHaveAttribute('type', 'password');
    expect(findInput('sftp-user')).toHaveAttribute('type', 'text');
  });

  it('renders the Databricks Pipeline token as a password input', () => {
    renderConnection(
      {
        hostPort: 'dbc.cloud.databricks.com:443',
        authType: { token: 'dapi-token' },
      },
      databricksPipelineSchema,
      'pipelineServices'
    );

    expect(findInput('dapi-token')).toHaveAttribute('type', 'password');
  });

  it('renders the Databricks Pipeline OAuth client secret as a password input', () => {
    renderConnection(
      {
        hostPort: 'dbc.cloud.databricks.com:443',
        authType: { clientId: 'client-id', clientSecret: 'client-secret' },
      },
      databricksPipelineSchema,
      'pipelineServices'
    );

    expect(findInput('client-secret')).toHaveAttribute('type', 'password');
    expect(findInput('client-id')).toHaveAttribute('type', 'text');
  });
});
