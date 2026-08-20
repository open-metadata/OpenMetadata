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

import { Table } from '../../../../generated/entity/data/table';
import { TestCase } from '../../../../generated/tests/testCase';
import {
  TestDataType,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import { TestSuite } from '../../../../generated/tests/testSuite';
import { EntityReference } from '../../../../generated/type/entityReference';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../../generated/type/tagLabel';
import { normalizeParamsForPayload } from '../../../../utils/ParameterForm/ParameterFieldsUtils';
import { TestLevel } from './TestCaseFormV1.interface';
import {
  buildEditDefaults,
  buildTestSuitePipelinePayload,
  transformTestCaseFormData,
} from './transformTestCaseFormData';

const makeTag = (tagFQN: string): TagLabel => ({
  tagFQN,
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
});

const makeTable = (fullyQualifiedName: string): Table =>
  ({ fullyQualifiedName, columns: [] } as unknown as Table);

const makeTestSuite = (id: string, fullyQualifiedName: string): TestSuite =>
  ({ id, fullyQualifiedName } as unknown as TestSuite);

const makeDefinition = (
  parameterDefinition: Array<{ name: string }>
): TestDefinition => ({ parameterDefinition } as unknown as TestDefinition);

describe('transformTestCaseFormData', () => {
  it('builds a table-level CreateTestCase with generated entityLink and merged tags', () => {
    const result = transformTestCaseFormData(
      {
        testLevel: TestLevel.TABLE,
        testTypeId: 'tableRowCountToEqual',
        testName: 'my_test',
        tags: [makeTag('PII.Sensitive')],
        glossaryTerms: [makeTag('g.term')],
        computePassedFailedRowCount: true,
      },
      {
        selectedTestLevel: TestLevel.TABLE,
        selectedTableData: makeTable('svc.db.sch.t'),
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
        selectedTableData: makeTable('svc.db.sch.t'),
      }
    );

    expect(result.entityLink).toBe('<#E::table::svc.db.sch.t::columns::email>');
  });

  it('uses ctx.selectedTable FQN when selectedTableData is undefined', () => {
    const result = transformTestCaseFormData(
      { testLevel: TestLevel.TABLE, testTypeId: 'x', testName: 'n' },
      {
        selectedTestLevel: TestLevel.TABLE,
        selectedTable: 'svc.db.sch.only_string',
      }
    );

    expect(result.entityLink).toBe('<#E::table::svc.db.sch.only_string>');
  });

  it('falls back to generateName when testName is empty', () => {
    const result = transformTestCaseFormData(
      { testLevel: TestLevel.TABLE, testTypeId: 'x', testName: '  ' },
      {
        selectedTestLevel: TestLevel.TABLE,
        selectedTableData: makeTable('t'),
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
      },
      {
        selectedTestLevel: TestLevel.COLUMN,
        selectedColumn: 'email',
        selectedTableData: makeTable('t'),
        selectedDefinition: makeDefinition([{ name: 'columnName' }]),
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
        selectedTableData: makeTable('t'),
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
      },
      {
        selectedTestLevel: TestLevel.COLUMN,
        selectedColumn: 'email',
        selectedTableData: makeTable('t'),
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
      },
      {
        selectedTestLevel: TestLevel.TABLE,
        selectedTableData: makeTable('t'),
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
      },
      {
        selectedTestLevel: TestLevel.COLUMN,
        selectedColumn: 'c',
        selectedTableData: makeTable('t'),
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
        testLevel: TestLevel.TABLE,
        cron: '0 0 * * *',
        selectAllTestCases: false,
        testCases: [{ name: 'tc2' } as unknown as EntityReference],
        enableDebugLog: true,
        raiseOnError: false,
      },
      {
        testSuite: makeTestSuite('s1', 'suite.fqn'),
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
      {
        testLevel: TestLevel.TABLE,
        cron: '0 0 * * *',
        selectAllTestCases: true,
      },
      {
        testSuite: makeTestSuite('s1', 'suite.fqn'),
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
    expect(result.selectedTable).toEqual({
      id: 'svc.db.sch.t',
      label: 'svc.db.sch.t',
    });
    expect(result.selectedColumn).toBeUndefined();
    expect(result.testTypeId).toEqual({
      id: 'tableRowCountToEqual',
      label: 'tableRowCountToEqual',
    });
    expect(result.params).toEqual({ value: '10' });
    expect(result.testName).toBe('my_test');
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
    expect(result.selectedTable).toEqual({
      id: 'svc.db.sch.t',
      label: 'svc.db.sch.t',
    });
    expect(result.selectedColumn).toEqual({ id: 'email', label: 'email' });
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
    expect(result.dimensionColumns).toEqual([
      { id: 'country', label: 'country' },
    ]);
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

  it('prefills tags/glossaryTerms as TagLabel[] (the shape TagSuggestion consumes), not FormSelectItem[] (regression)', () => {
    // TagSuggestion.tsx reads `value: TagLabel[]` directly off each entry
    // (tag.tagFQN, tag.displayName, tag.name, tag.source) to build its
    // selectedItems — a bare `{ id, label }` FormSelectItem would render
    // blank chips, exactly like the selectedTable/selectedColumn bug this
    // mirrors.
    const testCase = {
      name: 'tag_shape_test',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: {
        id: 'def-1',
        name: 'tableRowCountToEqual',
        fullyQualifiedName: 'tableRowCountToEqual',
      },
      parameterValues: [],
      tags: [
        {
          tagFQN: 'PII.Sensitive',
          source: 'Classification',
          name: 'Sensitive',
          displayName: 'Sensitive',
        },
        {
          tagFQN: 'GlossaryTerm.example',
          source: 'Glossary',
          name: 'example',
          displayName: 'Example Term',
        },
      ],
    } as unknown as TestCase;

    const result = buildEditDefaults(testCase, tableLevelDefinition);

    expect(result.tags).toEqual([
      {
        tagFQN: 'PII.Sensitive',
        source: 'Classification',
        name: 'Sensitive',
        displayName: 'Sensitive',
      },
    ]);
    expect(result.glossaryTerms).toEqual([
      {
        tagFQN: 'GlossaryTerm.example',
        source: 'Glossary',
        name: 'example',
        displayName: 'Example Term',
      },
    ]);
    // Guard against a FormSelectItem-shaped regression: TagLabel has no
    // `id`/`label` keys, it has `tagFQN`.
    expect(result.tags?.[0]).not.toHaveProperty('id');
    expect(result.tags?.[0]).not.toHaveProperty('label');
    expect(result.glossaryTerms?.[0]).not.toHaveProperty('id');
    expect(result.glossaryTerms?.[0]).not.toHaveProperty('label');
  });

  it('locks testLevel/testName/displayName/description as plain primitive values, not wrapped objects (regression)', () => {
    // testLevel binds to SelectionCardGroup's `value`/`onChange` directly (a
    // raw TestLevel string); testName/displayName are FieldTypes.TEXT
    // (plain string); description feeds RichTextEditor's `initialValue`
    // (plain markdown string) — none of these are FormSelectItem-shaped.
    const testCase = {
      name: 'primitive_shape_test',
      displayName: 'Primitive Shape Test',
      description: 'plain markdown description',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: {
        id: 'def-1',
        name: 'tableRowCountToEqual',
        fullyQualifiedName: 'tableRowCountToEqual',
      },
      parameterValues: [],
      tags: [],
    } as unknown as TestCase;

    const result = buildEditDefaults(testCase, tableLevelDefinition);

    expect(result.testLevel).toBe(TestLevel.TABLE);
    expect(typeof result.testLevel).toBe('string');
    expect(result.testName).toBe('primitive_shape_test');
    expect(typeof result.testName).toBe('string');
    expect(result.displayName).toBe('Primitive Shape Test');
    expect(typeof result.displayName).toBe('string');
    expect(result.description).toBe('plain markdown description');
    expect(typeof result.description).toBe('string');
  });

  it('prefills selectedColumn as a FormSelectItem for a column-level test with a Set param (regression)', () => {
    const testCase = {
      name: 'values_in_set_edit',
      entityLink: '<#E::table::svc.db.sch.t::columns::status>',
      testDefinition: {
        id: 'def-set',
        name: 'columnValuesToBeInSet',
        fullyQualifiedName: 'columnValuesToBeInSet',
      },
      parameterValues: [
        { name: 'allowedValues', value: '["active","inactive"]' },
      ],
      tags: [],
    } as unknown as TestCase;

    const definition = {
      id: 'def-set',
      name: 'columnValuesToBeInSet',
      fullyQualifiedName: 'columnValuesToBeInSet',
      parameterDefinition: [
        { name: 'allowedValues', dataType: TestDataType.Set },
      ],
    } as unknown as TestDefinition;

    const result = buildEditDefaults(testCase, definition);

    expect(result.selectedColumn).toEqual({ id: 'status', label: 'status' });
    expect(result.params?.allowedValues).toEqual([
      { value: 'active' },
      { value: 'inactive' },
    ]);
  });

  it('prefills dimensionColumns as FormSelectItem[] for a dimension-level test (regression)', () => {
    const testCase = {
      name: 'dim_prefill_test',
      entityLink: '<#E::table::svc.db.sch.t::columns::email>',
      testDefinition: {
        id: 'def-2',
        name: 'columnValuesToBeNotNull',
        fullyQualifiedName: 'columnValuesToBeNotNull',
      },
      parameterValues: [],
      dimensionColumns: ['country', 'region'],
      topDimensions: 10,
      tags: [],
    } as unknown as TestCase;

    const definition = {
      id: 'def-2',
      name: 'columnValuesToBeNotNull',
      fullyQualifiedName: 'columnValuesToBeNotNull',
      parameterDefinition: [],
    } as unknown as TestDefinition;

    const result = buildEditDefaults(testCase, definition);

    expect(result.dimensionColumns).toEqual([
      { id: 'country', label: 'country' },
      { id: 'region', label: 'region' },
    ]);
    expect(result.topDimensions).toBe(10);
  });
});

describe('buildEditDefaults for tableDiff', () => {
  const tableDiffDefinition = {
    id: 'def-tablediff',
    name: 'tableDiff',
    fullyQualifiedName: 'tableDiff',
    parameterDefinition: [
      { name: 'table2', dataType: TestDataType.String },
      { name: 'keyColumns', dataType: TestDataType.Array },
      { name: 'table2.keyColumns', dataType: TestDataType.Array },
      { name: 'threshold', dataType: TestDataType.Number },
      { name: 'caseSensitiveColumns', dataType: TestDataType.Boolean },
    ],
  } as unknown as TestDefinition;

  const tableDiffTestCase = {
    name: 'table_diff_test',
    entityLink: '<#E::table::svc.db.sch.t>',
    testDefinition: {
      id: 'def-tablediff',
      name: 'tableDiff',
      fullyQualifiedName: 'tableDiff',
    },
    parameterValues: [
      { name: 'table2', value: 'svc.db.sch.t2' },
      { name: 'keyColumns', value: '["id","name"]' },
      { name: 'table2.keyColumns', value: '["id2"]' },
      { name: 'threshold', value: '0' },
      { name: 'caseSensitiveColumns', value: 'true' },
    ],
    tags: [],
  } as unknown as TestCase;

  it('prefills the table2 select param as a FormSelectItem', () => {
    const result = buildEditDefaults(tableDiffTestCase, tableDiffDefinition);

    expect(result.params?.table2).toEqual({
      id: 'svc.db.sch.t2',
      label: 'svc.db.sch.t2',
    });
  });

  it('prefills dotted column-array params under their sanitized key', () => {
    const result = buildEditDefaults(tableDiffTestCase, tableDiffDefinition);

    expect(result.params).toHaveProperty('table2___keyColumns');
    expect(result.params?.table2___keyColumns).toEqual([
      { value: { id: 'id2', label: 'id2' } },
    ]);
  });

  it('prefills the keyColumns column-array param with FormSelectItem rows', () => {
    const result = buildEditDefaults(tableDiffTestCase, tableDiffDefinition);

    expect(result.params?.keyColumns).toEqual([
      { value: { id: 'id', label: 'id' } },
      { value: { id: 'name', label: 'name' } },
    ]);
  });

  it('prefills scalar and boolean params unchanged', () => {
    const result = buildEditDefaults(tableDiffTestCase, tableDiffDefinition);

    expect(result.params?.threshold).toBe('0');
    expect(result.params?.caseSensitiveColumns).toBe(true);
  });

  it('round-trips through normalizeParamsForPayload back to the original parameterValues', () => {
    const editParams = buildEditDefaults(
      tableDiffTestCase,
      tableDiffDefinition
    ).params;

    const roundTripped = normalizeParamsForPayload(
      editParams as Record<string, unknown>,
      tableDiffDefinition
    );

    expect(roundTripped).toEqual({
      table2: 'svc.db.sch.t2',
      keyColumns: [{ value: 'id' }, { value: 'name' }],
      'table2.keyColumns': [{ value: 'id2' }],
      threshold: '0',
      caseSensitiveColumns: true,
    });
  });
});

/**
 * Round-trip guard: `normalizeParamsForPayload(buildEditParams(testCase,
 * definition), definition)` must reproduce the original `parameterValues`.
 * Covers every param-prefill shape `ParameterFields`/`TableDiffFields` can
 * render as a SELECT (or other non-scalar) field, not just tableDiff's
 * `table2`.
 */
describe('buildEditDefaults round-trip across representative test types', () => {
  const roundTrip = (
    testCase: TestCase,
    definition: TestDefinition
  ): Record<string, unknown> | undefined => {
    const editParams = buildEditDefaults(testCase, definition).params;

    return normalizeParamsForPayload(
      editParams as Record<string, unknown>,
      definition
    );
  };

  it('tableRowCountToBeBetween: numeric min/max scalars round-trip', () => {
    const definition = {
      name: 'tableRowCountToBeBetween',
      fullyQualifiedName: 'tableRowCountToBeBetween',
      parameterDefinition: [
        { name: 'minValue', dataType: TestDataType.Int },
        { name: 'maxValue', dataType: TestDataType.Int },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'row_count_between',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: { fullyQualifiedName: 'tableRowCountToBeBetween' },
      parameterValues: [
        { name: 'minValue', value: '10' },
        { name: 'maxValue', value: '100' },
      ],
      tags: [],
    } as unknown as TestCase;

    expect(roundTrip(testCase, definition)).toEqual({
      minValue: '10',
      maxValue: '100',
    });
  });

  it('tableColumnCountToBeBetween: numeric scalars round-trip', () => {
    const definition = {
      name: 'tableColumnCountToBeBetween',
      fullyQualifiedName: 'tableColumnCountToBeBetween',
      parameterDefinition: [
        { name: 'minColValue', dataType: TestDataType.Int },
        { name: 'maxColValue', dataType: TestDataType.Int },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'col_count_between',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: { fullyQualifiedName: 'tableColumnCountToBeBetween' },
      parameterValues: [
        { name: 'minColValue', value: '1' },
        { name: 'maxColValue', value: '20' },
      ],
      tags: [],
    } as unknown as TestCase;

    expect(roundTrip(testCase, definition)).toEqual({
      minColValue: '1',
      maxColValue: '20',
    });
  });

  it('columnValuesToBeBetween: numeric column-level params round-trip', () => {
    const definition = {
      name: 'columnValuesToBeBetween',
      fullyQualifiedName: 'columnValuesToBeBetween',
      parameterDefinition: [
        { name: 'minValue', dataType: TestDataType.Number },
        { name: 'maxValue', dataType: TestDataType.Number },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'col_values_between',
      entityLink: '<#E::table::svc.db.sch.t::columns::amount>',
      testDefinition: { fullyQualifiedName: 'columnValuesToBeBetween' },
      parameterValues: [
        { name: 'minValue', value: '0' },
        { name: 'maxValue', value: '1000' },
      ],
      tags: [],
    } as unknown as TestCase;

    expect(roundTrip(testCase, definition)).toEqual({
      minValue: '0',
      maxValue: '1000',
    });
  });

  it('columnValuesToMatchRegex: string param round-trips', () => {
    const definition = {
      name: 'columnValuesToMatchRegex',
      fullyQualifiedName: 'columnValuesToMatchRegex',
      parameterDefinition: [{ name: 'regex', dataType: TestDataType.String }],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'match_regex',
      entityLink: '<#E::table::svc.db.sch.t::columns::email>',
      testDefinition: { fullyQualifiedName: 'columnValuesToMatchRegex' },
      parameterValues: [{ name: 'regex', value: '^[a-z]+@[a-z]+\\.com$' }],
      tags: [],
    } as unknown as TestCase;

    expect(roundTrip(testCase, definition)).toEqual({
      regex: '^[a-z]+@[a-z]+\\.com$',
    });
  });

  it('columnValuesToBeInSet: generic Array/Set param round-trips as string rows', () => {
    const definition = {
      name: 'columnValuesToBeInSet',
      fullyQualifiedName: 'columnValuesToBeInSet',
      parameterDefinition: [
        { name: 'allowedValues', dataType: TestDataType.Set },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'values_in_set',
      entityLink: '<#E::table::svc.db.sch.t::columns::status>',
      testDefinition: { fullyQualifiedName: 'columnValuesToBeInSet' },
      parameterValues: [
        { name: 'allowedValues', value: '["active","inactive"]' },
      ],
      tags: [],
    } as unknown as TestCase;

    const editParams = buildEditDefaults(testCase, definition).params;

    expect(editParams?.allowedValues).toEqual([
      { value: 'active' },
      { value: 'inactive' },
    ]);
    expect(roundTrip(testCase, definition)).toEqual({
      allowedValues: [{ value: 'active' }, { value: 'inactive' }],
    });
  });

  it('optionValues (enum SELECT) param prefills as a FormSelectItem and round-trips', () => {
    // Mirrors ParameterFields.getFieldProp: `data.optionValues?.length` forces
    // FieldTypes.SELECT regardless of dataType, so the RHF value is a
    // FormSelectItem, not a raw string.
    const definition = {
      name: 'tableDiff',
      fullyQualifiedName: 'columnValuesSumToBeBetween',
      parameterDefinition: [
        {
          name: 'strategy',
          dataType: TestDataType.String,
          optionValues: ['SUM', 'AVG', 'COUNT'],
        },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'enum_param_test',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: { fullyQualifiedName: 'columnValuesSumToBeBetween' },
      parameterValues: [{ name: 'strategy', value: 'AVG' }],
      tags: [],
    } as unknown as TestCase;

    const editParams = buildEditDefaults(testCase, definition).params;

    expect(editParams?.strategy).toEqual({ id: 'AVG', label: 'AVG' });
    expect(roundTrip(testCase, definition)).toEqual({ strategy: 'AVG' });
  });

  it('a "column" param prefills as a column SELECT FormSelectItem and round-trips', () => {
    // Mirrors ParameterFields.getStringFieldProp: `data.name === 'column'`
    // always renders FieldTypes.SELECT.
    const definition = {
      name: 'columnValuesToBeUnique',
      fullyQualifiedName: 'columnValuesToBeUnique',
      parameterDefinition: [{ name: 'column', dataType: TestDataType.String }],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'column_param_test',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: { fullyQualifiedName: 'columnValuesToBeUnique' },
      parameterValues: [{ name: 'column', value: 'user_id' }],
      tags: [],
    } as unknown as TestCase;

    const editParams = buildEditDefaults(testCase, definition).params;

    expect(editParams?.column).toEqual({ id: 'user_id', label: 'user_id' });
    expect(roundTrip(testCase, definition)).toEqual({ column: 'user_id' });
  });

  it('tableRowInsertedCountToBeBetween: columnName partition SELECT prefills as FormSelectItem and round-trips', () => {
    // Mirrors ParameterFields.getStringFieldProp: definition.name ===
    // 'tableRowInsertedCountToBeBetween' && data.name === 'columnName' forces
    // FieldTypes.SELECT.
    const definition = {
      name: 'tableRowInsertedCountToBeBetween',
      fullyQualifiedName: 'tableRowInsertedCountToBeBetween',
      parameterDefinition: [
        { name: 'columnName', dataType: TestDataType.String },
        { name: 'min', dataType: TestDataType.Int },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'partition_column_test',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: {
        fullyQualifiedName: 'tableRowInsertedCountToBeBetween',
      },
      parameterValues: [
        { name: 'columnName', value: 'created_at' },
        { name: 'min', value: '5' },
      ],
      tags: [],
    } as unknown as TestCase;

    const editParams = buildEditDefaults(testCase, definition).params;

    expect(editParams?.columnName).toEqual({
      id: 'created_at',
      label: 'created_at',
    });
    expect(roundTrip(testCase, definition)).toEqual({
      columnName: 'created_at',
      min: '5',
    });
  });

  it('tableDiff: table2 + keyColumns + table2.keyColumns round-trip (regression)', () => {
    const definition = {
      name: 'tableDiff',
      fullyQualifiedName: 'tableDiff',
      parameterDefinition: [
        { name: 'table2', dataType: TestDataType.String },
        { name: 'keyColumns', dataType: TestDataType.Array },
        { name: 'table2.keyColumns', dataType: TestDataType.Array },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'table_diff_regression',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: { fullyQualifiedName: 'tableDiff' },
      parameterValues: [
        { name: 'table2', value: 'svc.db.sch.t2' },
        { name: 'keyColumns', value: '["id"]' },
        { name: 'table2.keyColumns', value: '["id2"]' },
      ],
      tags: [],
    } as unknown as TestCase;

    expect(roundTrip(testCase, definition)).toEqual({
      table2: 'svc.db.sch.t2',
      keyColumns: [{ value: 'id' }],
      'table2.keyColumns': [{ value: 'id2' }],
    });
  });

  it('a Boolean param (e.g. computePassedFailedRowCount-style) prefills as boolean and round-trips', () => {
    const definition = {
      name: 'columnValuesToBeUnique',
      fullyQualifiedName: 'columnValuesToBeUnique',
      parameterDefinition: [
        { name: 'caseSensitiveColumns', dataType: TestDataType.Boolean },
      ],
    } as unknown as TestDefinition;

    const testCase = {
      name: 'bool_param_round_trip',
      entityLink: '<#E::table::svc.db.sch.t>',
      testDefinition: { fullyQualifiedName: 'columnValuesToBeUnique' },
      parameterValues: [{ name: 'caseSensitiveColumns', value: 'false' }],
      tags: [],
    } as unknown as TestCase;

    const editParams = buildEditDefaults(testCase, definition).params;

    expect(editParams?.caseSensitiveColumns).toBe(false);
    expect(roundTrip(testCase, definition)).toEqual({
      caseSensitiveColumns: false,
    });
  });
});
