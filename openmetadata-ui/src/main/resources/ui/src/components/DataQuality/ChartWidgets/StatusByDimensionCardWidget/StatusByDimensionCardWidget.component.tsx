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
import { isUndefined } from 'lodash';
import QueryString from 'qs';
import { useEffect, useMemo, useState } from 'react';
import { DIMENSIONS_DATA } from '../../../../constants/DataQuality.constants';
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
} from '../../../../utils/DataQuality/DataQualityPureUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
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
    } catch {
      setDqByDimensionData(undefined);
    } finally {
      setIsDqByDimensionLoading(false);
    }
  };

  useEffect(() => {
    getStatusByDimension();
  }, [chartFilter]);

  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-x-6 tw:gap-y-10 tw:md:grid-cols-2 tw:lg:grid-cols-4">
      {dqDimensions.map((dimension) => (
        <StatusByDimensionWidget
          icon={getDimensionIcon(dimension.title as DataQualityDimensions)}
          isLoading={isDqByDimensionLoading}
          key={dimension.title}
          redirectPath={{
            pathname: observabilityRouterClassBase.getDataQualityPagePath(
              DataQualityPageTabs.TEST_CASES
            ),
            search: QueryString.stringify({
              dataQualityDimension: dimension.title,
            }),
          }}
          statusData={dimension}
        />
      ))}
    </div>
  );
};

export default StatusByDimensionCardWidget;
