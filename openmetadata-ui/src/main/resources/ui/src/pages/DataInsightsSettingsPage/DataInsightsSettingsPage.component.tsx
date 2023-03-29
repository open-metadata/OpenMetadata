/*
 *  Copyright 2023 Collate.
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

import { Col, Row } from 'antd';
import PageHeader from 'components/header/PageHeader.component';
import AddIngestionButton from 'components/Ingestion/AddIngestionButton.component';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import SettingsIngestion from 'components/SettingsIngestion/SettingsIngestion.component';
import { OPEN_METADATA } from 'constants/Services.constant';
import { ServiceCategory } from 'enums/service.enum';
import { PipelineType } from 'generated/api/services/ingestionPipelines/createIngestionPipeline';
import { IngestionPipeline } from 'generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ServicesType } from 'interface/service.interface';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

function DataInsightsSettingsPage() {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [ingestionPipelines, setIngestionPipelines] = useState<
    Array<IngestionPipeline>
  >([]);
  const [ingestionData, setIngestionData] =
    useState<Array<IngestionPipeline>>(ingestionPipelines);

  const serviceCategory = ServiceCategory.METADATA_SERVICES;
  const serviceFQN = OPEN_METADATA;

  const handleServiceDetailsChange = useCallback(
    (details: ServicesType) => {
      setServiceDetails(details);
    },
    [setServiceDetails]
  );

  const handleIngestionPipelinesChange = useCallback(
    (pipelines: Array<IngestionPipeline>) => {
      setIngestionPipelines(pipelines);
    },
    [setIngestionPipelines]
  );

  const handleIngestionDataChange = useCallback(
    (data: Array<IngestionPipeline>) => {
      setIngestionData(data);
    },
    [setIngestionData]
  );

  return (
    <Row align="middle">
      <Col span={24}>
        <Row justify="space-between">
          <Col>
            <PageHeader
              data={{
                header: t('label.data-insight'),
                subHeader: t('message.data-insight-message'),
              }}
            />
          </Col>
          <Col>
            <AddIngestionButton
              ingestionData={ingestionData}
              ingestionList={ingestionPipelines}
              permissions={permissions.metadataService}
              pipelineType={PipelineType.DataInsight}
              serviceCategory={serviceCategory}
              serviceDetails={serviceDetails as ServicesType}
              serviceName={serviceFQN}
            />
          </Col>
        </Row>
      </Col>

      <Col data-testid="ingestion-table-container" span={24}>
        <SettingsIngestion
          handleIngestionDataChange={handleIngestionDataChange}
          handleIngestionPipelinesChange={handleIngestionPipelinesChange}
          handleServiceDetailsChange={handleServiceDetailsChange}
          pipelineType={PipelineType.DataInsight}
        />
      </Col>
    </Row>
  );
}

export default DataInsightsSettingsPage;
