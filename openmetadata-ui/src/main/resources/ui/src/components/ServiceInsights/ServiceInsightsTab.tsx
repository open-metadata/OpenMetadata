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

import { Col, Row } from 'antd';
import { isUndefined } from 'lodash';
import { ServiceTypes } from 'Models';
import React from 'react';
import { useParams } from 'react-router-dom';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import './service-insights-tab.less';
import { ServiceInsightsTabProps } from './ServiceInsightsTab.interface';

const ServiceInsightsTab: React.FC<ServiceInsightsTabProps> = () => {
  const { serviceCategory } = useParams<{
    serviceCategory: ServiceTypes;
    tab: string;
  }>();

  const {
    PlatformInsightsWidget,
    PIIDistributionWidget,
    TierDistributionWidget,
    MostUsedAssetsWidget,
    MostExpensiveQueriesWidget,
    DataQualityWidget,
    CollateAIWidget,
  } = serviceUtilClassBase.getInsightsTabWidgets(serviceCategory);

  return (
    <Row className="service-insights-tab" gutter={[16, 16]}>
      <Col span={24}>
        <PlatformInsightsWidget />
      </Col>
      {!isUndefined(CollateAIWidget) && (
        <Col span={24}>
          <CollateAIWidget />
        </Col>
      )}
      <Col span={12}>
        <PIIDistributionWidget />
      </Col>
      <Col span={12}>
        <TierDistributionWidget />
      </Col>
      {!isUndefined(MostUsedAssetsWidget) && (
        <Col span={24}>
          <MostUsedAssetsWidget />
        </Col>
      )}
      {!isUndefined(MostExpensiveQueriesWidget) && (
        <Col span={24}>
          <MostExpensiveQueriesWidget />
        </Col>
      )}
      {!isUndefined(DataQualityWidget) && (
        <Col span={24}>
          <DataQualityWidget />
        </Col>
      )}
    </Row>
  );
};

export default ServiceInsightsTab;
