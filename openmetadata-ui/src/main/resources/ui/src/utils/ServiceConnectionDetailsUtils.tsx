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
import { get, isArray, isEmpty, isNull, isObject, startCase } from 'lodash';
import { ReactNode } from 'react';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { FILTER_PATTERN_BY_SERVICE_TYPE } from '../constants/ServiceConnection.constants';
import { DEF_UI_SCHEMA, JWT_CONFIG } from '../constants/Services.constant';
import { EntityType } from '../enums/entity.enum';
import { ServiceConnectionFilterPatternFields } from '../enums/ServiceConnection.enum';

type KeyValuesProps = {
  obj: Record<string, any>;
  schemaPropertyObject: Record<string, any>;
  schema: Record<string, any>;
  serviceCategory: string;
};

// Renders a basic input field with label and optional tooltip
const renderInputField = (
  key: string,
  value: any,
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
  value: any,
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

// Handles special service type configurations
const handleSpecialServiceConfig = (
  serviceType: string,
  key: string,
  value: any,
  schemaPropertyObject: Record<string, any>,
  schema: Record<string, any>,
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
  value: any,
  schemaPropertyObject: Record<string, any>,
  schema: Record<string, any>,
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

      // Handle special service configurations
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

      // Default object handling
      return getKeyValues({
        obj: value,
        schemaPropertyObject: schemaPropertyObject[key]?.properties ?? {},
        schema,
        serviceCategory,
      });
    });
  } catch {
    return <ErrorPlaceHolder className="border-default border-radius-sm" />;
  }
};
