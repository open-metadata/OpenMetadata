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

import { TestLevel } from './TestCaseFormV1.interface';
import {
  buildTestSuitePipelinePayload,
  transformTestCaseFormData,
} from './transformTestCaseFormData';

describe('transformTestCaseFormData', () => {
  it('builds a table-level CreateTestCase with generated entityLink and merged tags', () => {
    const result = transformTestCaseFormData(
      {
        testLevel: TestLevel.TABLE,
        testTypeId: 'tableRowCountToEqual',
        testName: 'my_test',
        tags: [{ tagFQN: 'PII.Sensitive' } as any],
        glossaryTerms: [{ tagFQN: 'g.term' } as any],
        computePassedFailedRowCount: true,
      },
      {
        selectedTestLevel: TestLevel.TABLE,
        selectedTableData: {
          fullyQualifiedName: 'svc.db.sch.t',
          columns: [],
        } as any,
      }
    );

    expect(result.name).toBe('my_test');
    expect(result.entityLink).toBe('<#E::table::svc.db.sch.t>');
    expect(result.testDefinition).toBe('tableRowCountToEqual');
    expect(result.tags).toHaveLength(2);
    expect(result.computePassedFailedRowCount).toBe(true);
  });

  it('builds a column-level entityLink with isColumnLevel=true', () => {
    const result = transformTestCaseFormData(
      { testLevel: TestLevel.COLUMN, testTypeId: 'columnValuesToBeNotNull' },
      {
        selectedTestLevel: TestLevel.COLUMN,
        selectedColumn: 'email',
        selectedTableData: {
          fullyQualifiedName: 'svc.db.sch.t',
          columns: [],
        } as any,
      }
    );

    expect(result.entityLink).toBe('<#E::table::svc.db.sch.t::columns::email>');
  });

  it('uses ctx.selectedTable FQN when selectedTableData is undefined', () => {
    const result = transformTestCaseFormData(
      { testLevel: TestLevel.TABLE, testTypeId: 'x', testName: 'n' } as any,
      {
        selectedTestLevel: TestLevel.TABLE,
        selectedTable: 'svc.db.sch.only_string',
      }
    );

    expect(result.entityLink).toBe('<#E::table::svc.db.sch.only_string>');
  });

  it('falls back to generateName when testName is empty', () => {
    const result = transformTestCaseFormData(
      { testLevel: TestLevel.TABLE, testTypeId: 'x', testName: '  ' } as any,
      {
        selectedTestLevel: TestLevel.TABLE,
        selectedTableData: { fullyQualifiedName: 't', columns: [] } as any,
        generateName: () => 'generated_name_123',
      }
    );

    expect(result.name).toBe('generated_name_123');
    expect(result.displayName).toBe('generated_name_123');
  });

  it('normalizes a select-valued param into an unwrapped parameterValue', () => {
    const result = transformTestCaseFormData(
      {
        testLevel: TestLevel.COLUMN,
        testTypeId: 'columnValuesToBeInSet',
        params: { columnName: { id: 'email', label: 'email' } },
      } as any,
      {
        selectedTestLevel: TestLevel.COLUMN,
        selectedColumn: 'email',
        selectedTableData: { fullyQualifiedName: 't', columns: [] } as any,
        selectedDefinition: {
          parameterDefinition: [{ name: 'columnName' }],
        } as any,
      }
    );

    expect(result.parameterValues).toEqual([
      { name: 'columnName', value: 'email' },
    ]);
    expect(result.parameterValues?.[0].value).not.toBe('[object Object]');
  });

  it('passes COLUMN_DIMENSION dimensions/topDimensions through', () => {
    const result = transformTestCaseFormData(
      {
        testLevel: TestLevel.COLUMN_DIMENSION,
        testTypeId: 'x',
        dimensionColumns: ['a', 'b'],
        topDimensions: 5,
      },
      {
        selectedTestLevel: TestLevel.COLUMN,
        selectedColumn: 'c',
        selectedTableData: { fullyQualifiedName: 't', columns: [] } as any,
      }
    );

    expect(result.dimensionColumns).toEqual(['a', 'b']);
    expect(result.topDimensions).toBe(5);
  });

  it('unwraps a FormSelectItem testTypeId into a plain testDefinition FQN string', () => {
    const result = transformTestCaseFormData(
      {
        testLevel: TestLevel.COLUMN,
        testTypeId: {
          id: 'columnValuesToBeBetween',
          label: 'Column Values To Be Between',
        },
      } as any,
      {
        selectedTestLevel: TestLevel.COLUMN,
        selectedColumn: 'email',
        selectedTableData: { fullyQualifiedName: 't', columns: [] } as any,
      }
    );

    expect(result.testDefinition).toBe('columnValuesToBeBetween');
    expect(typeof result.testDefinition).toBe('string');
  });

  it('unwraps the custom-query FormSelectItem testTypeId to its id string', () => {
    const result = transformTestCaseFormData(
      {
        testLevel: TestLevel.TABLE,
        testTypeId: { id: 'tableCustomSQLQuery' },
      } as any,
      {
        selectedTestLevel: TestLevel.TABLE,
        selectedTableData: { fullyQualifiedName: 't', columns: [] } as any,
      }
    );

    expect(result.testDefinition).toBe('tableCustomSQLQuery');
  });

  it('unwraps a FormSelectItem[] dimensionColumns into a string[]', () => {
    const result = transformTestCaseFormData(
      {
        testLevel: TestLevel.COLUMN_DIMENSION,
        testTypeId: { id: 'x' },
        dimensionColumns: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
        topDimensions: 3,
      } as any,
      {
        selectedTestLevel: TestLevel.COLUMN,
        selectedColumn: 'c',
        selectedTableData: { fullyQualifiedName: 't', columns: [] } as any,
      }
    );

    expect(result.dimensionColumns).toEqual(['a', 'b']);
    expect(result.topDimensions).toBe(3);
  });
});

describe('buildTestSuitePipelinePayload', () => {
  it('uses selected test cases when selectAllTestCases is false', () => {
    const payload = buildTestSuitePipelinePayload(
      {
        cron: '0 0 * * *',
        selectAllTestCases: false,
        testCases: [{ name: 'tc2' } as any],
        enableDebugLog: true,
        raiseOnError: false,
      } as any,
      {
        testSuite: { id: 's1', fullyQualifiedName: 'suite.fqn' } as any,
        createdTestCaseName: 'tc1',
        selectedTable: 'svc.db.sch.t',
      }
    );

    expect(payload.pipelineType).toBe('TestSuite');
    expect(payload.sourceConfig.config!.testCases).toEqual(['tc1', 'tc2']);
    expect(payload.loggerLevel).toBe('DEBUG');
    expect(payload.raiseOnError).toBe(false);
  });

  it('omits testCases when selectAllTestCases is true', () => {
    const payload = buildTestSuitePipelinePayload(
      { cron: '0 0 * * *', selectAllTestCases: true } as any,
      {
        testSuite: { id: 's1', fullyQualifiedName: 'suite.fqn' } as any,
        createdTestCaseName: 'tc1',
      }
    );

    expect(payload.sourceConfig.config!.testCases).toBeUndefined();
  });
});
