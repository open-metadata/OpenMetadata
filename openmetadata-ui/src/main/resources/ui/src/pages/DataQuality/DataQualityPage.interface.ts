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

import { EntityType } from '../../enums/entity.enum';
import { TestCaseStatus, TestSummary } from '../../generated/tests/testCase';
import { TestCaseType } from '../../rest/testAPI';

export enum DataQualityPageTabs {
  TEST_SUITES = 'test-suites',
  TABLES = 'tables',
  TEST_CASES = 'test-cases',
  DASHBOARD = 'dashboard',
}

export interface DataQualityContextInterface {
  isTestCaseSummaryLoading: boolean;
  testCaseSummary: TestSummary;
  activeTab: DataQualityPageTabs;
}

export type DataQualityDashboardChartFilters = {
  ownerFqn?: string;
  tags?: string[];
  tier?: string[];
  startTs?: number;
  endTs?: number;
  entityFQN?: string;
  entityType?: EntityType;
  serviceName?: string;
  testPlatforms?: string[];
  dataQualityDimension?: string;
  testCaseStatus?: TestCaseStatus;
  testCaseType?: TestCaseType;
};
