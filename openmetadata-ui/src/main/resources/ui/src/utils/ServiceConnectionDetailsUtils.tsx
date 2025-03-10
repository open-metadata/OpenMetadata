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

/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { InfoCircleOutlined } from '@ant-design/icons';
import { Col, Input, Row, Space, Tooltip, Typography } from 'antd';
import { get, isEmpty, isNull, isObject, startCase } from 'lodash';
import React, { ReactNode } from 'react';
import ErrorPlaceHolder from '../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { FILTER_PATTERN_BY_SERVICE_TYPE } from '../constants/ServiceConnection.constants';
import { DEF_UI_SCHEMA, JWT_CONFIG } from '../constants/Services.constant';
import { EntityType } from '../enums/entity.enum';
import { ServiceConnectionFilterPatternFields } from '../enums/ServiceConnection.enum';

export const getKeyValues = ({
  obj,
  schemaPropertyObject,
  schema,
  serviceCategory,
}: {
  obj: Record<string, any>;
  schemaPropertyObject: Record<string, any>;
  schema: Record<string, any>;
  serviceCategory: string;
}): ReactNode => {
  try {
    const internalRef = '$ref';
    const oneOf = 'oneOf';

    return Object.keys(obj).map((key) => {
      const value = obj[key];

      // Return early if value is null or key is in DEF_UI_SCHEMA
      if (isNull(value) || key in DEF_UI_SCHEMA) {
        return null;
      }

      // Handle non-object values
      if (!isObject(value)) {
        const { description, format, title } = schemaPropertyObject[key] || {};

        return (
          <Col key={key} span={12}>
            <Row>
              <Col className="d-flex items-center" span={8}>
                <Space size={0}>
                  <p className="text-grey-muted m-0">{key || title}:</p>
                  {description && (
                    <Tooltip
                      placement="bottom"
                      title={description}
                      trigger="hover">
                      <InfoCircleOutlined
                        className="m-x-xss"
                        style={{ color: '#C4C4C4' }}
                      />
                    </Tooltip>
                  )}
                </Space>
              </Col>
              <Col span={16}>
                <Input
                  readOnly
                  className="w-full border-none"
                  data-testid="input-field"
                  type={format === 'password' ? 'password' : 'text'}
                  value={value}
                />
              </Col>
            </Row>
          </Col>
        );
      }
      // Handle special cases for different service types
      const serviceType = serviceCategory.slice(0, -1);

      // Get the filter pattern fields for the service type
      const filterPatternFields =
        FILTER_PATTERN_BY_SERVICE_TYPE[serviceType] ?? [];

      if (
        filterPatternFields.includes(
          key as ServiceConnectionFilterPatternFields
        )
      ) {
        const { description, title } = schemaPropertyObject[key] || {};

        const isIncludeAndExcludeEmpty =
          isEmpty(value.includes) && isEmpty(value.excludes);

        if (isIncludeAndExcludeEmpty) {
          return null;
        }

        return (
          <Col key={key} span={12}>
            <Row>
              <Col className="d-flex" span={8}>
                <Space align="start" size={0}>
                  <p className="text-grey-muted m-0">{key || title}:</p>
                  {description && (
                    <Tooltip
                      placement="bottom"
                      title={description}
                      trigger="hover">
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
                      <Typography.Text className="key">
                        {`${startCase(key)}:`}
                      </Typography.Text>
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
      }

      // Pipeline service - Airflow connection
      if (
        serviceType === EntityType.PIPELINE_SERVICE &&
        key === 'connection' &&
        value.type?.toLowerCase() === 'airflow'
      ) {
        const airflowSchema = schemaPropertyObject[key].oneOf.find(
          (item) => item.title === `${value.type}Connection`
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
      if (
        serviceType === EntityType.DATABASE_SERVICE &&
        key === 'credentials'
      ) {
        const gcpSchema =
          schemaPropertyObject[key].definitions.gcpCredentialsPath;

        return getKeyValues({
          obj: value,
          schemaPropertyObject: gcpSchema,
          schema,
          serviceCategory,
        });
      }

      // Database service - Config source
      if (
        serviceType === EntityType.DATABASE_SERVICE &&
        key === 'configSource' &&
        isObject(value.securityConfig)
      ) {
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
      }

      // Metadata service - Security config
      if (
        serviceType === EntityType.METADATA_SERVICE &&
        key === 'securityConfig'
      ) {
        const jwtSchema = schemaPropertyObject[key].oneOf.find(
          (item) => item.title === JWT_CONFIG
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
          (item) => item.title === 'GitHubCredentials'
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

      // Default object handling
      return getKeyValues({
        obj: value,
        schemaPropertyObject: schemaPropertyObject[key]?.properties || {},
        schema,
        serviceCategory,
      });
    });
  } catch {
    return <ErrorPlaceHolder />;
  }
};
