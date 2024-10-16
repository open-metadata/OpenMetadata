import { DateRangeObject } from 'Models';
import { TestCaseStatus } from '../../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../../generated/tests/testCaseResolutionStatus';
import { TestPlatform } from '../../generated/tests/testDefinition';
import { TestCaseType } from '../../rest/testAPI';

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
};

export interface IncidentTypeAreaChartWidgetProps {
  title: string;
  incidentStatusType: TestCaseResolutionStatusTypes;
  name: string;
}
