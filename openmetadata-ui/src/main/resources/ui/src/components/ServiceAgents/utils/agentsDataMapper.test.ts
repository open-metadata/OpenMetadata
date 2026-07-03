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

import { AgentStatus } from '../../../enums/ServiceInsights.enum';
import {
  IngestionPipeline,
  PipelineState,
  PipelineStatus,
  PipelineType,
  StepSummary,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { IngestionPipelineLogByIdInterface } from '../../../pages/LogsViewerPage/LogsViewerPage.interfaces';
import {
  getAgentTypeFromPipelineType,
  getAgentUnitVerb,
  getLogTaskFieldForType,
  mapPipelineStatusToRun,
  mapPipelineToAgent,
  mapStepSummaryToRunStep,
  parseLogLines,
  toRunStatus,
  toUiAgentStatus,
} from './agentsDataMapper';

describe('agentsDataMapper', () => {
  describe('getAgentTypeFromPipelineType', () => {
    it('should map Metadata pipeline type to Metadata agent type', () => {
      expect(getAgentTypeFromPipelineType(PipelineType.Metadata)).toBe(
        'Metadata'
      );
    });

    it('should map Usage pipeline type to Usage agent type', () => {
      expect(getAgentTypeFromPipelineType(PipelineType.Usage)).toBe('Usage');
    });

    it('should map Lineage pipeline type to Lineage agent type', () => {
      expect(getAgentTypeFromPipelineType(PipelineType.Lineage)).toBe(
        'Lineage'
      );
    });

    it('should map Profiler pipeline type to Profiler agent type', () => {
      expect(getAgentTypeFromPipelineType(PipelineType.Profiler)).toBe(
        'Profiler'
      );
    });

    it('should map AutoClassification pipeline type to Auto Classification agent type', () => {
      expect(
        getAgentTypeFromPipelineType(PipelineType.AutoClassification)
      ).toBe('Auto Classification');
    });

    it('should map Dbt pipeline type to dbt agent type', () => {
      expect(getAgentTypeFromPipelineType(PipelineType.Dbt)).toBe('dbt');
    });

    it('should fall back to Metadata for an unknown pipeline type', () => {
      expect(getAgentTypeFromPipelineType('unknownType' as PipelineType)).toBe(
        'Metadata'
      );
    });
  });

  describe('getAgentUnitVerb', () => {
    it('should return queries/scanned for Usage', () => {
      expect(getAgentUnitVerb(PipelineType.Usage)).toEqual({
        unit: 'queries',
        verb: 'scanned',
      });
    });

    it('should return queries/processed for Lineage', () => {
      expect(getAgentUnitVerb(PipelineType.Lineage)).toEqual({
        unit: 'queries',
        verb: 'processed',
      });
    });

    it('should return assets/ingested for Metadata', () => {
      expect(getAgentUnitVerb(PipelineType.Metadata)).toEqual({
        unit: 'assets',
        verb: 'ingested',
      });
    });

    it('should return assets/profiled for Profiler', () => {
      expect(getAgentUnitVerb(PipelineType.Profiler)).toEqual({
        unit: 'assets',
        verb: 'profiled',
      });
    });

    it('should return models/parsed for dbt', () => {
      expect(getAgentUnitVerb(PipelineType.Dbt)).toEqual({
        unit: 'models',
        verb: 'parsed',
      });
    });

    it('should default to assets/ingested for an unmapped type', () => {
      expect(getAgentUnitVerb(PipelineType.TestSuite)).toEqual({
        unit: 'assets',
        verb: 'ingested',
      });
    });
  });

  describe('toUiAgentStatus', () => {
    it('should map Running to running', () => {
      expect(toUiAgentStatus(AgentStatus.Running)).toBe('running');
    });

    it('should map Successful to success', () => {
      expect(toUiAgentStatus(AgentStatus.Successful)).toBe('success');
    });

    it('should map Failed to failed', () => {
      expect(toUiAgentStatus(AgentStatus.Failed)).toBe('failed');
    });

    it('should map Pending to queued', () => {
      expect(toUiAgentStatus(AgentStatus.Pending)).toBe('queued');
    });
  });

  describe('toRunStatus', () => {
    it('should map success to success', () => {
      expect(toRunStatus(PipelineState.Success)).toBe('success');
    });

    it('should map partialSuccess to partial', () => {
      expect(toRunStatus(PipelineState.PartialSuccess)).toBe('partial');
    });

    it('should map failed to failed', () => {
      expect(toRunStatus(PipelineState.Failed)).toBe('failed');
    });

    it('should map running to running', () => {
      expect(toRunStatus(PipelineState.Running)).toBe('running');
    });

    it('should map queued to skipped', () => {
      expect(toRunStatus(PipelineState.Queued)).toBe('skipped');
    });

    it('should map stopped to skipped', () => {
      expect(toRunStatus(PipelineState.Stopped)).toBe('skipped');
    });

    it('should map undefined to skipped', () => {
      expect(toRunStatus(undefined)).toBe('skipped');
    });
  });

  describe('mapPipelineToAgent', () => {
    const basePipeline: IngestionPipeline = {
      id: 'pipeline-1',
      name: 'metadata_pipeline',
      displayName: 'Metadata Pipeline',
      pipelineType: PipelineType.Metadata,
      airflowConfig: {},
      sourceConfig: {},
    };

    it('should aggregate progress for a running pipeline', () => {
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        pipelineStatuses: [
          {
            pipelineState: PipelineState.Running,
            runId: 'run-1',
            status: [
              {
                name: 'Source',
                progress: {
                  tables: {
                    processed: 40,
                    total: 100,
                    estimatedRemainingSeconds: 30,
                  },
                  schemas: {
                    processed: 5,
                    total: 10,
                    estimatedRemainingSeconds: 10,
                  },
                },
              },
            ],
          },
        ],
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.status).toBe('running');
      expect(agent.assets).toBe(45);
      expect(agent.target).toBe(110);
      expect(agent.pct).toBe(Math.round((45 / 110) * 100));
      expect(agent.eta).toBe(30);
    });

    it('should mark a successful pipeline with pct 100 and a finishedAt string', () => {
      const now = Date.now();
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        pipelineStatuses: [
          {
            pipelineState: PipelineState.Success,
            runId: 'run-2',
            startDate: now - 60000,
            endDate: now,
            status: [
              {
                name: 'Source',
                records: 120,
                errors: 0,
                warnings: 0,
              },
            ],
          },
        ],
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.status).toBe('success');
      expect(agent.pct).toBe(100);
      expect(agent.assets).toBe(120);
      expect(agent.finishedAt).toBeTruthy();
    });

    it('should return queued status with zeros when there are no runs', () => {
      const agent = mapPipelineToAgent(basePipeline);

      expect(agent.status).toBe('queued');
      expect(agent.pct).toBe(0);
      expect(agent.assets).toBe(0);
      expect(agent.target).toBe(0);
      expect(agent.eta).toBeNull();
      expect(agent.errors).toBe(0);
      expect(agent.warnings).toBe(0);
      expect(agent.recentRuns).toEqual([]);
    });

    it('should build recentRuns latest-first from pipeline statuses', () => {
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        pipelineStatuses: [
          { pipelineState: PipelineState.Failed, runId: 'run-a' },
          { pipelineState: PipelineState.Success, runId: 'run-b' },
          { pipelineState: PipelineState.PartialSuccess, runId: 'run-c' },
        ],
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.recentRuns).toEqual([
        { id: 'run-a', status: 'failed' },
        { id: 'run-b', status: 'success' },
        { id: 'run-c', status: 'partial' },
      ]);
    });

    it('should exclude in-flight queued and running statuses from recentRuns', () => {
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        pipelineStatuses: [
          { pipelineState: PipelineState.Queued, runId: 'run-q' },
          { pipelineState: PipelineState.Running, runId: 'run-x' },
          { pipelineState: PipelineState.Success, runId: 'run-y' },
        ],
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.status).toBe('queued');
      expect(agent.recentRuns).toEqual([{ id: 'run-y', status: 'success' }]);
    });

    it('should keep stopped runs in recentRuns as skipped', () => {
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        pipelineStatuses: [
          { pipelineState: PipelineState.Stopped, runId: 'run-s' },
          { pipelineState: PipelineState.Success, runId: 'run-t' },
        ],
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.recentRuns).toEqual([
        { id: 'run-s', status: 'skipped' },
        { id: 'run-t', status: 'success' },
      ]);
    });

    it('should fall back to the timestamp for recentRuns ids when runId is missing', () => {
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        pipelineStatuses: [
          {
            pipelineState: PipelineState.Success,
            timestamp: 1_700_000_000_000,
          },
        ],
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.recentRuns).toEqual([
        { id: '1700000000000', status: 'success' },
      ]);
    });

    it('should cap recentRuns at five entries', () => {
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        pipelineStatuses: Array.from({ length: 7 }, (_, index) => ({
          pipelineState: PipelineState.Success,
          runId: `run-${index}`,
        })),
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.recentRuns).toHaveLength(5);
      expect(agent.recentRuns[0].id).toBe('run-0');
      expect(agent.recentRuns[4].id).toBe('run-4');
    });

    it('should sum errors and warnings across steps and set failStep on failure', () => {
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        pipelineStatuses: [
          {
            pipelineState: PipelineState.Failed,
            runId: 'run-3',
            status: [
              { name: 'Source', records: 10, errors: 0, warnings: 2 },
              { name: 'Sink', records: 0, errors: 3, warnings: 1 },
            ],
          },
        ],
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.status).toBe('failed');
      expect(agent.errors).toBe(3);
      expect(agent.warnings).toBe(3);
      expect(agent.failStep).toBe('Sink');
    });

    it('should fall back to id/name when displayName is missing', () => {
      const pipeline: IngestionPipeline = {
        ...basePipeline,
        displayName: undefined,
      };

      const agent = mapPipelineToAgent(pipeline);

      expect(agent.name).toBe('metadata_pipeline');
      expect(agent.type).toBe('Metadata');
      expect(agent.unit).toBe('assets');
      expect(agent.verb).toBe('ingested');
    });
  });

  describe('mapPipelineStatusToRun', () => {
    it('should sum totals across steps and map nested steps', () => {
      const status: PipelineStatus = {
        runId: 'run-1',
        pipelineState: PipelineState.PartialSuccess,
        startDate: 1_700_000_000_000,
        endDate: 1_700_000_090_000,
        status: [
          {
            name: 'Source',
            records: 10,
            filtered: 1,
            updated_records: 2,
            warnings: 1,
            errors: 0,
          },
          {
            name: 'Sink',
            records: 5,
            filtered: 0,
            updated_records: 1,
            warnings: 0,
            errors: 1,
            failures: [
              {
                name: 'table.customers',
                error: 'Connection timeout',
              },
            ],
          },
        ],
      };

      const run = mapPipelineStatusToRun(status);

      expect(run.id).toBe('run-1');
      expect(run.status).toBe('partial');
      expect(run.totals).toEqual({
        records: 15,
        filtered: 1,
        updated: 3,
        warnings: 1,
        errors: 1,
      });
      expect(run.duration).toBe(1.5);
      expect(run.steps).toHaveLength(2);
      expect(run.steps[1].attention).toEqual({
        severity: 'error',
        title: 'table.customers',
        message: 'Connection timeout',
        hint: undefined,
      });
    });

    it('should fall back to timestamp-derived id when runId is missing', () => {
      const status: PipelineStatus = {
        timestamp: 1_700_000_000_000,
        pipelineState: PipelineState.Running,
      };

      const run = mapPipelineStatusToRun(status);

      expect(run.id).toBe('1700000000000');
      expect(run.duration).toBe(0);
      expect(run.steps).toEqual([]);
    });
  });

  describe('mapStepSummaryToRunStep', () => {
    it('should mark a step with errors and no records as failed', () => {
      const step: StepSummary = { name: 'Sink', records: 0, errors: 2 };

      expect(mapStepSummaryToRunStep(step).status).toBe('failed');
    });

    it('should mark a step with errors and records as partial', () => {
      const step: StepSummary = { name: 'Sink', records: 5, errors: 2 };

      expect(mapStepSummaryToRunStep(step).status).toBe('partial');
    });

    it('should mark a step with warnings only as partial', () => {
      const step: StepSummary = { name: 'Source', records: 10, warnings: 1 };

      expect(mapStepSummaryToRunStep(step).status).toBe('partial');
    });

    it('should mark a zero step as skipped', () => {
      const step: StepSummary = { name: 'Source', records: 0 };
      const runStep = mapStepSummaryToRunStep(step);

      expect(runStep.status).toBe('skipped');
      expect(runStep.records).toBe(0);
      expect(runStep.filtered).toBe(0);
      expect(runStep.updated).toBe(0);
      expect(runStep.warnings).toBe(0);
      expect(runStep.errors).toBe(0);
    });

    it('should mark a clean step with records as success', () => {
      const step: StepSummary = { name: 'Source', records: 10 };

      expect(mapStepSummaryToRunStep(step).status).toBe('success');
    });

    it('should build an attention block from the first failure', () => {
      const step: StepSummary = {
        name: 'Sink',
        records: 0,
        errors: 1,
        failures: [
          { name: 'table.orders', error: 'Timeout while writing' },
          { name: 'table.other', error: 'Should be ignored' },
        ],
      };

      expect(mapStepSummaryToRunStep(step).attention).toEqual({
        severity: 'error',
        title: 'table.orders',
        message: 'Timeout while writing',
        hint: undefined,
      });
    });

    it('should leave attention undefined when there are no failures', () => {
      const step: StepSummary = { name: 'Source', records: 10 };

      expect(mapStepSummaryToRunStep(step).attention).toBeUndefined();
    });
  });

  describe('parseLogLines', () => {
    it('should parse levels, timestamps and text, and drop blank lines', () => {
      const raw = [
        '2024-01-01 10:00:00,123 INFO Starting ingestion',
        '',
        '2024-01-01 10:00:01,456 WARN Slow query detected',
        '   ',
        '2024-01-01 10:00:02,789 ERROR Connection refused',
      ].join('\n');

      const lines = parseLogLines(raw);

      expect(lines).toHaveLength(3);
      expect(lines[0]).toEqual({
        time: '2024-01-01 10:00:00,123',
        level: 'info',
        text: 'Starting ingestion',
      });
      expect(lines[1]).toEqual({
        time: '2024-01-01 10:00:01,456',
        level: 'warn',
        text: 'Slow query detected',
      });
      expect(lines[2]).toEqual({
        time: '2024-01-01 10:00:02,789',
        level: 'error',
        text: 'Connection refused',
      });
    });

    it('should default to info level when no level token is present', () => {
      const lines = parseLogLines('just a plain line with no metadata');

      expect(lines).toHaveLength(1);
      expect(lines[0].level).toBe('info');
      expect(lines[0].time).toBe('');
      expect(lines[0].text).toBe('just a plain line with no metadata');
    });

    it('should return an empty array for an empty string', () => {
      expect(parseLogLines('')).toEqual([]);
    });
  });

  describe('getLogTaskFieldForType', () => {
    it('should pick the ingestion_task field for Metadata', () => {
      const log: IngestionPipelineLogByIdInterface = {
        ingestion_task: 'metadata logs',
        profiler_task: 'profiler logs',
      };

      expect(getLogTaskFieldForType(log, PipelineType.Metadata)).toBe(
        'metadata logs'
      );
    });

    it('should pick the usage_task field for Usage', () => {
      const log: IngestionPipelineLogByIdInterface = {
        usage_task: 'usage logs',
      };

      expect(getLogTaskFieldForType(log, PipelineType.Usage)).toBe(
        'usage logs'
      );
    });

    it('should pick the dbt_task field for Dbt', () => {
      const log: IngestionPipelineLogByIdInterface = {
        dbt_task: 'dbt logs',
      };

      expect(getLogTaskFieldForType(log, PipelineType.Dbt)).toBe('dbt logs');
    });

    it('should return an empty string when the field is missing', () => {
      const log: IngestionPipelineLogByIdInterface = {};

      expect(getLogTaskFieldForType(log, PipelineType.Lineage)).toBe('');
    });
  });
});
