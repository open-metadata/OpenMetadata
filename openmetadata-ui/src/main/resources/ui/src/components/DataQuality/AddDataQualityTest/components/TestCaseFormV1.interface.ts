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

import { FormSelectItem } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Table } from '../../../../generated/entity/data/table';
import {
  EntityReference,
  TagLabel,
  TestCase,
} from '../../../../generated/tests/testCase';
import { TestDefinition } from '../../../../generated/tests/testDefinition';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { TableSearchSource } from '../../../../interface/search.interface';
import { SelectionOption } from '../../../common/SelectionCardGroup/SelectionCardGroup.interface';

// =============================================
// COMPONENT PROPS
// =============================================
export interface TestCaseFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onFormSubmit?: (testCase: TestCase) => void;
  onActiveFieldChange?: (fieldId: string) => void;
  table?: Table;
  testSuite?: TestSuite;
  testLevel?: TestLevel;
  variant?: 'drawer' | 'modal';
  title?: ReactNode;
  headerActions?: ReactNode;
  width?: number | string;
  showDocPanel?: boolean;
  testCase?: TestCase;
  showOnlyParameter?: boolean;
  onUpdate?: (testCase: TestCase) => void;
}

export interface TestCaseFormContext {
  selectedDefinition?: TestDefinition;
  selectedTableData?: Table;
  selectedColumn?: string;
  selectedTestLevel: TestLevel;
  generateName: () => string;
  canCreatePipeline: boolean;
  isCheckingPermissions?: boolean;
}

export interface TestCaseFormBodyProps {
  form: UseFormReturn<FormValues>;
  table?: Table;
  testSuite?: TestSuite;
  errorMessage?: string;
  onErrorDismiss?: () => void;
  onActiveFieldChange?: (fieldId: string) => void;
  onContextChange?: (context: TestCaseFormContext) => void;
  isEditMode?: boolean;
  showOnlyParameter?: boolean;
  // In edit mode the drawer resolves the test definition up front via a
  // targeted getTestDefinitionById; passing it in lets the body render the
  // parameter section immediately instead of waiting on (and flickering
  // against) the async test-definition list.
  editDefinition?: TestDefinition;
}

export interface TestCaseSchedulerSectionProps {
  form: UseFormReturn<FormValues>;
  table?: Table;
  testSuite?: TestSuite;
  selectedTableData?: Table;
  hasTestSuite: boolean;
  canCreatePipeline: boolean;
  schedulerOptions?: string[];
  onActiveFieldChange?: (fieldId: string) => void;
}

// =============================================
// FORM VALUES
// =============================================
export interface FormValues {
  testLevel: TestLevel;
  selectedTable?: string;
  selectedColumn?: string;
  // Select-backed fields hold a FormSelectItem while the react-aria control is
  // active and a plain string once resolved; the transform helpers unwrap both.
  testTypeId?: string | FormSelectItem;
  testName?: string;
  displayName?: string;
  description?: string;
  tags?: TagLabel[];
  glossaryTerms?: TagLabel[];
  computePassedFailedRowCount?: boolean;
  useDynamicAssertion?: boolean;
  params?: Record<
    string,
    string | FormSelectItem | { [key: string]: string }[]
  >;
  parameterValues?: Array<{ name: string; value: string }>;
  dimensionColumns?: Array<string | FormSelectItem>;
  topDimensions?: number;
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
  COLUMN_DIMENSION = 'column-dimension',
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
