import { DateRangeObject } from 'Models';
import { SVGAttributes } from 'react';
import { LinkProps } from 'react-router-dom';
import { TestCaseType } from '../../enums/TestSuite.enum';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import { TestPlatform } from '../../generated/tests/testDefinition';
import { DataQualityDashboardChartFilters } from '../../pages/DataQuality/DataQualityPage.interface';
import { AreaChartColorScheme } from '../Visualisations/Chart/Chart.interface';

/*
 *  Copyright 2023 Collate.
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

export enum IncidentTimeMetricsType {
  TIME_TO_RESPONSE = 'timeToResponse',
  TIME_TO_RESOLUTION = 'timeToResolution',
}

export type TestSuiteSearchParams = {
  searchValue: string;
  status: string;
  type: string;
  owner: string;
};

export type TestCaseSearchParams = {
  searchValue?: string;
  tableFqn?: string;
  testPlatforms?: TestPlatform[];
  testCaseStatus?: TestCaseStatus;
  testCaseType?: TestCaseType;
  lastRunRange?: DateRangeObject;
  tier?: string;
  tags?: string;
  serviceName?: string;
  dataQualityDimension?: string;
};

export type DataQualityPageParams = TestCaseSearchParams & {
  owner?: string;
  tags?: string[];
  currentPage?: number;
  pageSize?: number;
};

export interface IncidentTypeAreaChartWidgetProps {
  title: string;
  incidentStatusType: TestCaseResolutionStatusTypes;
  name: string;
  chartFilter?: DataQualityDashboardChartFilters;
  redirectPath?: LinkProps['to'];
}

export interface IncidentTimeChartWidgetProps {
  title: string;
  incidentMetricType: IncidentTimeMetricsType;
  name: string;
  chartFilter?: DataQualityDashboardChartFilters;
  height?: number;
  redirectPath?: LinkProps['to'];
}
export interface TestCaseStatusAreaChartWidgetProps {
  title: string;
  testCaseStatus: TestCaseStatus;
  name: string;
  chartColorScheme?: AreaChartColorScheme;
  chartFilter?: DataQualityDashboardChartFilters;
  height?: number;
  redirectPath?: LinkProps['to'];
}

export interface PieChartWidgetCommonProps {
  className?: string;
  chartFilter?: DataQualityDashboardChartFilters;
}

export interface DataStatisticWidgetProps {
  name: string;
  title: string;
  icon: SvgComponent;
  dataLabel: string;
  countValue: number;
  redirectPath: LinkProps['to'];
  linkLabel: string;
  isLoading?: boolean;
  iconProps?: SVGAttributes<SVGElement>;
}
