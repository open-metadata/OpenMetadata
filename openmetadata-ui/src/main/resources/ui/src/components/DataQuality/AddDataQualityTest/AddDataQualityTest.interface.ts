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
import { CreateTestCase } from '../../../generated/api/tests/createTestCase';
import { Table } from '../../../generated/entity/data/table';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TagLabel, TestCase } from '../../../generated/tests/testCase';
import { TestDefinition } from '../../../generated/tests/testDefinition';
import { TestSuite } from '../../../generated/tests/testSuite';
import { ListTestCaseParamsBySearch } from '../../../rest/testAPI';

export interface AddDataQualityTestProps {
  table: Table;
}

export interface TestCaseFormProps {
  initialValue?: CreateTestCase;
  onSubmit: (data: CreateTestCase) => Promise<void>;
  onCancel: (data: CreateTestCase) => void;
  table: Table;
}

export interface TestSuiteIngestionProps {
  testSuite: TestSuite;
  ingestionPipeline?: IngestionPipeline;
  onCancel?: () => void;
  onViewServiceClick?: () => void;
}

export type TestSuiteIngestionDataType = {
  cron?: string;
  enableDebugLog?: boolean;
  testCases?: string[];
  name?: string;
  selectAllTestCases?: boolean;
  raiseOnError?: boolean;
};

export interface AddTestSuitePipelineProps {
  initialData?: Partial<TestSuiteIngestionDataType>;
  isLoading: boolean;
  testSuite?: TestSuite;
  onSubmit: (data: TestSuiteIngestionDataType) => void;
  includePeriodOptions?: string[];
  onCancel?: () => void;
  testCaseParams?: ListTestCaseParamsBySearch;
}

export interface RightPanelProps {
  data: {
    title: string;
    body: string | ReactNode;
  };
}

export type SelectTestSuiteType = {
  name?: string;
  description?: string;
  data?: TestSuite;
  isNewTestSuite: boolean;
};

export interface ParameterFormProps {
  definition: TestDefinition;
  table?: Table;
}

export interface EditTestCaseModalProps {
  visible: boolean;
  testCase: TestCase;
  showOnlyParameter?: boolean;
  onCancel: () => void;
  onUpdate?: (testCase: TestCase) => void;
}

export type TestCaseFormType = {
  testName: string;
  params: Record<string, string | { [key: string]: string }[]>;
  useDynamicAssertion?: boolean;
  testTypeId: string;
  computePassedFailedRowCount?: boolean;
  description?: string;
  tags?: TagLabel[];
  glossaryTerms?: TagLabel[];
};
