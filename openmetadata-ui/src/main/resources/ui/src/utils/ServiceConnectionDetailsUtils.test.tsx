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
import { Row } from 'antd';
import {
  getKeyValues,
  getSchemaProperties,
} from './ServiceConnectionDetailsUtils';

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

describe('getKeyValues', () => {
  const renderConnection = (connection: Record<string, unknown>) =>
    render(
      <Row>
        {getKeyValues({
          obj: connection,
          schemaPropertyObject: SFTP_SCHEMA.properties,
          schema: SFTP_SCHEMA,
          serviceCategory: 'driveServices',
        })}
      </Row>
    );

  it('renders a secret nested in a oneOf branch as a password input', () => {
    renderConnection({
      host: 'sftp.example.com',
      authType: { username: 'sftp-user', password: '*********' },
    });

    const inputs = screen.getAllByTestId('input-field');
    const password = inputs.find(
      (input) => (input as HTMLInputElement).value === '*********'
    );

    expect(password).toHaveAttribute('type', 'password');
  });

  it('leaves non-secret fields readable', () => {
    renderConnection({
      host: 'sftp.example.com',
      authType: { username: 'sftp-user', password: '*********' },
    });

    const username = screen
      .getAllByTestId('input-field')
      .find((input) => (input as HTMLInputElement).value === 'sftp-user');

    expect(username).toHaveAttribute('type', 'text');
  });
});
