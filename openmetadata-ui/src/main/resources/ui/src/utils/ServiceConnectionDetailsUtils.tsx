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
  obj: Record<string, unknown>;
  schemaPropertyObject: Record<string, unknown>;
  schema: Record<string, unknown>;
  serviceCategory: string;
};

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
                  {value.join(', ')}
                </Typography.Text>
              </div>
            );
          })}
        </Col>
      </Row>
    </Col>
  );
};

const handleSpecialServiceConfig = (
  serviceType: string,
  key: string,
  value: Record<string, unknown>,
  schemaPropertyObject: Record<string, unknown>,
  schema: Record<string, unknown>,
  serviceCategory: string
): ReactNode | null => {
  if (serviceType === EntityType.PIPELINE_SERVICE && key === 'connection') {
    const valueType = value.type;
    if (
      typeof valueType === 'string' &&
      valueType.toLowerCase() === 'airflow'
    ) {
      const airflowSchema = (
        schemaPropertyObject[key] as {
          oneOf: Array<{ title: string; properties?: Record<string, unknown> }>;
        }
      ).oneOf.find(
        (item: { title: string }) => item.title === `${valueType}Connection`
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
  }

  if (serviceType === EntityType.DATABASE_SERVICE && key === 'credentials') {
    const gcpSchema = (
      schemaPropertyObject[key] as {
        definitions: { gcpCredentialsPath: Record<string, unknown> };
      }
    ).definitions.gcpCredentialsPath;

    return getKeyValues({
      obj: value,
      schemaPropertyObject: gcpSchema,
      schema,
      serviceCategory,
    });
  }

  if (serviceType === EntityType.METADATA_SERVICE && key === 'securityConfig') {
    const jwtSchema = (
      schemaPropertyObject[key] as {
        oneOf: Array<{ title: string; properties?: Record<string, unknown> }>;
      }
    ).oneOf.find(
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

  if (
    serviceType === EntityType.DASHBOARD_SERVICE &&
    key === 'githubCredentials'
  ) {
    const githubSchema = (
      schemaPropertyObject[key] as {
        oneOf: Array<{ title: string; properties?: Record<string, unknown> }>;
      }
    ).oneOf.find(
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

const handleDatabaseConfigSource = (
  key: string,
  value: Record<string, unknown>,
  schemaPropertyObject: Record<string, unknown>,
  schema: Record<string, unknown>,
  serviceCategory: string
): ReactNode | null => {
  const securityConfig = value.securityConfig as Record<string, unknown>;
  if (!isObject(securityConfig)) {
    return null;
  }

  if (securityConfig.gcpConfig) {
    const gcpConfigSchema = isObject(securityConfig.gcpConfig)
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
      obj: isObject(securityConfig.gcpConfig)
        ? (securityConfig.gcpConfig as Record<string, unknown>)
        : value,
      schemaPropertyObject: gcpConfigSchema as Record<string, unknown>,
      schema,
      serviceCategory,
    });
  }

  const internalRef = '$ref';
  const oneOf = 'oneOf';

  if (
    Object.keys(schemaPropertyObject[key] as Record<string, unknown>).includes(
      oneOf
    ) &&
    (securityConfig?.awsAccessKeyId || securityConfig?.awsSecretAccessKey)
  ) {
    return getKeyValues({
      obj: securityConfig,
      schemaPropertyObject: get(
        schema,
        'definitions.S3Config.properties.securityConfig.properties',
        {}
      ) as Record<string, unknown>,
      schema,
      serviceCategory,
    });
  }

  if (
    Object.keys(schemaPropertyObject[key] as Record<string, unknown>).includes(
      internalRef
    )
  ) {
    const definition = (schemaPropertyObject[key] as { $ref: string }).$ref
      .split('/')
      .splice(2);

    return getKeyValues({
      obj: value,
      schemaPropertyObject: (
        schema as { definitions: Record<string, Record<string, unknown>> }
      ).definitions[definition.join('.')],
      schema,
      serviceCategory,
    });
  }

  return null;
};

export function getKeyValues({
  obj,
  schemaPropertyObject,
  schema,
  serviceCategory,
}: KeyValuesProps): ReactNode {
  try {
    return Object.keys(obj).map((key) => {
      const value = obj[key];

      if (isNull(value) || key in DEF_UI_SCHEMA) {
        return null;
      }

      if (!isObject(value) || isArray(value)) {
        const {
          description = '',
          format = '',
          title = '',
        } = (schemaPropertyObject[key] as {
          description?: string;
          format?: string;
          title?: string;
        }) ?? {};

        return renderInputField(
          key,
          value as string,
          description,
          format,
          title
        );
      }

      const serviceType = serviceCategory.slice(0, -1);
      const filterPatternFields =
        FILTER_PATTERN_BY_SERVICE_TYPE[
          serviceType as keyof typeof FILTER_PATTERN_BY_SERVICE_TYPE
        ] ?? [];

      if (
        filterPatternFields.includes(
          key as ServiceConnectionFilterPatternFields
        )
      ) {
        const { description, title } =
          (schemaPropertyObject[key] as {
            description?: string;
            title?: string;
          }) ?? {};

        return renderFilterPattern(
          key,
          value as { includes: string[]; excludes: string[] },
          description,
          title
        );
      }

      const specialConfig = handleSpecialServiceConfig(
        serviceType,
        key,
        value as Record<string, unknown>,
        schemaPropertyObject,
        schema,
        serviceCategory
      );
      if (specialConfig !== null) {
        return specialConfig;
      }

      if (
        serviceType === EntityType.DATABASE_SERVICE &&
        key === 'configSource'
      ) {
        const configSource = handleDatabaseConfigSource(
          key,
          value as Record<string, unknown>,
          schemaPropertyObject,
          schema,
          serviceCategory
        );
        if (configSource !== null) {
          return configSource;
        }
      }

      return getKeyValues({
        obj: value as Record<string, unknown>,
        schemaPropertyObject:
          (
            schemaPropertyObject[key] as {
              properties?: Record<string, unknown>;
            }
          )?.properties ?? {},
        schema,
        serviceCategory,
      });
    });
  } catch {
    return <ErrorPlaceHolder className="border-default border-radius-sm" />;
  }
}
