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
import { Card, Col, Row } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';

import QueryString from 'qs';
import { useEffect, useMemo, useState } from 'react';
import {
  DIMENSIONS_DATA,
  NO_DIMENSION,
} from '../../../../constants/profiler.constant';
import { DataQualityReport } from '../../../../generated/tests/dataQualityReport';
import { DataQualityDimensions } from '../../../../generated/tests/testDefinition';
import { DataQualityPageTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import {
  fetchTestCaseSummaryByDimension,
  fetchTestCaseSummaryByNoDimension,
} from '../../../../rest/dataQualityDashboardAPI';
import {
  getDimensionIcon,
  transformToTestCaseStatusByDimension,
} from '../../../../utils/DataQuality/DataQualityUtils';
import { getDataQualityPagePath } from '../../../../utils/RouterUtils';
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
        ? DIMENSIONS_DATA.map((item) => ({
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
      const { data: noDimensionData } = await fetchTestCaseSummaryByNoDimension(
        chartFilter
      );

      setDqByDimensionData([...data, ...noDimensionData]);
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
      bodyStyle={{ padding: '40px 14px' }}
      className="status-by-dimension-card-widget-container"
      loading={isDqByDimensionLoading}>
      <Row gutter={[24, 40]}>
        {dqDimensions.map((dimension, index) => (
          <Col
            className={classNames({
              'dimension-widget-divider': (index + 1) % 4 !== 0,
            })}
            key={dimension.title}
            span={6}>
            <StatusByDimensionWidget
              icon={getDimensionIcon(dimension.title as DataQualityDimensions)}
              key={dimension.title}
              redirectPath={
                dimension.title === NO_DIMENSION
                  ? undefined
                  : {
                      pathname: getDataQualityPagePath(
                        DataQualityPageTabs.TEST_CASES
                      ),
                      search: QueryString.stringify({
                        dataQualityDimension: dimension.title,
                      }),
                    }
              }
              statusData={dimension}
            />
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default StatusByDimensionCardWidget;
