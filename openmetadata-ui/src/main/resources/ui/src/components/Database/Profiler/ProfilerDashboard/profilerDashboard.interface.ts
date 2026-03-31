/*
 *  Copyright 2022 Collate.
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

import { ReactNode } from 'react';
import { CurveType } from 'recharts/types/shape/Curve';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { Thread } from '../../../../generated/entity/feed/thread';
import { TestCase } from '../../../../generated/tests/testCase';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { ListTestCaseParamsBySearch } from '../../../../rest/testAPI';
import { NextPreviousProps } from '../../../common/NextPrevious/NextPrevious.interface';
import { TitleBreadcrumbProps } from '../../../common/TitleBreadcrumb/TitleBreadcrumb.interface';

export type MetricChartType = {
  information: {
    title: string;
    dataKey: string;
    stackId?: string;
    color: string;
    fill?: string;
    latestValue?: string | number;
    extra?: string;
  }[];
  data: Record<string, string | number | undefined>[];
};

export interface ProfilerDetailsCardProps {
  showYAxisCategory?: boolean;
  chartCollection: MetricChartType;
  name: string;
  title?: string;
  tickFormatter?: string;
  curveType?: CurveType;
  isLoading?: boolean;
  noDataPlaceholderText?: ReactNode;
  children?: ReactNode;
  chartType?: 'line' | 'area';
}

// URL path segments for profiler navigation
export enum ProfilerTabPath {
  TABLE_PROFILE = 'table-profile',
  COLUMN_PROFILE = 'column-profile',
  DATA_QUALITY = 'data-quality',
  INCIDENTS = 'incidents',
  OVERVIEW = 'overview',
}

export interface DataQualityTabProps {
  testCases: TestCase[];
  onTestUpdate?: (testCase?: TestCase) => void;
  afterDeleteAction?: () => void;
  showTableColumn?: boolean;
  isLoading?: boolean;
  onTestCaseResultUpdate?: (data: TestCase) => void;
  pagingData?: NextPreviousProps;
  removeFromTestSuite?: {
    testSuite: TestSuite;
    isAllowed: boolean;
  };
  showPagination?: boolean;
  breadcrumbData?: TitleBreadcrumbProps['titleLinks'];
  fetchTestCases?: (params?: ListTestCaseParamsBySearch) => Promise<void>;
  isEditAllowed?: boolean;
  tableHeader?: ReactNode;
  removeTableBorder?: boolean;
  enableBulkActions?: boolean;
}

export interface TestSummaryProps {
  data: TestCase;
}

export interface ProfilerLatestValueProps {
  information: MetricChartType['information'];
  tickFormatter?: string;
  stringValue?: boolean;
  extra?: ReactNode;
}

export type TestCaseAction = {
  data: TestCase;
  action: 'UPDATE' | 'DELETE' | 'UPDATE_STATUS';
};

export type TestCaseChartDataType = {
  information: { label: string; color: string }[];
  data: Record<string, string | number | undefined | Thread | number[]>[];
};

export interface LineChartRef {
  container: HTMLElement;
}

export type TestCasePermission = OperationPermission & {
  fullyQualifiedName?: string;
};
