/*
 *  Copyright 2024 Collate.
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
import { Card, Col, Divider, Row } from 'antd';
import { isUndefined } from 'lodash';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { DataQualityReport } from '../../../../generated/tests/dataQualityReport';
import { DataQualityDimensions } from '../../../../generated/tests/testDefinition';
import { fetchTestCaseSummaryByDimension } from '../../../../rest/dataQualityDashboardAPI';
import {
  getDimensionIcon,
  transformToTestCaseStatusByDimension,
} from '../../../../utils/DataQuality/DataQualityUtils';
import { PieChartWidgetCommonProps } from '../../DataQuality.interface';
import StatusByDimensionWidget from '../StatusCardWidget/StatusCardWidget.component';
import './status-by-dimension-card-widget.less';

const StatusByDimensionCardWidget = ({
  chartFilter,
}: PieChartWidgetCommonProps) => {
  const [isDqByDimensionLoading, setIsDqByDimensionLoading] = useState(true);
  const [dqByDimensionData, setDqByDimensionData] =
    useState<DataQualityReport['data']>();

  const dqDimensions = useMemo(
    () =>
      isUndefined(dqByDimensionData)
        ? Object.values(DataQualityDimensions).map((item) => ({
            title: item,
            success: 0,
            failed: 0,
            aborted: 0,
            total: 0,
          }))
        : transformToTestCaseStatusByDimension(dqByDimensionData),
    [dqByDimensionData]
  );

  const getStatusByDimension = async () => {
    setIsDqByDimensionLoading(true);
    try {
      const { data } = await fetchTestCaseSummaryByDimension(chartFilter);

      setDqByDimensionData(data);
    } catch (error) {
      setDqByDimensionData(undefined);
    } finally {
      setIsDqByDimensionLoading(false);
    }
  };

  useEffect(() => {
    getStatusByDimension();
  }, [chartFilter]);

  return (
    <Card
      className="status-by-dimension-card-widget-container"
      loading={isDqByDimensionLoading}>
      <Row justify="space-between">
        {dqDimensions.map((dimension, index) => (
          <Fragment key={dimension.title}>
            <Col>
              <StatusByDimensionWidget
                icon={getDimensionIcon(
                  dimension.title as DataQualityDimensions
                )}
                key={dimension.title}
                statusData={dimension}
              />
            </Col>
            {dqDimensions.length - 1 > index && (
              <Col>
                <Divider className="dimension-widget-divider" type="vertical" />
              </Col>
            )}
          </Fragment>
        ))}
      </Row>
    </Card>
  );
};

export default StatusByDimensionCardWidget;
