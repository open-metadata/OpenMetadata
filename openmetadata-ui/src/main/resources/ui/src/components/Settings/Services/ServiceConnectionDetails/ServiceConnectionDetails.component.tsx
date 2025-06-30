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

import { InfoCircleOutlined } from '@ant-design/icons';
import { Col, Input, Row, Space, Tooltip } from 'antd';
import { isEmpty } from 'lodash';
import { ReactNode, useEffect, useState } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { APIServiceType } from '../../../../generated/entity/services/apiService';
import { DashboardServiceType } from '../../../../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../../../../generated/entity/services/databaseService';
import { MessagingServiceType } from '../../../../generated/entity/services/messagingService';
import { MetadataServiceType } from '../../../../generated/entity/services/metadataService';
import { MlModelServiceType } from '../../../../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../../../../generated/entity/services/pipelineService';
import { SearchServiceType } from '../../../../generated/entity/services/searchService';
import { StorageServiceType } from '../../../../generated/entity/services/storageService';
import {
  ConfigData,
  ExtraInfoType,
} from '../../../../interface/service.interface';
import { getKeyValues } from '../../../../utils/ServiceConnectionDetailsUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import './service-connection-details.less';

type ServiceConnectionDetailsProps = {
  connectionDetails: ConfigData;
  serviceCategory: string;
  serviceFQN: string;
  extraInfo?: ExtraInfoType | null;
};

const ServiceConnectionDetails = ({
  connectionDetails,
  serviceCategory,
  serviceFQN,
  extraInfo,
}: Readonly<ServiceConnectionDetailsProps>) => {
  const [schema, setSchema] = useState<Record<string, any>>({});
  const [data, setData] = useState<ReactNode>();

  useEffect(() => {
    switch (serviceCategory.slice(0, -1)) {
      case EntityType.DATABASE_SERVICE:
        setSchema(
          serviceUtilClassBase.getDatabaseServiceConfig(
            serviceFQN as DatabaseServiceType
          ).schema
        );

        break;
      case EntityType.DASHBOARD_SERVICE:
        setSchema(
          serviceUtilClassBase.getDashboardServiceConfig(
            serviceFQN as DashboardServiceType
          ).schema
        );

        break;
      case EntityType.MESSAGING_SERVICE:
        setSchema(
          serviceUtilClassBase.getMessagingServiceConfig(
            serviceFQN as MessagingServiceType
          ).schema
        );

        break;
      case EntityType.PIPELINE_SERVICE:
        setSchema(
          serviceUtilClassBase.getPipelineServiceConfig(
            serviceFQN as PipelineServiceType
          ).schema
        );

        break;
      case EntityType.MLMODEL_SERVICE:
        setSchema(
          serviceUtilClassBase.getMlModelServiceConfig(
            serviceFQN as MlModelServiceType
          ).schema
        );

        break;
      case EntityType.METADATA_SERVICE:
        setSchema(
          serviceUtilClassBase.getMetadataServiceConfig(
            serviceFQN as MetadataServiceType
          ).schema
        );

        break;
      case EntityType.STORAGE_SERVICE:
        setSchema(
          serviceUtilClassBase.getStorageServiceConfig(
            serviceFQN as StorageServiceType
          ).schema
        );

        break;
      case EntityType.SEARCH_SERVICE:
        setSchema(
          serviceUtilClassBase.getSearchServiceConfig(
            serviceFQN as SearchServiceType
          ).schema
        );

        break;

      case EntityType.API_SERVICE:
        setSchema(
          serviceUtilClassBase.getAPIServiceConfig(serviceFQN as APIServiceType)
            .schema
        );

        break;
    }
  }, [serviceCategory, serviceFQN]);

  useEffect(() => {
    if (!isEmpty(schema)) {
      setData(
        getKeyValues({
          obj: connectionDetails,
          schemaPropertyObject: schema.properties,
          schema,
          serviceCategory,
        })
      );
    }
  }, [schema]);

  return (
    <>
      <div
        className="service-connection-details"
        data-testid="service-connection-details">
        <Row className="w-full" gutter={[8, 8]}>
          {data}
        </Row>
      </div>

      {extraInfo && (
        <div className="service-connection-details m-t-md m-y-lg">
          <Row className="w-full" gutter={[8, 8]}>
            <Col span={12}>
              <Row>
                <Col className="d-flex items-center" span={8}>
                  <Space size={0}>
                    <p className="text-grey-muted m-0">{extraInfo.headerKey}</p>
                    {extraInfo.description && (
                      <Tooltip
                        placement="bottom"
                        title={extraInfo.description}
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
                    type="text"
                    value={extraInfo.displayName ?? extraInfo.name}
                  />
                </Col>
              </Row>
            </Col>
          </Row>
        </div>
      )}
    </>
  );
};

export default ServiceConnectionDetails;
