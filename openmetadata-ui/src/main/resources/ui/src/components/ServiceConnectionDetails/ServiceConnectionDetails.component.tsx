/*
 *  Copyright 2022 Collate.
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
import { Card, Tooltip } from 'antd';
import { ObjectStoreServiceType } from 'generated/entity/services/objectstoreService';
import { get, isEmpty, isNull, isObject } from 'lodash';
import React, { ReactNode, useEffect, useState } from 'react';
import { getStorageServiceConfig } from 'utils/ObjectStoreServiceUtils';
import { DEF_UI_SCHEMA, JWT_CONFIG } from '../../constants/Services.constant';
import { EntityType } from '../../enums/entity.enum';
import { DashboardServiceType } from '../../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../../generated/entity/services/databaseService';
import { MessagingServiceType } from '../../generated/entity/services/messagingService';
import { MetadataServiceType } from '../../generated/entity/services/metadataService';
import { MlModelServiceType } from '../../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../../generated/entity/services/pipelineService';
import { ConfigData } from '../../interface/service.interface';
import { getDashboardConfig } from '../../utils/DashboardServiceUtils';
import { getDatabaseConfig } from '../../utils/DatabaseServiceUtils';
import { getMessagingConfig } from '../../utils/MessagingServiceUtils';
import { getMetadataConfig } from '../../utils/MetadataServiceUtils';
import { getMlmodelConfig } from '../../utils/MlmodelServiceUtils';
import { getPipelineConfig } from '../../utils/PipelineServiceUtils';

type ServiceConnectionDetailsProps = {
  connectionDetails: ConfigData;
  serviceCategory: string;
  serviceFQN: string;
};

const ServiceConnectionDetails = ({
  connectionDetails,
  serviceCategory,
  serviceFQN,
}: ServiceConnectionDetailsProps) => {
  const [schema, setSchema] = useState({});
  const [data, setData] = useState<ReactNode>();

  const getKeyValues = (
    obj: object,
    schemaPropertyObject: object
  ): ReactNode => {
    const internalRef = '$ref';
    const oneOf = 'oneOf';

    return Object.keys(obj).map((key) => {
      const value = obj[key];

      if (isObject(value)) {
        if (
          serviceCategory.slice(0, -1) === EntityType.PIPELINE_SERVICE &&
          key === 'connection'
        ) {
          const newSchemaPropertyObject = schemaPropertyObject[
            key
          ].oneOf.filter((item) => item.title === `${value.type}Connection`)[0]
            .properties;

          return getKeyValues(value, newSchemaPropertyObject);
        } else if (
          serviceCategory.slice(0, -1) === EntityType.DATABASE_SERVICE &&
          key === 'credentials'
        ) {
          // Condition for GCS Credentials path
          const newSchemaPropertyObject =
            schemaPropertyObject[key].definitions.GCSCredentialsPath;

          return getKeyValues(value, newSchemaPropertyObject);
        } else if (
          serviceCategory.slice(0, -1) === EntityType.DATABASE_SERVICE &&
          key === 'configSource'
        ) {
          if (isObject(value.securityConfig)) {
            if (!value.securityConfig.gcsConfig) {
              if (Object.keys(schemaPropertyObject[key]).includes(oneOf)) {
                if (
                  value.securityConfig?.awsAccessKeyId ||
                  value.securityConfig?.awsSecretAccessKey
                ) {
                  return getKeyValues(
                    value.securityConfig,
                    get(
                      schema,
                      'definitions.S3Config.properties.securityConfig.properties',
                      {}
                    )
                  );
                }
              } else if (
                Object.keys(schemaPropertyObject[key]).includes(internalRef)
              ) {
                const definition = schemaPropertyObject[key][internalRef]
                  .split('/')
                  .splice(2);

                const newSchemaPropertyObject = schema.definitions[definition];

                return getKeyValues(value, newSchemaPropertyObject);
              }
            } else {
              if (isObject(value.securityConfig.gcsConfig)) {
                // Condition for GCS Credentials value
                return getKeyValues(
                  value.securityConfig.gcsConfig,
                  get(
                    schema,
                    'definitions.GCSConfig.properties.securityConfig.definitions.GCSValues.properties',
                    {}
                  )
                );
              } else {
                // Condition for GCS Credentials path

                return getKeyValues(
                  value,
                  get(
                    schema,
                    'definitions.GCSConfig.properties.securityConfig.definitions.GCSCredentialsPath',
                    {}
                  )
                );
              }
            }
          }
        } else if (
          serviceCategory.slice(0, -1) === EntityType.METADATA_SERVICE &&
          key === 'securityConfig'
        ) {
          const newSchemaPropertyObject = schemaPropertyObject[
            key
          ].oneOf.filter((item) => item.title === JWT_CONFIG)[0].properties;

          return getKeyValues(value, newSchemaPropertyObject);
        } else {
          return getKeyValues(
            value,
            schemaPropertyObject[key] && schemaPropertyObject[key].properties
              ? schemaPropertyObject[key].properties
              : {}
          );
        }
      } else if (!(key in DEF_UI_SCHEMA) && !isNull(value)) {
        const { description, format, title } = schemaPropertyObject[key]
          ? schemaPropertyObject[key]
          : {};

        return (
          <div className="tw-w-1/2 tw-flex tw-nowrap tw-mb-3" key={key}>
            <div className="tw-flex">
              <p className="tw-text-gray-500 tw-m-0">{title || key}:</p>
              <Tooltip position="bottom" title={description} trigger="hover">
                <InfoCircleOutlined
                  className="tw-mx-1"
                  style={{ color: 'C4C4C4' }}
                />
              </Tooltip>
            </div>
            <div className="tw-mx-3 tw-flex-1">
              <input
                readOnly
                className="tw-w-full tw-outline-none"
                type={format !== 'password' ? 'text' : 'password'}
                value={value}
              />
            </div>
          </div>
        );
      } else {
        return null;
      }
    });
  };

  useEffect(() => {
    switch (serviceCategory.slice(0, -1)) {
      case EntityType.DATABASE_SERVICE:
        setSchema(getDatabaseConfig(serviceFQN as DatabaseServiceType).schema);

        break;
      case EntityType.DASHBOARD_SERVICE:
        setSchema(
          getDashboardConfig(serviceFQN as DashboardServiceType).schema
        );

        break;
      case EntityType.MESSAGING_SERVICE:
        setSchema(
          getMessagingConfig(serviceFQN as MessagingServiceType).schema
        );

        break;
      case EntityType.PIPELINE_SERVICE:
        setSchema(getPipelineConfig(serviceFQN as PipelineServiceType).schema);

        break;
      case EntityType.MLMODEL_SERVICE:
        setSchema(getMlmodelConfig(serviceFQN as MlModelServiceType).schema);

        break;
      case EntityType.METADATA_SERVICE:
        setSchema(getMetadataConfig(serviceFQN as MetadataServiceType).schema);

        break;
      case EntityType.STORAGE_SERVICE:
        setSchema(
          getStorageServiceConfig(serviceFQN as ObjectStoreServiceType).schema
        );
    }
  }, [serviceCategory, serviceFQN]);

  useEffect(() => {
    if (!isEmpty(schema)) {
      setData(getKeyValues(connectionDetails, schema.properties));
    }
  }, [schema]);

  return (
    <Card>
      <div
        className="d-flex flex-wrap p-xss"
        data-testid="service-connection-details">
        {data}
      </div>
    </Card>
  );
};

export default ServiceConnectionDetails;
