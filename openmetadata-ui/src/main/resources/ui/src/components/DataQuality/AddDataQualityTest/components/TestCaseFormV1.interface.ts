/*
 *  Copyright 2025 Collate.
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

import { DrawerProps } from 'antd';
import { ReactNode } from 'react';
import { Table } from '../../../../generated/entity/data/table';
import {
  EntityReference,
  TagLabel,
  TestCase,
} from '../../../../generated/tests/testCase';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { TableSearchSource } from '../../../../interface/search.interface';
import { SelectionOption } from '../../../common/SelectionCardGroup/SelectionCardGroup.interface';

// =============================================
// COMPONENT PROPS
// =============================================
export interface TestCaseFormV1Props {
  drawerProps?: DrawerProps;
  className?: string;
  table?: Table;
  testSuite?: TestSuite;
  onFormSubmit?: (testCase: TestCase) => void;
  onCancel?: () => void;
  loading?: boolean;
  testLevel?: TestLevel;
}

// =============================================
// FORM VALUES
// =============================================
export interface FormValues {
  testLevel: TestLevel;
  selectedTable?: string;
  selectedColumn?: string;
  testTypeId?: string;
  testName?: string;
  description?: string;
  tags?: TagLabel[];
  glossaryTerms?: TagLabel[];
  computePassedFailedRowCount?: boolean;
  useDynamicAssertion?: boolean;
  params?: Record<string, string | { [key: string]: string }[]>;
  parameterValues?: Array<{ name: string; value: string }>;
  // Scheduler fields
  pipelineName?: string;
  cron?: string;
  enableDebugLog?: boolean;
  raiseOnError?: boolean;
  selectAllTestCases?: boolean;
  testCases?: EntityReference[];
}

// =============================================
// ENUMS
// =============================================
export enum TestLevel {
  TABLE = 'table',
  COLUMN = 'column',
}

// =============================================
// TYPE ALIASES
// =============================================
export type TablesCache = Map<string, TableSearchSource>;

// =============================================
// CONSTANTS TYPES
// =============================================
export interface TestLevelOption extends SelectionOption {
  value: TestLevel;
  label: string;
  description: string;
  icon: ReactNode;
}

// =============================================
// TABLE SEARCH
// =============================================
export type TableSearchFieldKeys = (keyof TableSearchSource)[];

// =============================================
// HELPER FUNCTION TYPES
// =============================================
export type ConvertSearchSourceToTableFn = (
  searchSource: TableSearchSource
) => Table;
