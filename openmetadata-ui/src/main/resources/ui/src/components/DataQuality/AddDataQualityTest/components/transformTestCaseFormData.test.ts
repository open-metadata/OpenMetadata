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

import { TestCase } from '../../../../generated/tests/testCase';
import {
  TestDataType,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import { TestLevel } from './TestCaseFormV1.interface';
import {
  buildEditDefaults,
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

describe('buildEditDefaults', () => {
  const tableLevelDefinition = {
    id: 'def-1',
    name: 'tableRowCountToEqual',
    fullyQualifiedName: 'tableRowCountToEqual',
    parameterDefinition: [{ name: 'value', dataType: TestDataType.String }],
  } as unknown as TestDefinition;

  it('builds table-level scalar defaults from a TestCase', () => {
    const testCase = {
      name: 'my_test',
      displayName: 'My Test',
      description: 'a description',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: {
        id: 'def-1',
        name: 'tableRowCountToEqual',
        fullyQualifiedName: 'tableRowCountToEqual',
      },
      parameterValues: [{ name: 'value', value: '10' }],
      computePassedFailedRowCount: true,
      useDynamicAssertion: false,
      tags: [],
    } as unknown as TestCase;

    const result = buildEditDefaults(testCase, tableLevelDefinition);

    expect(result.testLevel).toBe(TestLevel.TABLE);
    expect(result.selectedTable).toBe('t');
    expect(result.selectedColumn).toBeUndefined();
    expect(result.testTypeId).toEqual({
      id: 'tableRowCountToEqual',
      label: 'tableRowCountToEqual',
    });
    expect(result.params).toEqual({ value: '10' });
    expect(result.name).toBe('my_test');
    expect(result.displayName).toBe('My Test');
    expect(result.description).toBe('a description');
    expect(result.computePassedFailedRowCount).toBe(true);
    expect(result.useDynamicAssertion).toBe(false);
    expect(result.tags).toEqual([]);
    expect(result.glossaryTerms).toEqual([]);
  });

  it('sets selectedColumn and COLUMN testLevel for a column-level entityLink', () => {
    const testCase = {
      name: 'col_test',
      entityLink: '<#E::table::svc.db.sch.t::columns::email>',
      testDefinition: {
        id: 'def-2',
        name: 'columnValuesToBeNotNull',
        fullyQualifiedName: 'columnValuesToBeNotNull',
      },
      parameterValues: [],
      tags: [],
    } as unknown as TestCase;

    const definition = {
      id: 'def-2',
      name: 'columnValuesToBeNotNull',
      fullyQualifiedName: 'columnValuesToBeNotNull',
      parameterDefinition: [],
    } as unknown as TestDefinition;

    const result = buildEditDefaults(testCase, definition);

    expect(result.testLevel).toBe(TestLevel.COLUMN);
    expect(result.selectedTable).toBe('t');
    expect(result.selectedColumn).toBe('email');
  });

  it('derives COLUMN_DIMENSION testLevel when dimensionColumns are present', () => {
    const testCase = {
      name: 'dim_test',
      entityLink: '<#E::table::svc.db.sch.t::columns::email>',
      testDefinition: {
        id: 'def-2',
        name: 'columnValuesToBeNotNull',
        fullyQualifiedName: 'columnValuesToBeNotNull',
      },
      parameterValues: [],
      dimensionColumns: ['country'],
      topDimensions: 5,
      tags: [],
    } as unknown as TestCase;

    const definition = {
      id: 'def-2',
      name: 'columnValuesToBeNotNull',
      fullyQualifiedName: 'columnValuesToBeNotNull',
      parameterDefinition: [],
    } as unknown as TestDefinition;

    const result = buildEditDefaults(testCase, definition);

    expect(result.testLevel).toBe(TestLevel.COLUMN_DIMENSION);
    expect(result.dimensionColumns).toEqual(['country']);
    expect(result.topDimensions).toBe(5);
  });

  it('parses an Array param JSON value into [{ value }] entries', () => {
    const testCase = {
      name: 'array_param_test',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: {
        id: 'def-3',
        name: 'columnValuesToBeInSet',
        fullyQualifiedName: 'columnValuesToBeInSet',
      },
      parameterValues: [{ name: 'allowedValues', value: '["a","b","c"]' }],
      tags: [],
    } as unknown as TestCase;

    const definition = {
      id: 'def-3',
      name: 'columnValuesToBeInSet',
      fullyQualifiedName: 'columnValuesToBeInSet',
      parameterDefinition: [
        { name: 'allowedValues', dataType: TestDataType.Array },
      ],
    } as unknown as TestDefinition;

    const result = buildEditDefaults(testCase, definition);

    expect(result.params).toEqual({
      allowedValues: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
    });
  });

  it('parses a Boolean param "true" string into a boolean', () => {
    const testCase = {
      name: 'bool_param_test',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: {
        id: 'def-4',
        name: 'someBooleanTest',
        fullyQualifiedName: 'someBooleanTest',
      },
      parameterValues: [{ name: 'strict', value: 'true' }],
      tags: [],
    } as unknown as TestCase;

    const definition = {
      id: 'def-4',
      name: 'someBooleanTest',
      fullyQualifiedName: 'someBooleanTest',
      parameterDefinition: [{ name: 'strict', dataType: TestDataType.Boolean }],
    } as unknown as TestDefinition;

    const result = buildEditDefaults(testCase, definition);

    expect(result.params).toEqual({ strict: true });
  });

  it('splits tags into tags/glossaryTerms and filters out the tier tag', () => {
    const testCase = {
      name: 'tag_test',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: {
        id: 'def-1',
        name: 'tableRowCountToEqual',
        fullyQualifiedName: 'tableRowCountToEqual',
      },
      parameterValues: [],
      tags: [
        { tagFQN: 'Tier.Tier1', source: 'Classification' },
        { tagFQN: 'PII.Sensitive', source: 'Classification' },
        { tagFQN: 'GlossaryTerm.example', source: 'Glossary' },
      ],
    } as unknown as TestCase;

    const result = buildEditDefaults(testCase, tableLevelDefinition);

    expect(result.tags).toHaveLength(1);
    expect(result.tags?.[0].tagFQN).toBe('PII.Sensitive');
    expect(result.glossaryTerms).toHaveLength(1);
    expect(result.glossaryTerms?.[0].tagFQN).toBe('GlossaryTerm.example');
    expect(result.tags?.some((tag) => tag.tagFQN === 'Tier.Tier1')).toBe(false);
  });
});
