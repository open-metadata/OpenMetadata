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
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as TestCaseIcon } from '../../../../assets/svg/all-activity-v2.svg';
import {
  GREEN_3,
  PRIMARY_COLOR,
  RED_3,
  TEXT_COLOR,
  YELLOW_2,
} from '../../../../constants/Color.constants';
import { TEXT_GREY_MUTED } from '../../../../constants/constants';
import { useDataQualityProvider } from '../../../../pages/DataQuality/DataQualityProvider';
import CustomPieChart from '../../../Visualisations/Chart/CustomPieChart.component';

const TestCaseStatusPieChartWidget = () => {
  const { t } = useTranslation();
  const { isTestCaseSummaryLoading, testCaseSummary } =
    useDataQualityProvider();

  const { data, chartLabel } = useMemo(
    () => ({
      data: [
        {
          name: t('label.success'),
          value: testCaseSummary.success ?? 0,
          color: GREEN_3,
        },
        {
          name: t('label.failed'),
          value: testCaseSummary.failed ?? 0,
          color: RED_3,
        },
        {
          name: t('label.aborted'),
          value: testCaseSummary.aborted ?? 0,
          color: YELLOW_2,
        },
      ],
      chartLabel: (
        <>
          <text
            dy={8}
            fill={TEXT_GREY_MUTED}
            fontSize={16}
            textAnchor="middle"
            x="50%"
            y="46%">
            <tspan fill={TEXT_COLOR}>{testCaseSummary.success ?? 0}</tspan>
            {`/${testCaseSummary.total ?? 0}`}
          </text>
          <text
            dy={8}
            fill={TEXT_GREY_MUTED}
            textAnchor="middle"
            x="50%"
            y="54%">
            {t('label.test-plural')}
          </text>
        </>
      ),
    }),
    [testCaseSummary]
  );

  return (
    <Card loading={isTestCaseSummaryLoading}>
      <div className="d-flex flex-column items-center">
        <div className="d-flex items-center gap-2">
          <TestCaseIcon color={PRIMARY_COLOR} height={20} width={20} />
          <Typography.Text className="font-medium text-md text-grey-muted">
            {t('label.test-case-result')}
          </Typography.Text>
        </div>
        <CustomPieChart
          data={data}
          label={chartLabel}
          name="test-case-result"
        />
      </div>
    </Card>
  );
};

export default TestCaseStatusPieChartWidget;
