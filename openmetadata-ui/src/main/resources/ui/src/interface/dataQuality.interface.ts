/*
 *  Copyright 2021 Collate
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

import { ColumnTestType } from '../enums/columnTest.enum';
import { Column } from '../generated/entity/data/table';
import {
  EntityReference,
  TableTestType,
  TestCaseExecutionFrequency,
  TestCaseResult,
} from '../generated/tests/tableTest';

export interface TestCaseConfigType {
  value?: number;
  maxValue?: number;
  minValue?: number;
  regex?: string;
  forbiddenValues?: Array<number | string>;
  missingCountValue?: number;
  missingValueMatch?: string;
}

export interface Result {
  executionTime: number;
  testCaseStatus: string;
  result: string;
}

export interface ColumnTest {
  id?: string;
  columnName: string;
  description?: string;
  executionFrequency?: TestCaseExecutionFrequency;
  owner?: EntityReference;
  results?: Result[];
  testCase: {
    columnTestType: ColumnTestType;
    config?: TestCaseConfigType;
  };
}

export type DatasetTestModeType = 'table' | 'column';

export interface ModifiedTableColumn extends Column {
  columnTests?: ColumnTest[];
}

export interface TableTestDataType {
  description?: string;
  executionFrequency?: TestCaseExecutionFrequency;
  columnName?: string;
  id?: string;
  name: string;
  owner?: EntityReference;
  results?: TestCaseResult[];
  testCase: {
    config?: TestCaseConfigType;
    tableTestType?: TableTestType;
    columnTestType?: ColumnTestType;
  };
  updatedAt?: number;
  updatedBy?: string;
}
