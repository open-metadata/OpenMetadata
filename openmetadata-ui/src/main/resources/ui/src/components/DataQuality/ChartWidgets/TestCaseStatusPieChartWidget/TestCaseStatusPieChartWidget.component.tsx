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
import { Card, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TestCaseIcon } from '../../../../assets/svg/all-activity-v2.svg';
import {
  GREEN_3,
  RED_3,
  YELLOW_2,
} from '../../../../constants/Color.constants';
import { INITIAL_TEST_SUMMARY } from '../../../../constants/TestSuite.constant';
import { fetchTestCaseSummary } from '../../../../rest/dataQualityDashboardAPI';
import {
  getPieChartLabel,
  getTestCaseTabPath,
  transformToTestCaseStatusObject,
} from '../../../../utils/DataQuality/DataQualityUtils';
import type { CustomPieChartData } from '../../../Visualisations/Chart/Chart.interface';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';
import { PieChartWidgetCommonProps } from '../../DataQuality.interface';
import '../chart-widgets.less';
import { TEST_CASE_STATUS_PIE_SEGMENT_ORDER } from '../ChartWidgets.constants';

const TestCaseStatusPieChartWidget = ({
  className = '',
  chartFilter,
}: PieChartWidgetCommonProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [testCaseSummary, setTestCaseSummary] = useState(INITIAL_TEST_SUMMARY);
  const [isTestCaseSummaryLoading, setIsTestCaseSummaryLoading] =
    useState(true);

  const fetchTestSummary = async () => {
    setIsTestCaseSummaryLoading(true);
    try {
      const { data } = await fetchTestCaseSummary(chartFilter);
      const updatedData = transformToTestCaseStatusObject(data);
      setTestCaseSummary(updatedData);
    } catch {
      setTestCaseSummary(INITIAL_TEST_SUMMARY);
    } finally {
      setIsTestCaseSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchTestSummary();
  }, [chartFilter]);

  const handleSegmentClick = useCallback(
    (_entry: CustomPieChartData, index: number) => {
      const status = TEST_CASE_STATUS_PIE_SEGMENT_ORDER[index];
      if (status) {
        navigate(getTestCaseTabPath(status));
      }
    },
    [navigate]
  );

  const { data, chartLabel } = useMemo(
    () => ({
      data: [
        {
          name: t('label.success'),
          value: testCaseSummary.success,
          color: GREEN_3,
        },
        {
          name: t('label.failed'),
          value: testCaseSummary.failed,
          color: RED_3,
        },
        {
          name: t('label.aborted'),
          value: testCaseSummary.aborted,
          color: YELLOW_2,
        },
      ],
      chartLabel: getPieChartLabel(
        t('label.test-plural'),
        testCaseSummary.total
      ),
    }),
    [testCaseSummary]
  );

  return (
    <Card
      className={className}
      data-testid="test-case-status-pie-chart-widget"
      loading={isTestCaseSummaryLoading}>
      <div className="d-flex flex-column items-center">
        <div className="d-flex items-center gap-2">
          <div className="custom-chart-icon-background all-tests-icon icon-container">
            <TestCaseIcon />
          </div>
          <Typography.Text className="font-medium text-md">
            {t('label.test-case-result')}
          </Typography.Text>
        </div>
        <CustomPieChart
          showLegends
          data={data}
          label={chartLabel}
          name="test-case-result"
          onSegmentClick={handleSegmentClick}
        />
      </div>
    </Card>
  );
};

export default TestCaseStatusPieChartWidget;
