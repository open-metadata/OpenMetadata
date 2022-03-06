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

export interface CreateColumnTest {
  id?: string;
  columnName: string;
  description?: string;
  executionFrequency?: TestCaseExecutionFrequency;
  owner?: EntityReference;
  testCase: {
    columnTestType: ColumnTestType;
    config?: TestCaseConfigType;
  };
}

export type DatabaseTestModeType = 'table' | 'column';

export interface ModifiedTableColumn extends Column {
  name: string;
  columnTests?: CreateColumnTest[];
}

export interface TestTableDataType {
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
