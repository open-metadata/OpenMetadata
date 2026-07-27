/*
 *  Copyright 2026 Collate.
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
import { Grid } from '@openmetadata/ui-core-components';
import QueryString from 'qs';
import { useTranslation } from 'react-i18next';
import type { NavigateFunction } from 'react-router-dom';
import {
  ABORTED_CHART_COLOR_SCHEME,
  FAILED_CHART_COLOR_SCHEME,
  SUCCESS_CHART_COLOR_SCHEME,
} from '../../../constants/Chart.constants';
import { DATA_QUALITY_DASHBOARD_HEADER } from '../../../constants/DataQuality.constants';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../../../generated/tests/testCaseResolutionStatus';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import observabilityRouterClassBase from '../../../utils/ObservabilityRouterClassBase';
import DataAssetsCoveragePieChartWidget from '../ChartWidgets/DataAssetsCoveragePieChartWidget/DataAssetsCoveragePieChartWidget.component';
import EntityHealthStatusPieChartWidget from '../ChartWidgets/EntityHealthStatusPieChartWidget/EntityHealthStatusPieChartWidget.component';
import IncidentTimeChartWidget from '../ChartWidgets/IncidentTimeChartWidget/IncidentTimeChartWidget.component';
import IncidentTypeAreaChartWidget from '../ChartWidgets/IncidentTypeAreaChartWidget/IncidentTypeAreaChartWidget.component';
import StatusByDimensionCardWidget from '../ChartWidgets/StatusByDimensionCardWidget/StatusByDimensionCardWidget.component';
import TestCaseStatusAreaChartWidget from '../ChartWidgets/TestCaseStatusAreaChartWidget/TestCaseStatusAreaChartWidget.component';
import TestCaseStatusPieChartWidget from '../ChartWidgets/TestCaseStatusPieChartWidget/TestCaseStatusPieChartWidget.component';
import { IncidentTimeMetricsType } from '../DataQuality.interface';
import { DqDashboardChartFilters } from './DataQualityDashboard.interface';

export const DQ_DASHBOARD_PIE_CHART_CLASS = 'data-quality-dashboard-pie-chart';

/**
 * Ordered section list (key + i18n header keys) shared by both the OSS and AI
 * dashboard renderers so each draws the same sections in the same order. Only
 * the chrome around each section differs per mode.
 */
export const DQ_DASHBOARD_SECTIONS = [
  { key: 'data-health', header: DATA_QUALITY_DASHBOARD_HEADER.dataHealth },
  {
    key: 'data-dimensions',
    header: DATA_QUALITY_DASHBOARD_HEADER.dataDimensions,
  },
  {
    key: 'test-case-status',
    header: DATA_QUALITY_DASHBOARD_HEADER.testCasesStatus,
  },
  {
    key: 'incident-metrics',
    header: DATA_QUALITY_DASHBOARD_HEADER.incidentMetrics,
  },
] as const;

export type DqDashboardSectionKey =
  (typeof DQ_DASHBOARD_SECTIONS)[number]['key'];

export interface DqDashboardSectionContentProps {
  sectionKey: DqDashboardSectionKey;
  pieChartFilters: DqDashboardChartFilters;
  defaultFilters: DqDashboardChartFilters;
  navigate?: NavigateFunction;
}

/**
 * Shared chart body for a dashboard section — all UI logic (which charts,
 * redirect paths, colors, titles, layout) lives here as plain JSX, keyed by
 * section. Data/filter values come from the caller (the data hook). Both OSS and
 * AI modes render this inside their own section chrome so the chart wiring is
 * never duplicated.
 */
export const DqDashboardSectionContent = ({
  sectionKey,
  pieChartFilters,
  defaultFilters,
  navigate,
}: DqDashboardSectionContentProps) => {
  const { t } = useTranslation();
  const testCasesPath = observabilityRouterClassBase.getDataQualityPagePath(
    DataQualityPageTabs.TEST_CASES
  );
  const testSuitesPath = observabilityRouterClassBase.getDataQualityPagePath(
    DataQualityPageTabs.TEST_SUITES
  );
  const incidentPath = observabilityRouterClassBase.getIncidentManagerPath();

  switch (sectionKey) {
    case 'data-health':
      return (
        <Grid colGap="6">
          <Grid.Item span={8}>
            <DataAssetsCoveragePieChartWidget
              chartFilter={pieChartFilters}
              className={DQ_DASHBOARD_PIE_CHART_CLASS}
              navigate={navigate}
              redirectPath={testSuitesPath}
            />
          </Grid.Item>
          <Grid.Item span={8}>
            <EntityHealthStatusPieChartWidget
              chartFilter={pieChartFilters}
              className={DQ_DASHBOARD_PIE_CHART_CLASS}
              navigate={navigate}
              redirectPath={testCasesPath}
            />
          </Grid.Item>
          <Grid.Item span={8}>
            <TestCaseStatusPieChartWidget
              chartFilter={pieChartFilters}
              className={DQ_DASHBOARD_PIE_CHART_CLASS}
              navigate={navigate}
              redirectPath={testCasesPath}
            />
          </Grid.Item>
        </Grid>
      );

    case 'data-dimensions':
      return <StatusByDimensionCardWidget chartFilter={pieChartFilters} />;

    case 'test-case-status':
      return (
        <Grid colGap="6">
          <Grid.Item span={8}>
            <TestCaseStatusAreaChartWidget
              chartColorScheme={SUCCESS_CHART_COLOR_SCHEME}
              chartFilter={defaultFilters}
              name="success"
              redirectPath={{
                pathname: testCasesPath,
                search: QueryString.stringify({
                  testCaseStatus: TestCaseStatus.Success,
                }),
              }}
              testCaseStatus={TestCaseStatus.Success}
              title={t('label.success')}
            />
          </Grid.Item>
          <Grid.Item span={8}>
            <TestCaseStatusAreaChartWidget
              chartColorScheme={ABORTED_CHART_COLOR_SCHEME}
              chartFilter={defaultFilters}
              name="aborted"
              redirectPath={{
                pathname: testCasesPath,
                search: QueryString.stringify({
                  testCaseStatus: TestCaseStatus.Aborted,
                }),
              }}
              testCaseStatus={TestCaseStatus.Aborted}
              title={t('label.aborted')}
            />
          </Grid.Item>
          <Grid.Item span={8}>
            <TestCaseStatusAreaChartWidget
              chartColorScheme={FAILED_CHART_COLOR_SCHEME}
              chartFilter={defaultFilters}
              name="failed"
              redirectPath={{
                pathname: testCasesPath,
                search: QueryString.stringify({
                  testCaseStatus: TestCaseStatus.Failed,
                }),
              }}
              testCaseStatus={TestCaseStatus.Failed}
              title={t('label.failed')}
            />
          </Grid.Item>
        </Grid>
      );

    case 'incident-metrics':
      return (
        <div className="tw:grid tw:grid-cols-1 tw:gap-6 tw:md:grid-cols-2 tw:xl:grid-cols-4">
          <IncidentTypeAreaChartWidget
            chartFilter={defaultFilters}
            height={60}
            incidentStatusType={TestCaseResolutionStatusTypes.New}
            name="open-incident"
            redirectPath={{
              pathname: incidentPath,
              search: QueryString.stringify({
                testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
                startTs: defaultFilters.startTs,
                endTs: defaultFilters.endTs,
              }),
            }}
            title={t('label.open-incident-plural')}
          />
          <IncidentTypeAreaChartWidget
            chartFilter={defaultFilters}
            height={60}
            incidentStatusType={TestCaseResolutionStatusTypes.Resolved}
            name="resolved-incident"
            redirectPath={{
              pathname: incidentPath,
              search: QueryString.stringify({
                testCaseResolutionStatusType:
                  TestCaseResolutionStatusTypes.Resolved,
                startTs: defaultFilters.startTs,
                endTs: defaultFilters.endTs,
              }),
            }}
            title={t('label.resolved-incident-plural')}
          />
          <IncidentTimeChartWidget
            chartFilter={defaultFilters}
            height={60}
            incidentMetricType={IncidentTimeMetricsType.TIME_TO_RESPONSE}
            name="response-time"
            title={t('label.response-time')}
          />
          <IncidentTimeChartWidget
            chartFilter={defaultFilters}
            height={60}
            incidentMetricType={IncidentTimeMetricsType.TIME_TO_RESOLUTION}
            name="resolution-time"
            title={t('label.resolution-time')}
          />
        </div>
      );

    default:
      return null;
  }
};

export default DqDashboardSectionContent;
