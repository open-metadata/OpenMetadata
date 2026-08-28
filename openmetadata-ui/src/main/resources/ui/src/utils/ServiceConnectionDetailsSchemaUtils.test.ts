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

import {
  getMatchingOneOfSchema,
  getNestedSchema,
  getSchemaObjects,
  getSchemaProperty,
  isFilterPatternValue,
  resolveSchemaReference,
} from './ServiceConnectionDetailsSchemaUtils';

const serviceAccountSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'service_account' },
    privateKey: { type: 'string', format: 'password' },
  },
};

const credentialPathSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'gcp_credential_path' },
    path: { type: 'string' },
  },
};

const externalAccountSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'external_account' },
    externalType: { type: 'string', const: 'external_account' },
  },
};

const tokenAuthSchema = {
  type: 'object',
  required: ['token'],
  properties: {
    token: { type: 'string', format: 'password' },
  },
};

const basicAuthSchema = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string' },
    password: { type: 'string', format: 'password' },
  },
};

const postgresConnectionSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['Postgres'] },
    hostPort: { type: 'string' },
  },
};

const apiConnectionSchema = {
  type: 'object',
  required: ['apiUrl'],
  properties: {
    apiUrl: { type: 'string' },
  },
};

const schema = {
  definitions: {
    credentialPath: credentialPathSchema,
  },
  properties: {
    gcpConfig: {
      oneOf: [
        serviceAccountSchema,
        { $ref: '#/definitions/credentialPath' },
        externalAccountSchema,
      ],
    },
  },
};

describe('ServiceConnectionDetailsSchemaUtils', () => {
  it('resolves local references and preserves inline metadata', () => {
    expect(
      resolveSchemaReference(
        {
          $ref: '#/definitions/credentialPath',
          description: 'Credential file location',
        },
        [schema]
      )
    ).toEqual({
      ...credentialPathSchema,
      description: 'Credential file location',
    });
  });

  it('resolves a property schema before selecting a discriminator branch', () => {
    const propertySchema = getSchemaProperty({
      key: 'gcpConfig',
      schema,
      schemaContext: schema,
      schemaPropertyObject: schema.properties,
    });

    expect(propertySchema).toEqual(schema.properties.gcpConfig);
    expect(
      getNestedSchema({
        schema,
        schemaContext: schema,
        schemaProperty: propertySchema,
        value: { type: 'gcp_credential_path', path: '/tmp/credentials.json' },
      })
    ).toEqual({
      schemaContext: credentialPathSchema,
      schemaPropertyObject: credentialPathSchema.properties,
    });
    expect(
      getMatchingOneOfSchema(
        { type: 'gcp_credential_path', path: '/tmp/credentials.json' },
        getSchemaObjects(propertySchema?.oneOf),
        [schema]
      )
    ).toEqual(credentialPathSchema);
  });

  it('fails closed when no discriminator branch matches', () => {
    const propertySchema = getSchemaProperty({
      key: 'gcpConfig',
      schema,
      schemaContext: schema,
      schemaPropertyObject: schema.properties,
    });

    expect(
      getMatchingOneOfSchema(
        { type: 'unknown', privateKey: 'private-key' },
        getSchemaObjects(propertySchema?.oneOf),
        [schema]
      )
    ).toBeUndefined();
    expect(
      getNestedSchema({
        schema,
        schemaContext: schema,
        schemaProperty: propertySchema,
        value: { type: 'unknown', privateKey: 'private-key' },
      })
    ).toBeUndefined();
    expect(
      getMatchingOneOfSchema(
        { type: 'unknown', externalType: 'external_account' },
        getSchemaObjects(propertySchema?.oneOf),
        [schema]
      )
    ).toBeUndefined();
  });

  it('accepts filter patterns with either optional list', () => {
    expect(isFilterPatternValue({ includes: ['table_.*'] })).toBe(true);
    expect(isFilterPatternValue({ excludes: ['tmp_.*'] })).toBe(true);
    expect(isFilterPatternValue({})).toBe(false);
  });

  it('selects non-discriminated branches by their required value shape', () => {
    expect(
      getMatchingOneOfSchema(
        { token: 'token-value' },
        [basicAuthSchema, tokenAuthSchema],
        []
      )
    ).toEqual(tokenAuthSchema);
  });

  it('supports a non-discriminated branch alongside discriminated branches', () => {
    expect(
      getMatchingOneOfSchema(
        { apiUrl: 'https://example.com' },
        [postgresConnectionSchema, apiConnectionSchema],
        []
      )
    ).toEqual(apiConnectionSchema);
  });
});
