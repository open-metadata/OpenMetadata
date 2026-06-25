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
import { isNil } from 'lodash';
import { DataContract } from '../../../generated/entity/data/dataContract';
import {
  IngestionPipeline,
  PipelineStatus,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  Severities,
  TestCaseResolutionStatus,
  TestCaseResolutionStatusTypes,
} from '../../../generated/tests/testCaseResolutionStatus';
import { TestSummary } from '../../../generated/tests/testSuite';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { t } from '../../../utils/i18next/LocalUtil';
import {
  ASSET_HEALTH_CATEGORY_ICON,
  ASSET_HEALTH_CATEGORY_TITLE_KEY,
  CONTRACT_STATUS_PRESENTATION,
  DEFAULT_CONTRACT_PRESENTATION,
  DEFAULT_PIPELINE_PRESENTATION,
  PIPELINE_STATE_PRESENTATION,
  PIPELINE_SUBTITLE_KEY,
} from './AssetHealthWidget.constant';
import {
  AssetHealthCategory,
  AssetHealthCTA,
  AssetHealthCTAType,
  AssetHealthHeader,
  AssetHealthRow,
  AssetHealthTone,
} from './AssetHealthWidget.interface';

const HIGH_SEVERITIES = new Set<Severities>([
  Severities.Severity1,
  Severities.Severity2,
]);

interface BuildRowParams {
  category: AssetHealthCategory;
  tone: AssetHealthTone;
  subtitle: string;
  badgeLabel?: string;
  cta?: AssetHealthCTA;
}

const buildRow = ({
  category,
  tone,
  subtitle,
  badgeLabel,
  cta,
}: BuildRowParams): AssetHealthRow => ({
  category,
  icon: ASSET_HEALTH_CATEGORY_ICON[category],
  title: t(ASSET_HEALTH_CATEGORY_TITLE_KEY[category]),
  subtitle,
  tone,
  badgeLabel,
  cta,
});

const buildStatusRow = (
  category: AssetHealthCategory,
  tone: AssetHealthTone,
  badgeKey: string,
  subtitle: string
): AssetHealthRow =>
  buildRow({ category, tone, subtitle, badgeLabel: t(badgeKey) });

const buildSetupRow = (
  category: AssetHealthCategory,
  ctaType: AssetHealthCTAType,
  ctaKey: string,
  subtitleKey: string
): AssetHealthRow =>
  buildRow({
    category,
    tone: AssetHealthTone.Neutral,
    subtitle: t(subtitleKey),
    cta: { labelKey: ctaKey, type: ctaType },
  });

export const getLatestPipelineStatus = (
  pipeline?: IngestionPipeline
): PipelineStatus | undefined => {
  let latest: PipelineStatus | undefined;
  pipeline?.pipelineStatuses?.forEach((status) => {
    if (
      !isNil(status.startDate) &&
      (isNil(latest?.startDate) || status.startDate > (latest?.startDate ?? 0))
    ) {
      latest = status;
    }
  });

  return latest;
};

export const getPipelineHealthRow = (
  pipeline?: IngestionPipeline
): AssetHealthRow => {
  const latest = getLatestPipelineStatus(pipeline);
  const state = latest?.pipelineState;
  let row: AssetHealthRow;

  if (isNil(state)) {
    row = buildSetupRow(
      AssetHealthCategory.Pipeline,
      AssetHealthCTAType.LinkPipeline,
      'label.link-pipeline',
      'message.no-pipeline-linked'
    );
  } else {
    const presentation =
      PIPELINE_STATE_PRESENTATION[state] ?? DEFAULT_PIPELINE_PRESENTATION;
    const subtitle = t(presentation.subtitleKey ?? PIPELINE_SUBTITLE_KEY, {
      time: getShortRelativeTime(latest?.endDate ?? latest?.startDate),
    });
    row = buildStatusRow(
      AssetHealthCategory.Pipeline,
      presentation.tone,
      presentation.badgeKey,
      subtitle
    );
  }

  return row;
};

export const getDataQualityHealthRow = (
  hasTests: boolean,
  summary?: TestSummary
): AssetHealthRow => {
  const total = summary?.total ?? 0;
  let row: AssetHealthRow;

  if (!hasTests || total === 0) {
    row = buildSetupRow(
      AssetHealthCategory.DataQuality,
      AssetHealthCTAType.AddTests,
      'label.add-test-plural',
      'message.no-test-defined'
    );
  } else {
    const success = summary?.success ?? 0;
    const failed = summary?.failed ?? 0;
    const aborted = summary?.aborted ?? 0;
    const queued = summary?.queued ?? 0;

    let tone = AssetHealthTone.Success;
    let badgeLabel = t('label.passing');
    if (failed > 0) {
      tone = AssetHealthTone.Error;
      badgeLabel = t('message.count-failed-test', { count: failed });
    } else if (queued > 0) {
      tone = AssetHealthTone.Info;
      badgeLabel = t('label.queued');
    } else if (aborted > 0) {
      tone = AssetHealthTone.Warning;
      badgeLabel = t('label.aborted');
    }

    row = buildRow({
      category: AssetHealthCategory.DataQuality,
      tone,
      subtitle: t('message.count-by-total-test-plural', {
        count: success,
        total,
      }),
      badgeLabel,
    });
  }

  return row;
};

export const getDataObservabilityHealthRow = (
  hasTests: boolean,
  incidents: TestCaseResolutionStatus[]
): AssetHealthRow => {
  let row: AssetHealthRow;

  if (!hasTests) {
    row = buildSetupRow(
      AssetHealthCategory.DataObservability,
      AssetHealthCTAType.EnableObservability,
      'label.enable',
      'message.not-configured'
    );
  } else {
    const unresolved = incidents.filter(
      (incident) =>
        incident.testCaseResolutionStatusType !==
        TestCaseResolutionStatusTypes.Resolved
    );
    const latestTimestamp = incidents.reduce<number | undefined>(
      (latest, incident) =>
        !isNil(incident.timestamp) && incident.timestamp > (latest ?? 0)
          ? incident.timestamp
          : latest,
      undefined
    );
    const hasHighSeverity = unresolved.some(
      (incident) =>
        !isNil(incident.severity) && HIGH_SEVERITIES.has(incident.severity)
    );
    const subtitle = isNil(latestTimestamp)
      ? ''
      : t('message.last-check-time', {
          time: getShortRelativeTime(latestTimestamp),
        });

    if (unresolved.length === 0) {
      row = buildStatusRow(
        AssetHealthCategory.DataObservability,
        AssetHealthTone.Success,
        'label.no-anomaly-plural',
        subtitle
      );
    } else {
      row = buildRow({
        category: AssetHealthCategory.DataObservability,
        tone: hasHighSeverity ? AssetHealthTone.Error : AssetHealthTone.Warning,
        subtitle,
        badgeLabel: t('message.count-anomaly', { count: unresolved.length }),
      });
    }
  }

  return row;
};

export const getContractHealthRow = (
  contract?: DataContract
): AssetHealthRow => {
  const status = contract?.latestResult?.status;
  let row: AssetHealthRow;

  if (isNil(status)) {
    row = buildSetupRow(
      AssetHealthCategory.Contract,
      AssetHealthCTAType.CreateContract,
      'label.create',
      'message.no-contract'
    );
  } else {
    const presentation =
      CONTRACT_STATUS_PRESENTATION[status] ?? DEFAULT_CONTRACT_PRESENTATION;
    const timestamp = contract?.latestResult?.timestamp;
    const subtitle =
      contract?.latestResult?.message ||
      (isNil(timestamp)
        ? ''
        : t('message.last-check-time', {
            time: getShortRelativeTime(timestamp),
          }));
    row = buildStatusRow(
      AssetHealthCategory.Contract,
      presentation.tone,
      presentation.badgeKey,
      subtitle
    );
  }

  return row;
};

export const getAssetHealthHeader = (
  rows: AssetHealthRow[]
): AssetHealthHeader => {
  const configured = rows.filter((row) => isNil(row.cta));
  const errorCount = configured.filter(
    (row) => row.tone === AssetHealthTone.Error
  ).length;
  const hasWarning = configured.some(
    (row) => row.tone === AssetHealthTone.Warning
  );
  const hasInProgress = configured.some(
    (row) => row.tone === AssetHealthTone.Info
  );

  let header: AssetHealthHeader = {
    tone: AssetHealthTone.Success,
    labelKey: 'label.all-clear',
  };

  if (configured.length === 0) {
    header = { tone: AssetHealthTone.Neutral, labelKey: 'label.not-set-up' };
  } else if (errorCount >= 2) {
    header = { tone: AssetHealthTone.Error, labelKey: 'label.critical' };
  } else if (errorCount === 1 || hasWarning) {
    header = { tone: AssetHealthTone.Error, labelKey: 'label.attention' };
  } else if (hasInProgress) {
    header = { tone: AssetHealthTone.Info, labelKey: 'label.running' };
  }

  return header;
};
