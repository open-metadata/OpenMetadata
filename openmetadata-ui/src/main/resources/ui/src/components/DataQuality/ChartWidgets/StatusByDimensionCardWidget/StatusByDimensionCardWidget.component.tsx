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
import classNames from 'classnames';
import { isUndefined } from 'lodash';
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
  getTestCaseListPath,
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

  useEffect(() => {
    let ignore = false;

    const getStatusByDimension = async () => {
      setIsDqByDimensionLoading(true);
      try {
        // Dimensioned and unclassified test cases are separate aggregations;
        // fetch them together and merge them into one set of status cards.
        const [{ data }, { data: noDimensionData }] = await Promise.all([
          fetchTestCaseSummaryByDimension(chartFilter),
          fetchTestCaseSummaryByNoDimension(chartFilter),
        ]);

        if (!ignore) {
          setDqByDimensionData([...data, ...noDimensionData]);
        }
      } catch {
        if (!ignore) {
          setDqByDimensionData(undefined);
        }
      } finally {
        if (!ignore) {
          setIsDqByDimensionLoading(false);
        }
      }
    };

    getStatusByDimension();

    return () => {
      ignore = true;
    };
  }, [chartFilter]);

  return (
    <div className="tw:@container">
      <div
        className={classNames(
          'tw:grid tw:grid-cols-[repeat(2,minmax(0,20rem))] tw:justify-start tw:gap-x-6 tw:gap-y-10',
          'tw:@3xl:grid-cols-[repeat(4,minmax(0,20rem))]',
          'tw:@8xl:grid-cols-[repeat(8,minmax(0,20rem))]',
          'tw:@8xl:gap-x-8'
        )}>
        {dqDimensions.map((dimension) => (
          <StatusByDimensionWidget
            icon={getDimensionIcon(dimension.title as DataQualityDimensions)}
            isLoading={isDqByDimensionLoading}
            key={dimension.title}
            redirectPath={{
              // Preserve the complete dashboard slice, including its date range,
              // and narrow only the clicked card to this dimension.
              ...getTestCaseListPath({
                ...chartFilter,
                dataQualityDimension: dimension.title,
              }),
              pathname: observabilityRouterClassBase.getDataQualityPagePath(
                DataQualityPageTabs.TEST_CASES
              ),
            }}
            statusData={dimension}
          />
        ))}
      </div>
    </div>
  );
};

export default StatusByDimensionCardWidget;
