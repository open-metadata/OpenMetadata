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
import { cloneDeep, isNil, reduce } from 'lodash';
import { SERVICE_FILTER_PATTERN_FIELDS } from '../constants/ServiceConnection.constants';
import {
  ADVANCED_PROPERTIES,
  OPTIONAL_CONNECTION_PROPERTIES,
  OPTIONAL_SCOPE_PROPERTIES,
} from '../constants/ServiceType.constant';
import {
  ServiceCategory,
  ServiceNestedConnectionFields,
} from '../enums/service.enum';
import { ServiceConnectionFilterPatternFields } from '../enums/ServiceConnection.enum';
import { APIServiceType } from '../generated/entity/data/apiCollection';
import { StorageServiceType } from '../generated/entity/data/container';
import { DashboardServiceType } from '../generated/entity/data/dashboard';
import { DatabaseServiceType } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import { PipelineServiceType } from '../generated/entity/data/pipeline';
import { SearchServiceType } from '../generated/entity/data/searchIndex';
import { MessagingServiceType } from '../generated/entity/data/topic';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { ConfigData, ServicesType } from '../interface/service.interface';
import serviceUtilClassBase from './ServiceUtilClassBase';

export type ConnectionSchemaResult = {
  connSch: {
    schema: Record<string, unknown>;
    uiSchema: Record<string, unknown>;
  };
  validConfig: ConfigData;
};

export const EMPTY_CONNECTION_SCHEMA: ConnectionSchemaResult['connSch'] = {
  schema: {},
  uiSchema: {},
};

const SNOWFLAKE_HOST = 'snowflakecomputing.com';
const SNOWFLAKE_HOST_SUFFIX = `.${SNOWFLAKE_HOST}`;
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:\/\//i;

const getNormalizedHostname = (value: string) => {
  const candidate = URL_SCHEME_PATTERN.test(value) ? value : `https://${value}`;

  try {
    return new URL(candidate).hostname.toLowerCase();
  } catch {
    return '';
  }
};

export const getSnowflakeAccountDisplayHost = (account: string) => {
  const trimmedAccount = account.trim();

  if (!trimmedAccount) {
    return '';
  }

  const hostname = getNormalizedHostname(trimmedAccount);
  const isSnowflakeHost =
    hostname === SNOWFLAKE_HOST || hostname.endsWith(SNOWFLAKE_HOST_SUFFIX);

  return isSnowflakeHost
    ? trimmedAccount
    : `${trimmedAccount}.${SNOWFLAKE_HOST}`;
};

export const buildValidConfig = (data?: ServicesType): ConfigData => {
  const config = isNil(data)
    ? ({} as ConfigData)
    : (data.connection?.config as ConfigData);
  const validConfig = cloneDeep(config || {});
  for (const [key, value] of Object.entries(validConfig)) {
    if (isNil(value)) {
      delete validConfig[key as keyof ConfigData];
    }
  }

  return validConfig;
};

export const loadConnectionSchema = async (
  serviceCategory: ServiceCategory,
  serviceType: string
): Promise<ConnectionSchemaResult['connSch']> => {
  switch (serviceCategory) {
    case ServiceCategory.DATABASE_SERVICES:
      return serviceUtilClassBase.getDatabaseServiceConfig(
        serviceType as DatabaseServiceType
      );
    case ServiceCategory.MESSAGING_SERVICES:
      return serviceUtilClassBase.getMessagingServiceConfig(
        serviceType as MessagingServiceType
      );
    case ServiceCategory.DASHBOARD_SERVICES:
      return serviceUtilClassBase.getDashboardServiceConfig(
        serviceType as DashboardServiceType
      );
    case ServiceCategory.PIPELINE_SERVICES:
      return serviceUtilClassBase.getPipelineServiceConfig(
        serviceType as PipelineServiceType
      );
    case ServiceCategory.ML_MODEL_SERVICES:
      return serviceUtilClassBase.getMlModelServiceConfig(
        serviceType as MlModelServiceType
      );
    case ServiceCategory.METADATA_SERVICES:
      return serviceUtilClassBase.getMetadataServiceConfig(
        serviceType as MetadataServiceType
      );
    case ServiceCategory.STORAGE_SERVICES:
      return serviceUtilClassBase.getStorageServiceConfig(
        serviceType as StorageServiceType
      );
    case ServiceCategory.SEARCH_SERVICES:
      return serviceUtilClassBase.getSearchServiceConfig(
        serviceType as SearchServiceType
      );
    case ServiceCategory.API_SERVICES:
      return serviceUtilClassBase.getAPIServiceConfig(
        serviceType as APIServiceType
      );
    case ServiceCategory.SECURITY_SERVICES:
      return serviceUtilClassBase.getSecurityServiceConfig(
        serviceType as SecurityServiceType
      );
    case ServiceCategory.DRIVE_SERVICES:
      return serviceUtilClassBase.getDriveServiceConfig(
        serviceType as DriveServiceType
      );
    default:
      return EMPTY_CONNECTION_SCHEMA;
  }
};

export const getConnectionSchemas = async ({
  data,
  serviceCategory,
  serviceType,
}: {
  data?: ServicesType;
  serviceType: string;
  serviceCategory: ServiceCategory;
}): Promise<ConnectionSchemaResult> => {
  const validConfig = buildValidConfig(data);
  const connSch = await loadConnectionSchema(serviceCategory, serviceType);

  return { connSch, validConfig };
};

/**
 * Filters the schema to remove default filters
 * @param schema - The schema to filter
 * @param removeDefaultFilters - Whether to remove default filter fields,
 * if true, it will remove the fields that are in the SERVICE_FILTER_PATTERN_FIELDS
 * if false, it will keep only fields that are in the SERVICE_FILTER_PATTERN_FIELDS
 * @returns The filtered schema
 */
export const getFilteredSchema = (
  schema?: Record<string, unknown>,
  removeDefaultFilters = true
) =>
  Object.fromEntries(
    Object.entries(schema ?? {}).filter(([key]) => {
      const isFiltersField = SERVICE_FILTER_PATTERN_FIELDS.includes(
        key as ServiceConnectionFilterPatternFields
      );

      return removeDefaultFilters ? !isFiltersField : isFiltersField;
    })
  );

/**
 * Hides all the default filter fields in the UI Schema nested under all the ServiceNestedConnectionFields
 * @param uiSchema - The UI Schema to hide the default filter fields
 * @returns The UI Schema with all the default filter fields hidden
 */
export const getUISchemaWithNestedDefaultFilterFieldsHidden = (
  uiSchema: Record<string, unknown>
) => {
  const uiSchemaWithAllDefaultFilterFieldsHidden = reduce(
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

  const uiSchemaWithNestedDefaultFilterFieldsHidden = reduce(
    Object.values(ServiceNestedConnectionFields),
    (acc, field) => {
      acc[field] = {
        ...(uiSchema[field] as Record<string, unknown> | undefined),
        ...uiSchemaWithAllDefaultFilterFieldsHidden,
      };

      return acc;
    },
    {} as Record<string, unknown>
  );

  return {
    ...uiSchema,
    ...uiSchemaWithNestedDefaultFilterFieldsHidden,
  };
};

export const AUTH_SELECT_FIELD = 'authSelect';
const AUTH_PROPERTY_KEY = 'authType';
const AUTH_CONFIGURATION_TITLE = 'Auth Configuration Type';

const isAuthSelectorProperty = (
  key: string,
  property?: Record<string, unknown>
): boolean =>
  Array.isArray(property?.oneOf) &&
  (key === AUTH_PROPERTY_KEY || property?.title === AUTH_CONFIGURATION_TITLE);

/**
 * Routes every mutually-exclusive credential property (a `oneOf` named `authType`
 * or titled "Auth Configuration Type") through the generic {@code authSelect}
 * field, which renders the design's segmented method selector. This keys off
 * schema structure alone, so it lights up for every connector that models auth
 * as a `oneOf` without any per-connector code.
 * @param schema - The connection JSON schema being rendered
 * @param uiSchema - The UI Schema to augment
 * @returns The UI Schema with `ui:field: authSelect` on each auth property
 */
export const getUISchemaWithAuthFieldsAsSelect = (
  schema: Record<string, unknown> | undefined,
  uiSchema: Record<string, unknown>
): Record<string, unknown> => {
  const properties = (schema?.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const authFieldUiSchema = reduce(
    Object.keys(properties).filter((key) =>
      isAuthSelectorProperty(key, properties[key])
    ),
    (acc, key) => {
      const oneOfOptions = (properties[key].oneOf ?? []) as Array<
        Record<string, Record<string, unknown>>
      >;
      const recommendedOption = oneOfOptions.find((option) => {
        const optionProps = (option.properties ?? {}) as Record<
          string,
          Record<string, unknown>
        >;

        return Object.values(optionProps).some(
          (prop) => prop.recommended === true
        );
      });
      const recommendedTitle = recommendedOption?.title as string | undefined;

      acc[key] = {
        ...(uiSchema[key] as Record<string, unknown> | undefined),
        'ui:field': AUTH_SELECT_FIELD,
        'ui:fieldReplacesAnyOrOneOf': true,
        ...(recommendedTitle
          ? { 'ui:options': { recommended: recommendedTitle } }
          : {}),
      };

      return acc;
    },
    {} as Record<string, unknown>
  );

  return {
    ...uiSchema,
    ...authFieldUiSchema,
  };
};

const PASSWORD_FORMAT = 'password';
const PASSWORD_KEY = 'password';
const PRIVATE_KEY_RE = /privatekey/i;
const PASSPHRASE_RE = /passphrase/i;

type JsonObject = Record<string, Record<string, unknown>>;

const getFlatSecretKeys = (
  schema?: Record<string, unknown>
): { secretKeys: string[]; hasPassword: boolean; hasPrivateKey: boolean } => {
  const properties = (schema?.properties ?? {}) as JsonObject;
  const secretKeys = Object.keys(properties).filter(
    (key) => properties[key]?.format === PASSWORD_FORMAT
  );

  return {
    secretKeys,
    hasPassword: secretKeys.includes(PASSWORD_KEY),
    hasPrivateKey: secretKeys.some(
      (key) => PRIVATE_KEY_RE.test(key) && !PASSPHRASE_RE.test(key)
    ),
  };
};

const hasSynthesizableFlatAuth = (
  schema?: Record<string, unknown>
): boolean => {
  const properties = schema?.properties as JsonObject | undefined;
  const { hasPassword, hasPrivateKey } = getFlatSecretKeys(schema);

  return Boolean(
    properties && !properties[AUTH_PROPERTY_KEY] && hasPassword && hasPrivateKey
  );
};

const isFilledValue = (value: unknown): boolean => {
  if (isNil(value)) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
};

const getRequiredFields = (schema: Record<string, unknown>): string[] => {
  const required = schema.required;

  return Array.isArray(required)
    ? required.filter((field): field is string => typeof field === 'string')
    : [];
};

export const getMissingSchemaRequiredFieldsCount = (
  schema: Record<string, unknown>,
  formData?: Record<string, unknown>
): number => {
  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf)) {
    const counts = oneOf
      .filter((branch): branch is Record<string, unknown> => {
        return Boolean(branch) && typeof branch === 'object';
      })
      .map((branch) => getMissingSchemaRequiredFieldsCount(branch, formData));

    return counts.length > 0 ? Math.min(...counts) : 0;
  }

  const properties = (schema.properties ?? {}) as JsonObject;

  return getRequiredFields(schema).reduce((count, key) => {
    const value = formData?.[key];
    const propertySchema = properties[key];

    if (!isFilledValue(value)) {
      return count + 1;
    }

    if (
      propertySchema &&
      typeof propertySchema === 'object' &&
      !Array.isArray(value) &&
      typeof value === 'object'
    ) {
      return (
        count +
        getMissingSchemaRequiredFieldsCount(
          propertySchema,
          value as Record<string, unknown>
        )
      );
    }

    return count;
  }, 0);
};

export const getMissingSchemaRequiredFieldsCountForSelectedBranch = (
  schema: Record<string, unknown>,
  formData?: Record<string, unknown>
): number => {
  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf)) {
    const branches = oneOf.filter(
      (branch): branch is Record<string, unknown> =>
        Boolean(branch) && typeof branch === 'object'
    );
    const dataKeys = Object.keys(formData ?? {}).filter(
      (k) => (formData as Record<string, unknown>)[k] !== undefined
    );
    if (dataKeys.length > 0) {
      const matchingBranch = branches.find((branch) => {
        const branchProps = new Set(
          Object.keys((branch.properties ?? {}) as Record<string, unknown>)
        );

        return dataKeys.every((k) => branchProps.has(k));
      });
      if (matchingBranch) {
        return getMissingSchemaRequiredFieldsCountForSelectedBranch(
          matchingBranch,
          formData
        );
      }
    }
    const counts = branches.map((branch) =>
      getMissingSchemaRequiredFieldsCountForSelectedBranch(branch, formData)
    );

    return counts.length > 0 ? Math.min(...counts) : 0;
  }

  const properties = (schema.properties ?? {}) as JsonObject;
  const requiredFields = getRequiredFields(schema);

  const requiredCount = requiredFields.reduce((count, key) => {
    const value = formData?.[key];
    const propertySchema = properties[key];

    if (!isFilledValue(value)) {
      return count + 1;
    }

    if (
      propertySchema &&
      typeof propertySchema === 'object' &&
      !Array.isArray(value) &&
      typeof value === 'object'
    ) {
      return (
        count +
        getMissingSchemaRequiredFieldsCountForSelectedBranch(
          propertySchema as Record<string, unknown>,
          value as Record<string, unknown>
        )
      );
    }

    return count;
  }, 0);

  const nestedCount = Object.keys(formData ?? {}).reduce((count, key) => {
    if (requiredFields.includes(key)) {
      return count;
    }
    const value = (formData as Record<string, unknown>)[key];
    const propertySchema = properties[key];

    if (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      propertySchema &&
      typeof propertySchema === 'object'
    ) {
      return (
        count +
        getMissingSchemaRequiredFieldsCountForSelectedBranch(
          propertySchema as Record<string, unknown>,
          value as Record<string, unknown>
        )
      );
    }

    return count;
  }, 0);

  return requiredCount + nestedCount;
};

export const hasMissingRequiredFlatCredential = (
  schema: Record<string, unknown>,
  formData: ConfigData
): boolean => {
  const properties = schema?.properties as JsonObject | undefined;
  if (!properties || properties[AUTH_PROPERTY_KEY]) {
    return false;
  }

  const credentialKeys = getFlatSecretKeys(schema).secretKeys.filter(
    (key) => !PASSPHRASE_RE.test(key)
  );

  return (
    credentialKeys.length > 0 &&
    credentialKeys.every(
      (key) =>
        !isFilledValue((formData as Record<string, unknown> | undefined)?.[key])
    )
  );
};

export const getMissingRequiredFieldsCount = (
  schema: Record<string, unknown>,
  formData: ConfigData
): number => {
  return getMissingSchemaRequiredFieldsCount(
    schema,
    formData as Record<string, unknown>
  );
};

/**
 * Connectors that predate the `authType` oneOf convention expose mutually
 * exclusive credentials as flat sibling secrets (e.g. Snowflake's `password`
 * vs `privateKey` + passphrase). To render the design's Password / Key pair
 * tabs without a schema migration, we synthesize an `authType` oneOf on the
 * client (Password branch = `password`; Key pair branch = the key + passphrase
 * secrets) and remove the flat fields. The stored config stays flat — see
 * {@link wrapFlatCredentialsIntoAuthType} / {@link flattenAuthTypeIntoConfig}.
 */
export const getSchemaWithSynthesizedAuthType = (
  schema: Record<string, unknown>,
  t: (key: string) => string
): Record<string, unknown> => {
  const properties = schema?.properties as JsonObject | undefined;
  const { secretKeys } = getFlatSecretKeys(schema);
  let result = schema;
  if (hasSynthesizableFlatAuth(schema) && properties) {
    const nextProperties: JsonObject = { ...properties };
    const keyPairKeys = secretKeys.filter((key) => key !== PASSWORD_KEY);
    const required = getRequiredFields(schema);
    const passwordBranch = {
      title: t('label.password'),
      type: 'object',
      properties: { [PASSWORD_KEY]: properties[PASSWORD_KEY] },
      required: [PASSWORD_KEY],
      additionalProperties: false,
    };
    const keyPairBranch = {
      title: t('label.key-pair'),
      type: 'object',
      properties: reduce(
        keyPairKeys,
        (acc, key) => ({ ...acc, [key]: properties[key] }),
        {} as Record<string, unknown>
      ),
      required: keyPairKeys.filter(
        (key) => PRIVATE_KEY_RE.test(key) && !PASSPHRASE_RE.test(key)
      ),
      additionalProperties: false,
    };
    secretKeys.forEach((key) => delete nextProperties[key]);
    nextProperties[AUTH_PROPERTY_KEY] = {
      title: AUTH_CONFIGURATION_TITLE,
      description: t('message.authentication-section-description'),
      oneOf: [passwordBranch, keyPairBranch],
    };
    result = {
      ...schema,
      properties: nextProperties,
      required: [
        ...required.filter((field) => !secretKeys.includes(field)),
        AUTH_PROPERTY_KEY,
      ],
    };
  }

  return result;
};

const keyByFilledValue = (
  source: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> =>
  keys.reduce((acc, key) => {
    if (isFilledValue(source[key])) {
      acc[key] = source[key];
    }

    return acc;
  }, {} as Record<string, unknown>);

const getFlatAuthTypeData = (
  authType: Record<string, unknown>,
  secretKeys: string[]
) => {
  const hasPrivateKeyCredential = secretKeys.some(
    (key) =>
      PRIVATE_KEY_RE.test(key) &&
      !PASSPHRASE_RE.test(key) &&
      isFilledValue(authType[key])
  );
  const password = authType[PASSWORD_KEY];

  if (hasPrivateKeyCredential) {
    return keyByFilledValue(
      authType,
      secretKeys.filter((key) => key !== PASSWORD_KEY)
    );
  }

  if (isFilledValue(password)) {
    return { [PASSWORD_KEY]: password };
  }

  return {};
};

/**
 * Moves flat secret values from a stored config into a nested `authType` object
 * so the synthesized oneOf field selects the right tab. No-op unless the schema
 * is a synthesized (flat password + privateKey) connector.
 */
export const wrapFlatCredentialsIntoAuthType = (
  config: ConfigData,
  schema: Record<string, unknown>
): ConfigData => {
  const { secretKeys } = getFlatSecretKeys(schema);
  let result = config;
  if (hasSynthesizableFlatAuth(schema)) {
    const next = { ...config } as Record<string, unknown>;
    const authType = getFlatAuthTypeData(next, secretKeys);

    secretKeys.forEach((key) => delete next[key]);
    next[AUTH_PROPERTY_KEY] = authType;
    result = next;
  }

  return result;
};

const resolveChildFieldSchema = (
  parent: Record<string, unknown>,
  fieldName: string
): Record<string, unknown> | undefined => {
  const props = parent.properties as
    | Record<string, Record<string, unknown>>
    | undefined;
  if (props?.[fieldName]) {
    return props[fieldName];
  }

  for (const combiner of ['oneOf', 'anyOf', 'allOf'] as const) {
    const branches = parent[combiner] as
      | Array<Record<string, unknown>>
      | undefined;
    for (const branch of branches ?? []) {
      const match = resolveChildFieldSchema(branch, fieldName);
      if (match) {
        return match;
      }
    }
  }

  return undefined;
};

/** Resolves the `{title, description}` schema metadata for an RJSF field id. */
export const getFieldSchemaForId = (
  schema: Record<string, unknown>,
  fieldId: string
): { title?: string; description?: string } | undefined => {
  const cleanId = fieldId.replace(/__(oneof|anyof|allof)_select$/, '');
  const parts = cleanId.split('/').filter((p) => p && p !== 'root');
  let current: Record<string, unknown> | undefined = schema;
  for (const part of parts) {
    current = resolveChildFieldSchema(current, part);
    if (!current) {
      return undefined;
    }
  }

  return {
    title: current.title as string | undefined,
    description: current.description as string | undefined,
  };
};

export type ConnectionFieldSection =
  | 'connection'
  | 'authentication'
  | 'scope'
  | 'advanced';

/**
 * Classifies a connection form field into the section it renders under
 * (Connection / Authentication / Scope & Options / Advanced Config) by
 * mirroring the grouping ConnectionObjectFieldTemplate derives for the same
 * schema, so callers that only have a field id (e.g. the docs side panel)
 * don't have to re-guess it from a static field-name list.
 */
export const getConnectionFieldSection = (
  schema: Record<string, unknown>,
  fieldId: string
): ConnectionFieldSection => {
  const cleanId = fieldId.replace(/__(oneof|anyof|allof)_select$/, '');
  const topLevelName = cleanId.split('/').filter((p) => p && p !== 'root')[0];
  const schemaProperties = (schema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const isAdvanced = (name: string) => ADVANCED_PROPERTIES.includes(name);
  const isAuth = (name: string) =>
    name === AUTH_PROPERTY_KEY || schemaProperties[name]?.format === 'password';

  let section: ConnectionFieldSection = 'connection';
  if (!topLevelName) {
    section = 'connection';
  } else if (isAdvanced(topLevelName)) {
    section = 'advanced';
  } else if (isAuth(topLevelName)) {
    section = 'authentication';
  } else {
    const requiredKeys = (schema.required as string[]) ?? [];
    const hasExplicitRequiredConnectionField = requiredKeys.some(
      (name) => !isAdvanced(name) && !isAuth(name)
    );
    const isConnection = hasExplicitRequiredConnectionField
      ? requiredKeys.includes(topLevelName) ||
        OPTIONAL_CONNECTION_PROPERTIES.has(topLevelName)
      : !OPTIONAL_SCOPE_PROPERTIES.has(topLevelName);
    section = isConnection ? 'connection' : 'scope';
  }

  return section;
};

export const flattenAuthTypeIntoConfig = (
  config?: ConfigData,
  schema?: Record<string, unknown>
) => {
  const authType = (config as Record<string, unknown>)?.[AUTH_PROPERTY_KEY];
  let result = config;
  if (
    hasSynthesizableFlatAuth(schema) &&
    authType &&
    typeof authType === 'object' &&
    !Array.isArray(authType)
  ) {
    const { secretKeys } = getFlatSecretKeys(schema);
    const { [AUTH_PROPERTY_KEY]: _omit, ...rest } = config as Record<
      string,
      unknown
    >;
    result = {
      ...rest,
      ...getFlatAuthTypeData(authType as Record<string, unknown>, secretKeys),
    };
  }

  return result;
};
