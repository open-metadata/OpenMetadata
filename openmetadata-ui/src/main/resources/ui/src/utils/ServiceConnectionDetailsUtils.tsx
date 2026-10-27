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
  Badge,
  Box,
  Input,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { InfoCircle } from '@openmetadata/ui-core-components/icons';
import {
  get,
  isArray,
  isEmpty,
  isNull,
  isObject,
  isString,
  startCase,
} from 'lodash';
import { ReactNode } from 'react';
import NoDataPlaceholder from '../components/common/EmptyPlaceholder/NoDataPlaceholder';
import { FILTER_PATTERN_BY_SERVICE_TYPE } from '../constants/ServiceConnection.constants';
import { DEF_UI_SCHEMA, JWT_CONFIG } from '../constants/Services.constant';
import { EntityType } from '../enums/entity.enum';
import { ServiceConnectionFilterPatternFields } from '../enums/ServiceConnection.enum';

type KeyValuesProps = {
  obj: Record<string, unknown>;
  schemaPropertyObject: Record<string, unknown>;
  schema: Record<string, unknown>;
  serviceCategory: string;
};

export const renderConnectionDetailLabel = (
  label = '',
  description?: string
) => (
  <Box align="center" className="tw:w-1/3 tw:shrink-0 tw:pr-2" gap={1}>
    <Typography className="tw:min-w-0 tw:break-all" color="secondary">
      {label}:
    </Typography>
    {description && (
      <Tooltip placement="bottom" title={description}>
        <InfoCircle className="tw:size-3.5 tw:text-fg-quaternary" />
      </Tooltip>
    )}
  </Box>
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getSchemaText = (
  property: unknown,
  key: 'description' | 'format' | 'title'
) => {
  if (!isRecord(property)) {
    return undefined;
  }
  const value = property[key];

  return typeof value === 'string' ? value : undefined;
};

const renderInputField = (
  key: string,
  value: unknown,
  description?: string,
  format?: string,
  title?: string
) => (
  <Box align="center" key={key}>
    {renderConnectionDetailLabel(key || title, description)}
    <Box className="tw:min-w-0 tw:flex-1">
      {isArray(value) ? (
        <Box data-testid="input-field" gap={1} wrap="wrap">
          {/* Repeated values are valid in connection arrays, so value alone is not a unique key. */}
          {value.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <Badge color="gray" key={`${item}-${index}`} size="sm" type="color">
              {String(item)}
            </Badge>
          ))}
        </Box>
      ) : (
        <Input
          isReadOnly
          aria-label={key || title}
          inputDataTestId="input-field"
          size="sm"
          type={format === 'password' ? 'password' : 'text'}
          value={String(value ?? '')}
        />
      )}
    </Box>
  </Box>
);

// Renders filter pattern fields
const renderFilterPattern = (
  key: string,
  value: Record<string, unknown>,
  description?: string,
  title?: string
) => {
  if (isEmpty(value.includes) && isEmpty(value.excludes)) {
    return null;
  }

  return (
    <Box align="start" key={key}>
      {renderConnectionDetailLabel(key || title, description)}
      <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={2}>
        {Object.entries(value).map(([patternKey, patternValue]) =>
          isEmpty(patternValue) ? null : (
            <Box
              direction="col"
              key={`${patternKey}-${JSON.stringify(patternValue)}`}>
              <Typography color="secondary">{`${startCase(
                patternKey
              )}:`}</Typography>
              <Typography weight="semibold">
                {Array.isArray(patternValue)
                  ? patternValue.join(', ')
                  : String(patternValue)}
              </Typography>
            </Box>
          )
        )}
      </Box>
    </Box>
  );
};

const MAX_SCHEMA_RESOLUTION_DEPTH = 10;

// Follows a local `#/definitions/...` pointer, as deep as the schema chains them.
const resolveRef = (
  node: Record<string, unknown>,
  schema: Record<string, unknown>
): Record<string, unknown> => {
  let current = node;
  for (let depth = 0; depth < MAX_SCHEMA_RESOLUTION_DEPTH; depth++) {
    const ref = current?.$ref;
    if (!isString(ref) || !ref.startsWith('#/')) {
      return current;
    }
    const resolved = get(schema, ref.slice(2).split('/'));
    if (!isRecord(resolved)) {
      return current;
    }
    current = resolved;
  }

  return current;
};

/**
 * Resolves the `properties` of a nested config, walking `$ref` and `oneOf`/`anyOf`.
 *
 * Many connectors keep their credentials inside a `oneOf` branch -- SFTP `authType`, every
 * `sslConfig`, the Alation/Databricks/OpenSearch auth types. Reading `schemaProperty.properties`
 * alone yields `{}` for those, which drops the `format: password` marker and renders the secret
 * as a readable text input. Branches are merged so a secret declared in any branch stays masked,
 * with the branch matching the stored value last so it wins on the fields it shares.
 */
export const getSchemaProperties = (
  schemaProperty: unknown,
  value: unknown,
  schema: Record<string, unknown>,
  depth = 0
): Record<string, unknown> => {
  if (!isRecord(schemaProperty) || depth >= MAX_SCHEMA_RESOLUTION_DEPTH) {
    return {};
  }

  const node = resolveRef(schemaProperty, schema);
  if (isRecord(node.properties)) {
    return node.properties;
  }

  const branches = node.oneOf ?? node.anyOf;
  if (!isArray(branches)) {
    return {};
  }

  const valueKeys = isObject(value) ? Object.keys(value) : [];
  let merged: Record<string, unknown> = {};
  let bestMatch: Record<string, unknown> = {};
  let bestScore = 0;

  branches.forEach((branch) => {
    const properties = getSchemaProperties(branch, value, schema, depth + 1);
    merged = { ...properties, ...merged };
    const score = valueKeys.filter((key) => key in properties).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = properties;
    }
  });

  return { ...merged, ...bestMatch };
};

export const getKeyValues = ({
  obj,
  schemaPropertyObject,
  schema,
  serviceCategory,
}: KeyValuesProps): ReactNode => {
  try {
    return Object.keys(obj).map((key) => {
      const value = obj[key];

      // Return early if value is null or key is in DEF_UI_SCHEMA
      if (isNull(value) || key in DEF_UI_SCHEMA) {
        return null;
      }

      const property = schemaPropertyObject[key];
      const description = getSchemaText(property, 'description');
      const format = getSchemaText(property, 'format');
      const title = getSchemaText(property, 'title');

      // Handle non-object and array values
      if (!isRecord(value)) {
        return renderInputField(key, value, description, format, title);
      }

      const serviceType = serviceCategory.slice(0, -1);
      const filterPatternFields =
        FILTER_PATTERN_BY_SERVICE_TYPE[
          serviceType as keyof typeof FILTER_PATTERN_BY_SERVICE_TYPE
        ] ?? [];

      // Handle filter pattern fields
      if (
        filterPatternFields.includes(
          key as ServiceConnectionFilterPatternFields
        )
      ) {
        return renderFilterPattern(key, value, description, title);
      }

      // Handle special, database, and default object configurations
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- mutually recursive with getKeyValues
      return getNestedConfigValue({
        serviceType,
        key,
        value,
        schemaPropertyObject,
        schema,
        serviceCategory,
      });
    });
  } catch {
    return (
      <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
        <NoDataPlaceholder data-testid="no-data-placeholder" />
      </div>
    );
  }
};

// Resolves a `oneOf` sub-schema by title and renders its key/values
const renderOneOfSchema = ({
  schemaProperty,
  title,
  value,
  schema,
  serviceCategory,
}: {
  schemaProperty: unknown;
  title: string;
  value: Record<string, unknown>;
  schema: Record<string, unknown>;
  serviceCategory: string;
}): ReactNode => {
  if (!isRecord(schemaProperty) || !Array.isArray(schemaProperty.oneOf)) {
    return null;
  }

  const branch = schemaProperty.oneOf.find(
    (item) => isRecord(item) && item.title === title
  );
  const subSchema = isRecord(branch) ? branch.properties : undefined;

  return (
    isRecord(subSchema) &&
    getKeyValues({
      obj: value,
      schemaPropertyObject: subSchema,
      schema,
      serviceCategory,
    })
  );
};

// Handles special service type configurations
const handleSpecialServiceConfig = (
  serviceType: string,
  key: string,
  value: Record<string, unknown>,
  schemaPropertyObject: Record<string, unknown>,
  schema: Record<string, unknown>,
  serviceCategory: string
): ReactNode | null => {
  // Pipeline service - Airflow connection
  if (
    serviceType === EntityType.PIPELINE_SERVICE &&
    key === 'connection' &&
    typeof value.type === 'string' &&
    value.type.toLowerCase() === 'airflow'
  ) {
    return renderOneOfSchema({
      schemaProperty: schemaPropertyObject[key],
      title: `${value.type}Connection`,
      value,
      schema,
      serviceCategory,
    });
  }

  // Metadata service - Security config
  if (serviceType === EntityType.METADATA_SERVICE && key === 'securityConfig') {
    return renderOneOfSchema({
      schemaProperty: schemaPropertyObject[key],
      title: JWT_CONFIG,
      value,
      schema,
      serviceCategory,
    });
  }

  // Dashboard service - GitHub credentials
  if (
    serviceType === EntityType.DASHBOARD_SERVICE &&
    key === 'githubCredentials'
  ) {
    return renderOneOfSchema({
      schemaProperty: schemaPropertyObject[key],
      title: 'GitHubCredentials',
      value,
      schema,
      serviceCategory,
    });
  }

  return null;
};

// Handles database service config source
const handleDatabaseConfigSource = (
  key: string,
  value: Record<string, unknown>,
  schemaPropertyObject: Record<string, unknown>,
  schema: Record<string, unknown>,
  serviceCategory: string
): ReactNode | null => {
  const securityConfig = value.securityConfig;
  if (!isRecord(securityConfig)) {
    return null;
  }

  if (securityConfig.gcpConfig) {
    const gcpConfigSchema = isRecord(securityConfig.gcpConfig)
      ? getSchemaProperties(
          get(
            schema,
            'definitions.GCPConfig.properties.securityConfig.definitions.GCPValues'
          ),
          securityConfig.gcpConfig,
          schema
        )
      : getSchemaProperties(
          get(
            schema,
            'definitions.GCPConfig.properties.securityConfig.definitions.gcpCredentialsPath'
          ),
          value,
          schema
        );

    return getKeyValues({
      obj: isRecord(securityConfig.gcpConfig)
        ? securityConfig.gcpConfig
        : value,
      schemaPropertyObject: gcpConfigSchema,
      schema,
      serviceCategory,
    });
  }

  const schemaProperty = schemaPropertyObject[key];
  if (!isRecord(schemaProperty)) {
    return null;
  }

  if (
    'oneOf' in schemaProperty &&
    (securityConfig.awsAccessKeyId || securityConfig.awsSecretAccessKey)
  ) {
    return getKeyValues({
      obj: securityConfig,
      schemaPropertyObject: getSchemaProperties(
        get(schema, 'definitions.S3Config.properties.securityConfig'),
        securityConfig,
        schema
      ),
      schema,
      serviceCategory,
    });
  }

  if (typeof schemaProperty.$ref === 'string') {
    const definition = schemaProperty.$ref.split('/').splice(2);

    return getKeyValues({
      obj: value,
      schemaPropertyObject: getSchemaProperties(
        get(schema, ['definitions', String(definition)]),
        value,
        schema
      ),
      schema,
      serviceCategory,
    });
  }

  return null;
};

// Resolves special, database, or default object configurations for a key
const getNestedConfigValue = ({
  serviceType,
  key,
  value,
  schemaPropertyObject,
  schema,
  serviceCategory,
}: {
  serviceType: string;
  key: string;
  value: Record<string, unknown>;
  schemaPropertyObject: Record<string, unknown>;
  schema: Record<string, unknown>;
  serviceCategory: string;
}): ReactNode => {
  const specialConfig = handleSpecialServiceConfig(
    serviceType,
    key,
    value,
    schemaPropertyObject,
    schema,
    serviceCategory
  );
  if (specialConfig !== null) {
    return specialConfig;
  }

  if (serviceType === EntityType.DATABASE_SERVICE && key === 'configSource') {
    const configSource = handleDatabaseConfigSource(
      key,
      value,
      schemaPropertyObject,
      schema,
      serviceCategory
    );
    if (configSource !== null) {
      return configSource;
    }
  }

  return getKeyValues({
    obj: value,
    schemaPropertyObject: getSchemaProperties(
      schemaPropertyObject[key],
      value,
      schema
    ),
    schema,
    serviceCategory,
  });
};
