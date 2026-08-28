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
import { get, isEmpty, isNull, isObject, startCase } from 'lodash';
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
  schemaContext?: Record<string, unknown>;
};

type SchemaObject = Record<string, unknown>;
type RenderableValue = string | number | boolean | unknown[] | undefined;

const isSchemaObject = (value: unknown): value is SchemaObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getSchemaObject = (value: unknown): SchemaObject | undefined =>
  isSchemaObject(value) ? value : undefined;

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const isRenderableValue = (value: unknown): value is RenderableValue => {
  if (value === undefined || Array.isArray(value)) {
    return true;
  }

  const valueType = typeof value;

  return (
    valueType === 'string' || valueType === 'number' || valueType === 'boolean'
  );
};

const isFilterPatternValue = (
  value: SchemaObject
): value is { includes: string[]; excludes: string[] } =>
  Array.isArray(value.includes) &&
  value.includes.every((item) => typeof item === 'string') &&
  Array.isArray(value.excludes) &&
  value.excludes.every((item) => typeof item === 'string');

const getJsonPointerValue = (
  schemaObject: SchemaObject,
  reference: string
): unknown => {
  if (reference === '#') {
    return schemaObject;
  }

  if (!reference.startsWith('#/')) {
    return undefined;
  }

  return reference
    .slice(2)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((current, part) => {
      if (isSchemaObject(current)) {
        return current[part];
      }

      if (Array.isArray(current)) {
        const index = Number(part);

        return Number.isInteger(index) ? current[index] : undefined;
      }

      return undefined;
    }, schemaObject);
};

const resolveSchemaReference = (
  schemaObject: unknown,
  referenceScopes: SchemaObject[]
): SchemaObject | undefined => {
  if (!isSchemaObject(schemaObject)) {
    return undefined;
  }

  let resolvedSchema = schemaObject;
  const visitedReferences = new Set<string>();

  while (true) {
    const reference = getString(resolvedSchema.$ref);

    if (!reference || visitedReferences.has(reference)) {
      return resolvedSchema;
    }

    visitedReferences.add(reference);

    const referencedSchema = referenceScopes
      .map((scope) => getJsonPointerValue(scope, reference))
      .find(isSchemaObject);

    if (!referencedSchema) {
      return resolvedSchema;
    }

    const schemaWithReferenceRemoved = { ...resolvedSchema };
    delete schemaWithReferenceRemoved.$ref;
    resolvedSchema = {
      ...referencedSchema,
      ...schemaWithReferenceRemoved,
    };
  }
};

const getSchemaObjects = (value: unknown): SchemaObject[] =>
  Array.isArray(value) ? value.filter(isSchemaObject) : [];

const matchesOneOfSchema = (
  schemaObject: SchemaObject,
  value: SchemaObject
): boolean => {
  const properties = getSchemaObject(schemaObject.properties);

  if (!properties) {
    return false;
  }

  return Object.entries(properties).some(([key, property]) => {
    if (!(key in value)) {
      return false;
    }

    const propertySchema = getSchemaObject(property);

    if (!propertySchema) {
      return false;
    }

    if ('const' in propertySchema) {
      return propertySchema.const === value[key];
    }

    const enumValues = propertySchema.enum;

    return (
      Array.isArray(enumValues) &&
      enumValues.length === 1 &&
      enumValues[0] === value[key]
    );
  });
};

const getMatchingOneOfSchema = (
  value: unknown,
  oneOf: SchemaObject[],
  referenceScopes: SchemaObject[]
): SchemaObject | undefined => {
  const valueObject = getSchemaObject(value);

  if (!valueObject) {
    return undefined;
  }

  const resolvedSchemas = oneOf
    .map((schemaObject) =>
      resolveSchemaReference(schemaObject, referenceScopes)
    )
    .filter((schemaObject): schemaObject is SchemaObject =>
      Boolean(schemaObject)
    );

  return (
    resolvedSchemas.find((schemaObject) =>
      matchesOneOfSchema(schemaObject, valueObject)
    ) ?? (resolvedSchemas.length === 1 ? resolvedSchemas[0] : undefined)
  );
};

// Renders a basic input field with label and optional tooltip
const renderInputField = (
  key: string,
  value: RenderableValue,
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
        {Array.isArray(value) ? (
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
            value={typeof value === 'boolean' ? String(value) : value}
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

export const getKeyValues = ({
  obj,
  schemaPropertyObject,
  schema,
  serviceCategory,
  schemaContext = schema,
}: KeyValuesProps): ReactNode => {
  try {
    return Object.keys(obj).map((key) => {
      const value = obj[key];

      // Return early if value is null or key is in DEF_UI_SCHEMA
      if (isNull(value) || key in DEF_UI_SCHEMA) {
        return null;
      }

      // Handle non-object and array values
      if (!isSchemaObject(value)) {
        const schemaProperty = resolveSchemaReference(
          schemaPropertyObject[key],
          [schemaContext, schema]
        );

        if (!isRenderableValue(value)) {
          return null;
        }

        return renderInputField(
          key,
          value,
          getString(schemaProperty?.description),
          getString(schemaProperty?.format),
          getString(schemaProperty?.title)
        );
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
        ) &&
        isFilterPatternValue(value)
      ) {
        const schemaProperty = resolveSchemaReference(
          schemaPropertyObject[key],
          [schemaContext, schema]
        );

        return renderFilterPattern(
          key,
          value,
          getString(schemaProperty?.description),
          getString(schemaProperty?.title)
        );
      }

      // Handle special service configurations
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- mutually recursive with getKeyValues
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

      // Handle database config source
      if (
        serviceType === EntityType.DATABASE_SERVICE &&
        key === 'configSource'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- mutually recursive with getKeyValues
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

      const schemaProperty = resolveSchemaReference(schemaPropertyObject[key], [
        schemaContext,
        schema,
      ]);
      const childOneOf = getSchemaObjects(schemaProperty?.oneOf);

      if (childOneOf.length > 0) {
        const selectedOneOfSchema = getMatchingOneOfSchema(value, childOneOf, [
          schemaContext,
          schemaProperty ?? {},
          schema,
        ]);
        const selectedProperties = getSchemaObject(
          selectedOneOfSchema?.properties
        );

        return selectedProperties
          ? getKeyValues({
              obj: value,
              schemaPropertyObject: selectedProperties,
              schema,
              serviceCategory,
              schemaContext: selectedOneOfSchema,
            })
          : null;
      }

      const childProperties = getSchemaObject(schemaProperty?.properties);

      if (childProperties) {
        return getKeyValues({
          obj: value,
          schemaPropertyObject: childProperties,
          schema,
          serviceCategory,
          schemaContext: schemaProperty,
        });
      }

      return getKeyValues({
        obj: value,
        schemaPropertyObject: {},
        schema,
        serviceCategory,
        schemaContext,
      });
    });
  } catch {
    return <ErrorPlaceHolder className="border-default border-radius-sm" />;
  }
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
    const airflowSchema = schemaPropertyObject[key].oneOf.find(
      (item: { title: string }) => item.title === `${value.type}Connection`
    )?.properties;

    return (
      airflowSchema &&
      getKeyValues({
        obj: value,
        schemaPropertyObject: airflowSchema,
        schema,
        serviceCategory,
      })
    );
  }

  // Database service - GCP credentials
  if (serviceType === EntityType.DATABASE_SERVICE && key === 'credentials') {
    const gcpSchema = schemaPropertyObject[key].definitions.gcpCredentialsPath;

    return getKeyValues({
      obj: value,
      schemaPropertyObject: gcpSchema,
      schema,
      serviceCategory,
    });
  }

  // Metadata service - Security config
  if (serviceType === EntityType.METADATA_SERVICE && key === 'securityConfig') {
    const jwtSchema = schemaPropertyObject[key].oneOf.find(
      (item: { title: string }) => item.title === JWT_CONFIG
    )?.properties;

    return (
      jwtSchema &&
      getKeyValues({
        obj: value,
        schemaPropertyObject: jwtSchema,
        schema,
        serviceCategory,
      })
    );
  }

  // Dashboard service - GitHub credentials
  if (
    serviceType === EntityType.DASHBOARD_SERVICE &&
    key === 'githubCredentials'
  ) {
    const githubSchema = schemaPropertyObject[key].oneOf.find(
      (item: { title: string }) => item.title === 'GitHubCredentials'
    )?.properties;

    return (
      githubSchema &&
      getKeyValues({
        obj: value,
        schemaPropertyObject: githubSchema,
        schema,
        serviceCategory,
      })
    );
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
      : get(
          schema,
          'definitions.GCPConfig.properties.securityConfig.definitions.gcpCredentialsPath',
          {}
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
      schemaPropertyObject: schema.definitions[definition],
      schema,
      serviceCategory,
    });
  }

  return null;
};
