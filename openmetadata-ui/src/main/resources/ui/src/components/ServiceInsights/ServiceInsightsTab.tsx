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
import { isEqual } from 'lodash';
import { ServiceTypes } from 'Models';
import React from 'react';
import { useParams } from 'react-router-dom';
import DataQualityWidget from './DataQualityWidget/DataQualityWidget';
import MostExpensiveQueriesWidget from './MostExpensiveQueriesWidget/MostExpensiveQueriesWidget';
import MostUsedAssetsWidget from './MostUsedAssetsWidget/MostUsedAssetsWidget';
import PIIDistributionWidget from './PIIDistributionWidget/PIIDistributionWidget';
import PlatformInsightsWidget from './PlatformInsightsWidget/PlatformInsightsWidget';
import './service-insights-tab.less';
import { ServiceInsightsTabProps } from './ServiceInsightsTab.interface';
import TierDistributionWidget from './TierDistributionWidget/TierDistributionWidget';

const ServiceInsightsTab: React.FC<ServiceInsightsTabProps> = () => {
  const { serviceCategory } = useParams<{
    serviceCategory: ServiceTypes;
    tab: string;
  }>();

  const isDatabaseService = isEqual(serviceCategory, 'databaseServices');

  return (
    <Row className="service-insights-tab" gutter={[16, 16]}>
      <Col span={24}>
        <PlatformInsightsWidget />
      </Col>
      <Col span={12}>
        <PIIDistributionWidget />
      </Col>
      <Col span={12}>
        <TierDistributionWidget />
      </Col>
      {isDatabaseService && (
        <Col span={24}>
          <MostUsedAssetsWidget />
        </Col>
      )}
      {isDatabaseService && (
        <Col span={24}>
          <MostExpensiveQueriesWidget />
        </Col>
      )}
      {isDatabaseService && (
        <Col span={24}>
          <DataQualityWidget />
        </Col>
      )}
    </Row>
  );
};

export default ServiceInsightsTab;
