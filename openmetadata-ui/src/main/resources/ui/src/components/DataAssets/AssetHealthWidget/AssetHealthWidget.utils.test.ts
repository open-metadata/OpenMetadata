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
import {
  ContractExecutionStatus,
  DataContract,
} from '../../../generated/entity/data/dataContract';
import {
  IngestionPipeline,
  PipelineState,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../generated/tests/testCaseResolutionStatus';
import { t } from '../../../utils/i18next/LocalUtil';
import {
  AssetHealthCTAType,
  AssetHealthTone,
} from './AssetHealthWidget.interface';
import {
  getAssetHealthHeader,
  getContractHealthRow,
  getDataObservabilityHealthRow,
  getDataQualityHealthRow,
  getPipelineHealthRow,
} from './AssetHealthWidget.utils';

describe('AssetHealthWidget.utils', () => {
  describe('getPipelineHealthRow', () => {
    it('should return a setup CTA row when there is no pipeline run', () => {
      const row = getPipelineHealthRow(undefined);

      expect(row.tone).toBe(AssetHealthTone.Neutral);
      expect(row.cta?.type).toBe(AssetHealthCTAType.LinkPipeline);
      expect(row.badgeLabel).toBeUndefined();
    });

    it('should map the latest successful run to a success tone', () => {
      const row = getPipelineHealthRow({
        pipelineStatuses: [
          { startDate: 1, pipelineState: PipelineState.Failed },
          { startDate: 2, pipelineState: PipelineState.Success },
        ],
      } as IngestionPipeline);

      expect(row.tone).toBe(AssetHealthTone.Success);
      expect(row.cta).toBeUndefined();
    });

    it('should map a running pipeline to an info tone', () => {
      const row = getPipelineHealthRow({
        pipelineStatuses: [
          { startDate: 2, pipelineState: PipelineState.Running },
        ],
      } as IngestionPipeline);

      expect(row.tone).toBe(AssetHealthTone.Info);
    });

    it('should map a stopped pipeline to a warning tone', () => {
      const row = getPipelineHealthRow({
        pipelineStatuses: [
          { startDate: 2, pipelineState: PipelineState.Stopped },
        ],
      } as IngestionPipeline);

      expect(row.tone).toBe(AssetHealthTone.Warning);
    });

    it('should map a failed pipeline to an error tone', () => {
      const row = getPipelineHealthRow({
        pipelineStatuses: [
          { startDate: 2, pipelineState: PipelineState.Failed },
        ],
      } as IngestionPipeline);

      expect(row.tone).toBe(AssetHealthTone.Error);
    });
  });

  describe('getDataQualityHealthRow', () => {
    it('should return a setup CTA row when the table has no tests', () => {
      const row = getDataQualityHealthRow(false, undefined);

      expect(row.tone).toBe(AssetHealthTone.Neutral);
      expect(row.cta?.type).toBe(AssetHealthCTAType.AddTests);
    });

    it('should be a success tone when all tests pass', () => {
      const row = getDataQualityHealthRow(true, { total: 16, success: 16 });

      expect(row.tone).toBe(AssetHealthTone.Success);
    });

    it('should be an error tone with a failed count when any test fails', () => {
      const row = getDataQualityHealthRow(true, {
        total: 16,
        success: 14,
        failed: 2,
      });

      expect(row.tone).toBe(AssetHealthTone.Error);
      expect(row.badgeLabel).toBe(t('message.count-failed-test', { count: 2 }));
    });

    it('should be an info tone when tests are queued', () => {
      const row = getDataQualityHealthRow(true, {
        total: 16,
        success: 14,
        queued: 2,
      });

      expect(row.tone).toBe(AssetHealthTone.Info);
    });

    it('should be a warning tone when tests are only aborted', () => {
      const row = getDataQualityHealthRow(true, {
        total: 16,
        success: 14,
        aborted: 2,
      });

      expect(row.tone).toBe(AssetHealthTone.Warning);
    });
  });

  describe('getDataObservabilityHealthRow', () => {
    it('should return a setup CTA row when the entity has no tests', () => {
      const row = getDataObservabilityHealthRow(false, []);

      expect(row.tone).toBe(AssetHealthTone.Neutral);
      expect(row.cta?.type).toBe(AssetHealthCTAType.EnableObservability);
    });

    it('should be a success tone when there are no unresolved incidents', () => {
      const row = getDataObservabilityHealthRow(true, [
        {
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.Resolved,
        },
      ]);

      expect(row.tone).toBe(AssetHealthTone.Success);
    });

    it('should omit the subtitle when there are no incidents to date', () => {
      const row = getDataObservabilityHealthRow(true, []);

      expect(row.tone).toBe(AssetHealthTone.Success);
      expect(row.subtitle).toBe('');
    });

    it('should be a warning tone for a low-severity unresolved incident', () => {
      const row = getDataObservabilityHealthRow(true, [
        {
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
          severity: Severities.Severity4,
        } as TestCaseResolutionStatus,
      ]);

      expect(row.tone).toBe(AssetHealthTone.Warning);
      expect(row.subtitle).toBe('');
    });

    it('should escalate to an error tone for a high-severity incident', () => {
      const row = getDataObservabilityHealthRow(true, [
        {
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.New,
          severity: Severities.Severity1,
        } as TestCaseResolutionStatus,
      ]);

      expect(row.tone).toBe(AssetHealthTone.Error);
    });
  });

  describe('getContractHealthRow', () => {
    it('should return a setup CTA row when there is no latest result', () => {
      const row = getContractHealthRow(undefined);

      expect(row.tone).toBe(AssetHealthTone.Neutral);
      expect(row.cta?.type).toBe(AssetHealthCTAType.CreateContract);
    });

    it('should map a failed contract to a breach (error tone)', () => {
      const row = getContractHealthRow({
        latestResult: { status: ContractExecutionStatus.Failed },
      } as DataContract);

      expect(row.tone).toBe(AssetHealthTone.Error);
      expect(row.badgeLabel).toBe(t('label.breach'));
    });

    it('should map an aborted contract to a failed-to-run (error tone)', () => {
      const row = getContractHealthRow({
        latestResult: { status: ContractExecutionStatus.Aborted },
      } as DataContract);

      expect(row.tone).toBe(AssetHealthTone.Error);
      expect(row.badgeLabel).toBe(t('label.failed-to-run'));
    });

    it('should map a running contract to an info tone', () => {
      const row = getContractHealthRow({
        latestResult: { status: ContractExecutionStatus.Running },
      } as DataContract);

      expect(row.tone).toBe(AssetHealthTone.Info);
    });

    it('should map a successful contract to a success tone', () => {
      const row = getContractHealthRow({
        latestResult: { status: ContractExecutionStatus.Success },
      } as DataContract);

      expect(row.tone).toBe(AssetHealthTone.Success);
    });

    it('should map a partial-success contract to a warning tone', () => {
      const row = getContractHealthRow({
        latestResult: { status: ContractExecutionStatus.PartialSuccess },
      } as DataContract);

      expect(row.tone).toBe(AssetHealthTone.Warning);
      expect(row.badgeLabel).toBe(t('label.partial-success'));
    });

    it('should omit the subtitle when the result has no message or timestamp', () => {
      const row = getContractHealthRow({
        latestResult: { status: ContractExecutionStatus.Success },
      } as DataContract);

      expect(row.subtitle).toBe('');
    });
  });

  describe('getAssetHealthHeader', () => {
    const successRow = getDataQualityHealthRow(true, { total: 1, success: 1 });
    const errorRow = getDataQualityHealthRow(true, { total: 1, failed: 1 });
    const warningRow = getDataQualityHealthRow(true, {
      total: 1,
      success: 0,
      aborted: 1,
    });
    const infoRow = getDataQualityHealthRow(true, {
      total: 1,
      success: 0,
      queued: 1,
    });
    const setupRow = getDataQualityHealthRow(false, undefined);

    it('should be Not set up when every row is unconfigured', () => {
      const header = getAssetHealthHeader([setupRow, setupRow]);

      expect(header.tone).toBe(AssetHealthTone.Neutral);
      expect(header.labelKey).toBe('label.not-set-up');
    });

    it('should be All clear when all configured rows are healthy', () => {
      const header = getAssetHealthHeader([successRow, successRow, setupRow]);

      expect(header.tone).toBe(AssetHealthTone.Success);
      expect(header.labelKey).toBe('label.all-clear');
    });

    it('should be Attention for a single error', () => {
      const header = getAssetHealthHeader([successRow, errorRow]);

      expect(header.labelKey).toBe('label.attention');
    });

    it('should be Attention for a warning with no error', () => {
      const header = getAssetHealthHeader([successRow, warningRow]);

      expect(header.labelKey).toBe('label.attention');
    });

    it('should escalate to Critical for two or more errors', () => {
      const header = getAssetHealthHeader([errorRow, errorRow, successRow]);

      expect(header.labelKey).toBe('label.critical');
    });

    it('should be Running when something is in progress and nothing is wrong', () => {
      const header = getAssetHealthHeader([successRow, infoRow]);

      expect(header.tone).toBe(AssetHealthTone.Info);
      expect(header.labelKey).toBe('label.running');
    });
  });
});
