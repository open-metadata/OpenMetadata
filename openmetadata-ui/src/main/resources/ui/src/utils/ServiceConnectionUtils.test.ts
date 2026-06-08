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
import {
  ServiceCategory,
  ServiceNestedConnectionFields,
} from '../enums/service.enum';
import { ConfigData } from '../interface/service.interface';
import {
  buildValidConfig,
  EMPTY_CONNECTION_SCHEMA,
  flattenAuthTypeIntoConfig,
  getConnectionSchemas,
  getMissingRequiredFieldsCount,
  getSchemaWithSynthesizedAuthType,
  getSnowflakeAccountDisplayHost,
  getUISchemaWithAuthFieldsAsSelect,
  getUISchemaWithNestedDefaultFilterFieldsHidden,
  hasMissingRequiredFlatCredential,
  loadConnectionSchema,
  wrapFlatCredentialsIntoAuthType,
} from './ServiceConnectionUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';

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

describe('getSnowflakeAccountDisplayHost', () => {
  it('appends the Snowflake domain to account identifiers', () => {
    expect(getSnowflakeAccountDisplayHost('fsad.us-east-1.gcp')).toBe(
      'fsad.us-east-1.gcp.snowflakecomputing.com'
    );
  });

  it('preserves Snowflake hosts after parsing the hostname', () => {
    expect(
      getSnowflakeAccountDisplayHost(
        ' https://fsad.snowflakecomputing.com/path '
      )
    ).toBe('https://fsad.snowflakecomputing.com/path');
  });

  it('does not trust Snowflake host substrings outside the hostname', () => {
    expect(
      getSnowflakeAccountDisplayHost(
        'https://example.com/snowflakecomputing.com'
      )
    ).toBe('https://example.com/snowflakecomputing.com.snowflakecomputing.com');
  });
});

describe('connection schema loading helpers', () => {
  it('removes nil values from existing config before rendering forms', () => {
    expect(
      buildValidConfig({
        connection: {
          config: {
            host: 'localhost',
            ignoredNull: null,
            ignoredUndefined: undefined,
          },
        },
      } as never)
    ).toEqual({
      host: 'localhost',
    });
    expect(buildValidConfig()).toEqual({});
  });

  it('returns the empty schema for unsupported categories', async () => {
    await expect(
      loadConnectionSchema('unsupported' as ServiceCategory, 'unknown')
    ).resolves.toEqual(EMPTY_CONNECTION_SCHEMA);
  });

  it('loads security and drive schemas through the generic category dispatcher', async () => {
    const securitySchema = {
      schema: { title: 'Security' },
      uiSchema: {},
    };
    const driveSchema = {
      schema: { title: 'Drive' },
      uiSchema: {},
    };
    const securitySpy = jest
      .spyOn(serviceUtilClassBase, 'getSecurityServiceConfig')
      .mockReturnValue(securitySchema as never);
    const driveSpy = jest
      .spyOn(serviceUtilClassBase, 'getDriveServiceConfig')
      .mockReturnValue(driveSchema as never);

    await expect(
      getConnectionSchemas({
        serviceCategory: ServiceCategory.SECURITY_SERVICES,
        serviceType: 'Okta',
      })
    ).resolves.toEqual({
      connSch: securitySchema,
      validConfig: {},
    });
    await expect(
      getConnectionSchemas({
        serviceCategory: ServiceCategory.DRIVE_SERVICES,
        serviceType: 'GoogleDrive',
      })
    ).resolves.toEqual({
      connSch: driveSchema,
      validConfig: {},
    });

    securitySpy.mockRestore();
    driveSpy.mockRestore();
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

  it('treats non-empty array credential values as filled', () => {
    expect(
      hasMissingRequiredFlatCredential(schema, {
        password: ['secret'],
      } as unknown as ConfigData)
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

describe('getMissingRequiredFieldsCount', () => {
  it('counts missing top-level required fields', () => {
    expect(
      getMissingRequiredFieldsCount(
        {
          required: ['username', 'account'],
          properties: {
            username: { type: 'string' },
            account: { type: 'string' },
          },
        },
        {
          username: 'openmetadata',
        }
      )
    ).toBe(1);
  });

  it('counts only schema-required fields, ignoring optional flat credentials', () => {
    expect(
      getMissingRequiredFieldsCount(
        {
          required: ['username', 'account', 'warehouse'],
          properties: {
            username: { type: 'string' },
            account: { type: 'string' },
            warehouse: { type: 'string' },
            password: { format: 'password' },
            privateKey: { format: 'password' },
          },
        },
        {}
      )
    ).toBe(3);
  });

  it('counts the least expensive oneOf credential branch', () => {
    expect(
      getMissingRequiredFieldsCount(
        {
          required: ['authType'],
          properties: {
            authType: {
              oneOf: [
                {
                  type: 'object',
                  required: ['password'],
                  properties: {
                    password: { format: 'password' },
                  },
                },
                {
                  type: 'object',
                  required: ['privateKey'],
                  properties: {
                    privateKey: { format: 'password' },
                    passphrase: { format: 'password' },
                  },
                },
              ],
            },
          },
        },
        {
          authType: {},
        }
      )
    ).toBe(1);
  });
});

describe('flat credential auth synthesis', () => {
  const t = (key: string) => key;
  const flatCredentialSchema = {
    required: ['username', 'password', 'privateKey'],
    properties: {
      username: {
        type: 'string',
      },
      password: {
        type: 'string',
        format: 'password',
      },
      privateKey: {
        type: 'string',
        format: 'password',
      },
      snowflakePrivatekeyPassphrase: {
        type: 'string',
        format: 'password',
      },
    },
  };

  it('synthesizes a single authType choice for flat password and private key schemas', () => {
    const synthesized = getSchemaWithSynthesizedAuthType(
      flatCredentialSchema,
      t
    );

    expect(synthesized.properties).not.toHaveProperty('password');
    expect(synthesized.properties).not.toHaveProperty('privateKey');
    expect(synthesized.properties).not.toHaveProperty(
      'snowflakePrivatekeyPassphrase'
    );
    expect(synthesized.properties).toHaveProperty('authType');
    expect(synthesized.required).toEqual(['username', 'authType']);
    expect(
      (
        synthesized.properties.authType as {
          oneOf: Array<{ title: string; required?: string[] }>;
        }
      ).oneOf
    ).toEqual([
      expect.objectContaining({
        title: 'label.password',
        required: ['password'],
      }),
      expect.objectContaining({
        title: 'label.key-pair',
        required: ['privateKey'],
      }),
    ]);
  });

  it('does not synthesize canonical authType schemas', () => {
    const canonicalSchema = {
      required: ['authType'],
      properties: {
        authType: {
          oneOf: [
            {
              title: 'Basic Auth',
              properties: {
                username: { type: 'string' },
                password: { type: 'string', format: 'password' },
              },
            },
          ],
        },
      },
    };

    expect(getSchemaWithSynthesizedAuthType(canonicalSchema, t)).toBe(
      canonicalSchema
    );
  });

  it('wraps stored flat password config for the synthesized field', () => {
    expect(
      wrapFlatCredentialsIntoAuthType(
        {
          username: 'openmetadata',
          password: 'secret',
          privateKey: '',
        },
        flatCredentialSchema
      )
    ).toEqual({
      username: 'openmetadata',
      authType: {
        password: 'secret',
      },
    });
  });

  it('wraps stored flat private key config and drops stale password values', () => {
    expect(
      wrapFlatCredentialsIntoAuthType(
        {
          username: 'openmetadata',
          password: 'stale-secret',
          privateKey: 'pem',
          snowflakePrivatekeyPassphrase: 'phrase',
        },
        flatCredentialSchema
      )
    ).toEqual({
      username: 'openmetadata',
      authType: {
        privateKey: 'pem',
        snowflakePrivatekeyPassphrase: 'phrase',
      },
    });
  });

  it('flattens only the active synthesized password credential for backend payloads', () => {
    expect(
      flattenAuthTypeIntoConfig(
        {
          username: 'openmetadata',
          authType: {
            password: 'secret',
          },
        },
        flatCredentialSchema
      )
    ).toEqual({
      username: 'openmetadata',
      password: 'secret',
    });
  });

  it('flattens synthesized key pair credentials without carrying stale password', () => {
    expect(
      flattenAuthTypeIntoConfig(
        {
          username: 'openmetadata',
          authType: {
            password: 'stale-secret',
            privateKey: 'pem',
            snowflakePrivatekeyPassphrase: 'phrase',
          },
        },
        flatCredentialSchema
      )
    ).toEqual({
      username: 'openmetadata',
      privateKey: 'pem',
      snowflakePrivatekeyPassphrase: 'phrase',
    });
  });

  it('wraps and flattens empty synthesized credentials without carrying authType', () => {
    expect(
      wrapFlatCredentialsIntoAuthType(
        {
          username: 'openmetadata',
        },
        flatCredentialSchema
      )
    ).toEqual({
      username: 'openmetadata',
      authType: {},
    });

    expect(
      flattenAuthTypeIntoConfig(
        {
          username: 'openmetadata',
          authType: {},
        },
        flatCredentialSchema
      )
    ).toEqual({
      username: 'openmetadata',
    });
  });

  it('keeps canonical authType config nested for backend payloads', () => {
    const canonicalSchema = {
      required: ['authType'],
      properties: {
        authType: {
          oneOf: [
            {
              title: 'Basic Auth',
              properties: {
                username: { type: 'string' },
                password: { type: 'string', format: 'password' },
              },
            },
          ],
        },
      },
    };
    const canonicalConfig = {
      authType: {
        username: 'openmetadata',
        password: 'secret',
      },
    };

    expect(flattenAuthTypeIntoConfig(canonicalConfig, canonicalSchema)).toEqual(
      canonicalConfig
    );
  });

  it('counts synthesized authType as one missing required choice', () => {
    const synthesized = getSchemaWithSynthesizedAuthType(
      flatCredentialSchema,
      t
    );

    expect(
      getMissingRequiredFieldsCount(synthesized, {
        username: 'openmetadata',
        authType: {},
      })
    ).toBe(1);
    expect(
      getMissingRequiredFieldsCount(synthesized, {
        username: 'openmetadata',
        authType: {
          password: 'secret',
        },
      })
    ).toBe(0);
    expect(
      getMissingRequiredFieldsCount(synthesized, {
        username: 'openmetadata',
        authType: {
          privateKey: 'pem',
        },
      })
    ).toBe(0);
  });
});

describe('supported connector schema auth coverage', () => {
  const t = (key: string) => key;
  const supportedServices = serviceUtilClassBase.getSupportedServiceFromList();
  const supportedConnectorGroups = [
    {
      serviceCategory: ServiceCategory.DATABASE_SERVICES,
      serviceTypes: supportedServices.databaseServices,
    },
    {
      serviceCategory: ServiceCategory.MESSAGING_SERVICES,
      serviceTypes: supportedServices.messagingServices,
    },
    {
      serviceCategory: ServiceCategory.DASHBOARD_SERVICES,
      serviceTypes: supportedServices.dashboardServices,
    },
    {
      serviceCategory: ServiceCategory.PIPELINE_SERVICES,
      serviceTypes: supportedServices.pipelineServices,
    },
    {
      serviceCategory: ServiceCategory.ML_MODEL_SERVICES,
      serviceTypes: supportedServices.mlmodelServices,
    },
    {
      serviceCategory: ServiceCategory.METADATA_SERVICES,
      serviceTypes: supportedServices.metadataServices,
    },
    {
      serviceCategory: ServiceCategory.STORAGE_SERVICES,
      serviceTypes: supportedServices.storageServices,
    },
    {
      serviceCategory: ServiceCategory.SEARCH_SERVICES,
      serviceTypes: supportedServices.searchServices,
    },
    {
      serviceCategory: ServiceCategory.API_SERVICES,
      serviceTypes: supportedServices.apiServices,
    },
    {
      serviceCategory: ServiceCategory.DRIVE_SERVICES,
      serviceTypes: supportedServices.driveServices,
    },
    {
      serviceCategory: ServiceCategory.SECURITY_SERVICES,
      serviceTypes: supportedServices.securityServices,
    },
  ];
  const supportedConnectorGroupsWithServiceTypes =
    supportedConnectorGroups.filter(
      ({ serviceTypes }) => serviceTypes.length > 0
    );

  const getProperties = (schema: Record<string, unknown>) =>
    (schema.properties ?? {}) as Record<string, Record<string, unknown>>;

  const hasFlatPasswordAndPrivateKey = (schema: Record<string, unknown>) => {
    const properties = getProperties(schema);
    const secretKeys = Object.keys(properties).filter(
      (key) => properties[key]?.format === 'password'
    );

    return (
      !properties.authType &&
      secretKeys.includes('password') &&
      secretKeys.some(
        (key) => /privatekey/i.test(key) && !/passphrase/i.test(key)
      )
    );
  };

  const getAuthSelectorKeys = (schema: Record<string, unknown>) =>
    Object.entries(getProperties(schema))
      .filter(
        ([key, property]) =>
          Array.isArray(property.oneOf) &&
          (key === 'authType' || property.title === 'Auth Configuration Type')
      )
      .map(([key]) => key);

  it.each(supportedConnectorGroupsWithServiceTypes)(
    'loads every supported $serviceCategory connector schema',
    async ({ serviceCategory, serviceTypes }) => {
      expect(serviceTypes.length).toBeGreaterThan(0);

      await Promise.all(
        serviceTypes.map(async (serviceType) => {
          const connSch = await loadConnectionSchema(
            serviceCategory,
            serviceType
          );

          expect(connSch.schema).toEqual(expect.any(Object));
          expect(connSch.uiSchema).toEqual(expect.any(Object));
        })
      );
    }
  );

  it('marks every supported auth oneOf selector for the custom auth field', async () => {
    let authSelectorCount = 0;

    for (const { serviceCategory, serviceTypes } of supportedConnectorGroups) {
      for (const serviceType of serviceTypes) {
        const connSch = await loadConnectionSchema(
          serviceCategory,
          serviceType
        );
        const schema = getSchemaWithSynthesizedAuthType(connSch.schema, t);
        const uiSchema = getUISchemaWithAuthFieldsAsSelect(
          schema,
          connSch.uiSchema
        );
        const authSelectorKeys = getAuthSelectorKeys(schema);

        authSelectorCount += authSelectorKeys.length;
        authSelectorKeys.forEach((key) => {
          expect(uiSchema[key]).toEqual(
            expect.objectContaining({
              'ui:field': 'authSelect',
              'ui:fieldReplacesAnyOrOneOf': true,
            })
          );
        });
      }
    }

    expect(authSelectorCount).toBeGreaterThan(10);
  });

  it('synthesizes legacy flat password/private-key connector schemas generically', async () => {
    let synthesizedConnectorCount = 0;

    for (const { serviceCategory, serviceTypes } of supportedConnectorGroups) {
      for (const serviceType of serviceTypes) {
        const connSch = await loadConnectionSchema(
          serviceCategory,
          serviceType
        );

        if (!hasFlatPasswordAndPrivateKey(connSch.schema)) {
          continue;
        }

        const schema = getSchemaWithSynthesizedAuthType(connSch.schema, t);
        const properties = getProperties(schema);

        synthesizedConnectorCount += 1;

        expect(properties).toHaveProperty('authType');
        expect(properties).not.toHaveProperty('password');
        expect(properties).not.toHaveProperty('privateKey');
        expect(schema.required).toContain('authType');
        expect(schema.required).not.toContain('password');
        expect(schema.required).not.toContain('privateKey');
      }
    }

    expect(synthesizedConnectorCount).toBeGreaterThan(0);
  });
});
