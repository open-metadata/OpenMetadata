/*
 *  Copyright 2026 Collate.
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
import { applyPatch } from 'fast-json-patch';
import { Table } from '../../../../generated/entity/data/table';
import {
  IngestionPipeline,
  LogLevels,
  PipelineType,
} from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { TestCase } from '../../../../generated/tests/testCase';
import { TestSuite } from '../../../../generated/tests/testSuite';
import {
  buildTestSuiteIngestionPatch,
  buildTestSuiteIngestionPayload,
  getTestSuitePipelineFormDefaults,
  getTestSuitePipelineScope,
  toTestSuiteIngestionData,
} from './TestSuitePipelineForm.utils';

const PIPELINE = {
  id: 'pipe-id',
  name: 'pipe',
  displayName: 'Nightly',
  pipelineType: PipelineType.TestSuite,
  loggerLevel: LogLevels.Debug,
  raiseOnError: false,
  service: { id: 'suite-id', type: 'testSuite' },
  airflowConfig: { scheduleInterval: '0 0 * * *' },
  sourceConfig: {
    config: {
      entityFullyQualifiedName: 'svc.db.schema.orders',
      testCases: ['tc_a'],
    },
  },
} as IngestionPipeline;

describe('toTestSuiteIngestionData', () => {
  it('maps test case objects and names to names', () => {
    expect(
      toTestSuiteIngestionData({
        // The picker hands back test case objects although the form type
        // declares names; the mapping must accept both.
        testCases: [{ name: 'tc_a' } as TestCase as unknown as string, 'tc_b'],
      }).testCases
    ).toEqual(['tc_a', 'tc_b']);
  });

  it('sends no test case list when none is selected', () => {
    expect(
      toTestSuiteIngestionData({ testCases: [] }).testCases
    ).toBeUndefined();
    expect(toTestSuiteIngestionData({}).testCases).toBeUndefined();
  });

  it('treats a picker select-all payload as "run all"', () => {
    const result = toTestSuiteIngestionData({
      selectAllTestCases: false,
      testCases: {
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
      } as unknown as string[],
    });

    expect(result.testCases).toBeUndefined();
    expect(result.selectAllTestCases).toBe(true);
  });

  it('does not treat a select-all with exclusions as "run all"', () => {
    const result = toTestSuiteIngestionData({
      selectAllTestCases: false,
      testCases: {
        selectAll: true,
        includeIds: [],
        excludeIds: ['tc-excluded'],
        testCases: [],
      } as unknown as string[],
    });

    // The pipeline config has no field for excludeIds, so a select-all with
    // exclusions must not collapse to "run all" (it would run the excluded
    // rows). Validation rejects this payload before submit; this test guards
    // the submit side against silently widening it.
    expect(result.testCases).toBeUndefined();
    expect(result.selectAllTestCases).toBe(false);
  });

  it('preserves selectAllTestCases when already true', () => {
    const result = toTestSuiteIngestionData({
      selectAllTestCases: true,
      testCases: undefined,
    });

    expect(result.testCases).toBeUndefined();
    expect(result.selectAllTestCases).toBe(true);
  });

  it('keeps specific test cases when selectAll is false in the payload', () => {
    const result = toTestSuiteIngestionData({
      selectAllTestCases: false,
      testCases: {
        selectAll: false,
        includeIds: ['id-1'],
        excludeIds: [],
        testCases: [{ id: 'id-1', name: 'tc_a' }],
      } as unknown as string[],
    });

    expect(result.testCases).toEqual(['tc_a']);
    expect(result.selectAllTestCases).toBe(false);
  });
});

describe('getTestSuitePipelineScope', () => {
  it("scopes a table's basic suite by the table", () => {
    expect(
      getTestSuitePipelineScope({
        table: {
          fullyQualifiedName: 'svc.db.schema.orders',
          testSuite: { id: 'basic-id', type: 'testSuite' },
        } as Table,
      })
    ).toEqual({
      testSuiteId: 'basic-id',
      tableFqn: 'svc.db.schema.orders',
      nameFqn: 'svc.db.schema.orders',
    });
  });

  it('scopes a basic suite by its table reference', () => {
    expect(
      getTestSuitePipelineScope({
        testSuite: {
          id: 'basic-id',
          basic: true,
          basicEntityReference: {
            id: 't',
            type: 'table',
            fullyQualifiedName: 'svc.db.schema.orders',
          },
        } as TestSuite,
      }).tableFqn
    ).toBe('svc.db.schema.orders');
  });

  it('scopes a bundle suite by its id, with no table', () => {
    expect(
      getTestSuitePipelineScope({
        testSuite: {
          id: 'bundle-id',
          basic: false,
          fullyQualifiedName: 'nightly_bundle',
        } as TestSuite,
      })
    ).toEqual({
      testSuiteId: 'bundle-id',
      tableFqn: undefined,
      nameFqn: 'nightly_bundle',
    });
  });

  it('reads the table and suite from the edited pipeline', () => {
    expect(getTestSuitePipelineScope({ ingestionPipeline: PIPELINE })).toEqual({
      testSuiteId: 'suite-id',
      tableFqn: 'svc.db.schema.orders',
      nameFqn: 'svc.db.schema.orders',
    });
  });
});

describe('getTestSuitePipelineFormDefaults', () => {
  it('uses blank values and the default schedule for a new pipeline', () => {
    expect(getTestSuitePipelineFormDefaults(undefined, '0 1 * * *')).toEqual({
      cron: '0 1 * * *',
      enableDebugLog: false,
      raiseOnError: true,
      selectAllTestCases: false,
    });
  });

  it('prefills the edited pipeline', () => {
    expect(getTestSuitePipelineFormDefaults(PIPELINE, '0 1 * * *')).toEqual({
      cron: '0 0 * * *',
      enableDebugLog: true,
      name: 'Nightly',
      raiseOnError: false,
      selectAllTestCases: false,
      testCases: ['tc_a'],
    });
  });

  it('selects all test cases for a pipeline without a test case list', () => {
    expect(
      getTestSuitePipelineFormDefaults(
        {
          ...PIPELINE,
          sourceConfig: { config: { entityFullyQualifiedName: 'x' } },
        } as IngestionPipeline,
        undefined
      ).selectAllTestCases
    ).toBe(true);
  });
});

describe('buildTestSuiteIngestionPayload', () => {
  it('names the pipeline from the table when Name is empty', () => {
    const payload = buildTestSuiteIngestionPayload(
      { name: '', cron: '0 0 * * *', raiseOnError: true },
      {
        testSuiteId: 'suite-id',
        nameFqn: 'svc.db.schema.orders',
        entityFqn: 'svc.db.schema.orders',
      }
    );

    expect(payload.displayName).toContain('orders');
    expect(payload.service).toEqual({ id: 'suite-id', type: 'testSuite' });
    expect(payload.sourceConfig.config).toEqual(
      expect.objectContaining({
        entityFullyQualifiedName: 'svc.db.schema.orders',
      })
    );
  });
});

describe('buildTestSuiteIngestionPatch', () => {
  it('patches only what the form edits', () => {
    const patch = buildTestSuiteIngestionPatch(PIPELINE, {
      name: 'Hourly',
      cron: '0 * * * *',
      enableDebugLog: false,
      raiseOnError: true,
      testCases: undefined,
    });
    const updated = applyPatch(structuredClone(PIPELINE), patch).newDocument;

    expect(updated).toEqual({
      ...PIPELINE,
      displayName: 'Hourly',
      loggerLevel: LogLevels.Info,
      raiseOnError: true,
      airflowConfig: { scheduleInterval: '0 * * * *' },
      sourceConfig: {
        config: { entityFullyQualifiedName: 'svc.db.schema.orders' },
      },
    });
  });

  it('keeps the display name when Name is cleared', () => {
    const patch = buildTestSuiteIngestionPatch(PIPELINE, {
      name: '',
      cron: '0 0 * * *',
      enableDebugLog: true,
      raiseOnError: false,
      testCases: ['tc_a'],
    });

    expect(patch).toEqual([]);
  });
});
