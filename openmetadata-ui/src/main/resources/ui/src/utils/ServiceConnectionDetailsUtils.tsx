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

import { InfoCircleOutlined } from '@ant-design/icons';
import { Col, Input, Row, Select, Space, Tooltip, Typography } from 'antd';
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
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
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

// Renders a basic input field with label and optional tooltip
const renderInputField = (
  key: string,
  value: string,
  description?: string,
  format?: string,
  title?: string
) => (
  <Col key={key} span={12}>
    <Row>
      <Col className="d-flex items-center" span={8}>
        <Space size={0}>
          <p className="text-grey-muted m-0">{key || title}:</p>
          {description && (
            <Tooltip placement="bottom" title={description} trigger="hover">
              <InfoCircleOutlined
                className="m-x-xss"
                style={{ color: '#C4C4C4' }}
              />
            </Tooltip>
          )}
        </Space>
      </Col>
      <Col span={16}>
        {isArray(value) ? (
          <Select
            allowClear={false}
            bordered={false}
            className="w-full border-none"
            data-testid="input-field"
            mode="multiple"
            open={false}
            removeIcon={null}
            style={{ pointerEvents: 'none' }}
            value={value}
          />
        ) : (
          <Input
            readOnly
            className="w-full border-none"
            data-testid="input-field"
            type={format === 'password' ? 'password' : 'text'}
            value={value}
          />
        )}
      </Col>
    </Row>
  </Col>
);

// Renders filter pattern fields
const renderFilterPattern = (
  key: string,
  value: { includes: string[]; excludes: string[] },
  description?: string,
  title?: string
) => {
  if (isEmpty(value.includes) && isEmpty(value.excludes)) {
    return null;
  }

  return (
    <Col key={key} span={12}>
      <Row>
        <Col className="d-flex" span={8}>
          <Space align="start" size={0}>
            <p className="text-grey-muted m-0">{key || title}:</p>
            {description && (
              <Tooltip placement="bottom" title={description} trigger="hover">
                <InfoCircleOutlined
                  className="m-x-xss"
                  style={{ color: '#C4C4C4' }}
                />
              </Tooltip>
            )}
          </Space>
        </Col>
        <Col className="filter-config" span={16}>
          {Object.entries(value).map(([key, value]) => {
            return isEmpty(value) ? null : (
              <div
                className="w-full flex flex-col"
                key={`${key}-${JSON.stringify(value)}`}>
                <Typography.Text className="key">{`${startCase(
                  key
                )}:`}</Typography.Text>
                <Typography.Text className="value">
                  {(value as string[]).join(', ')}
                </Typography.Text>
              </div>
            );
          })}
        </Col>
      </Row>
    </Col>
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
    if (!isObject(resolved)) {
      return current;
    }
    current = resolved as Record<string, unknown>;
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
  if (!isObject(schemaProperty) || depth >= MAX_SCHEMA_RESOLUTION_DEPTH) {
    return {};
  }

  const node = resolveRef(schemaProperty as Record<string, unknown>, schema);
  if (isObject(node.properties)) {
    return node.properties as Record<string, unknown>;
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

      // Handle non-object and array values
      if (!isObject(value) || isArray(value)) {
        const { description, format, title } = schemaPropertyObject[key] ?? {};

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
        const { description, title } = schemaPropertyObject[key] ?? {};

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
    return <ErrorPlaceHolder className="border-default border-radius-sm" />;
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
  value: unknown;
  schema: Record<string, unknown>;
  serviceCategory: string;
}): ReactNode => {
  const subSchema = schemaProperty.oneOf.find(
    (item: { title: string }) => item.title === title
  )?.properties;

  return (
    subSchema &&
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
  value: unknown,
  schemaPropertyObject: Record<string, unknown>,
  schema: Record<string, unknown>,
  serviceCategory: string
): ReactNode | null => {
  // Pipeline service - Airflow connection
  if (
    serviceType === EntityType.PIPELINE_SERVICE &&
    key === 'connection' &&
    value.type?.toLowerCase() === 'airflow'
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
  value: unknown,
  schemaPropertyObject: Record<string, unknown>,
  schema: Record<string, unknown>,
  serviceCategory: string
): ReactNode | null => {
  if (!isObject(value.securityConfig)) {
    return null;
  }

  if (value.securityConfig.gcpConfig) {
    const gcpConfigSchema = isObject(value.securityConfig.gcpConfig)
      ? get(
          schema,
          'definitions.GCPConfig.properties.securityConfig.definitions.GCPValues.properties',
          {}
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
      obj: isObject(value.securityConfig.gcpConfig)
        ? value.securityConfig.gcpConfig
        : value,
      schemaPropertyObject: gcpConfigSchema,
      schema,
      serviceCategory,
    });
  }

  const internalRef = '$ref';
  const oneOf = 'oneOf';

  if (
    Object.keys(schemaPropertyObject[key]).includes(oneOf) &&
    (value.securityConfig?.awsAccessKeyId ||
      value.securityConfig?.awsSecretAccessKey)
  ) {
    return getKeyValues({
      obj: value.securityConfig,
      schemaPropertyObject: get(
        schema,
        'definitions.S3Config.properties.securityConfig.properties',
        {}
      ),
      schema,
      serviceCategory,
    });
  }

  if (Object.keys(schemaPropertyObject[key]).includes(internalRef)) {
    const definition = schemaPropertyObject[key][internalRef]
      .split('/')
      .splice(2);

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
  value: unknown;
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
