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
import { Col, Row, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFqn } from '../../../hooks/useFqn';
import Fqn from '../../../utils/Fqn';
import DataAssetsCoveragePieChartWidget from '../../DataQuality/ChartWidgets/DataAssetsCoveragePieChartWidget/DataAssetsCoveragePieChartWidget.component';
import EntityHealthStatusPieChartWidget from '../../DataQuality/ChartWidgets/EntityHealthStatusPieChartWidget/EntityHealthStatusPieChartWidget.component';
import TestCaseStatusPieChartWidget from '../../DataQuality/ChartWidgets/TestCaseStatusPieChartWidget/TestCaseStatusPieChartWidget.component';

function DataQualityWidget() {
  const { t } = useTranslation();
  const { fqn: serviceName } = useFqn();
  const nameWithoutQuotes = Fqn.getNameWithoutQuotes(serviceName);

  const chartFilter = useMemo(
    () => ({ serviceName: nameWithoutQuotes }),
    [nameWithoutQuotes]
  );

  return (
    <div className="service-insights-widget widget-flex-col">
      <Typography.Text className="font-medium text-lg">
        {t('label.data-quality')}
      </Typography.Text>
      <Typography.Text className="text-grey-muted text-sm">
        {t('message.page-sub-header-for-data-quality')}
      </Typography.Text>
      <Row className="m-t-sm" gutter={[24, 24]}>
        <Col span={8}>
          <DataAssetsCoveragePieChartWidget
            chartFilter={chartFilter}
            className="widget-info-card"
          />
        </Col>
        <Col span={8}>
          <EntityHealthStatusPieChartWidget
            chartFilter={chartFilter}
            className="widget-info-card"
          />
        </Col>
        <Col span={8}>
          <TestCaseStatusPieChartWidget
            chartFilter={chartFilter}
            className="widget-info-card"
          />
        </Col>
      </Row>
    </div>
  );
}

export default DataQualityWidget;
