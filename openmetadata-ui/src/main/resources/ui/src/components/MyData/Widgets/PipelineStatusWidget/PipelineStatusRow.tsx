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

import {
  RunHistoryBar,
  RunHistoryItem,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  PipelineStatus,
  StatusType,
} from '../../../../generated/entity/data/pipeline';
import {
  LastRunStatus,
  PipelineSummary,
} from '../../../../generated/type/pipelineSummary';
import { PIPELINE_RUN_HISTORY_SIZE } from '../../../../hooks/usePipelineStatus';
import { getFormattedDataAssetServiceType } from '../../../../utils/DataAssetServiceUtils';
import {
  convertMillisecondsToHumanReadableFormat,
  getRelativeTime,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import {
  TOPIC_ROW_CLASSES,
  TOPIC_ROW_DIVIDER_CLASSES,
  TOPIC_ROW_TILE_CLASSES,
} from '../Common/TopicWidget/topicRowStyles';
import {
  DURATION_UNITS,
  NOT_RUN_STYLE,
  PIPELINE_STATUS_STYLES,
  RUN_HISTORY_STATUS,
  RUN_STATUS_LABEL_KEY,
} from './PipelineStatusWidget.constants';

export interface PipelineStatusRowProps {
  summary: PipelineSummary;
  /** Recent runs, oldest first. */
  runs: PipelineStatus[];
}

/** One pipeline: its latest run, the last few runs, and what broke if it did. */
const PipelineStatusRow: React.FC<PipelineStatusRowProps> = ({
  summary,
  runs,
}) => {
  const { t, i18n } = useTranslation();
  const style = summary.lastRunStatus
    ? PIPELINE_STATUS_STYLES[summary.lastRunStatus]
    : NOT_RUN_STYLE;
  const StatusIcon = style.icon;
  const statusLabel = t(style.labelKey);

  const meta = [
    getFormattedDataAssetServiceType(summary.serviceType),
    summary.lastRunTime && getRelativeTime(summary.lastRunTime),
    summary.startTime &&
      summary.endTime &&
      summary.endTime > summary.startTime &&
      convertMillisecondsToHumanReadableFormat(
        summary.endTime - summary.startTime,
        DURATION_UNITS
      ),
  ]
    .filter(Boolean)
    .join(' · ');

  const historyItems = useMemo<RunHistoryItem[]>(
    () =>
      runs.map((run, index) => ({
        id: run.executionId ?? String(run.timestamp),
        label: t('message.run-index-status', {
          index: index + 1,
          status: t(RUN_STATUS_LABEL_KEY[run.executionStatus]),
        }),
        status: RUN_HISTORY_STATUS[run.executionStatus],
      })),
    [runs, t]
  );

  // "Last 10 runs: 8 Successful, 2 Failed" — the strip's colours as words.
  const historyLabel = useMemo(() => {
    const tally = runs.reduce(
      (counts, run) =>
        counts.set(
          run.executionStatus,
          (counts.get(run.executionStatus) ?? 0) + 1
        ),
      new Map<StatusType, number>()
    );
    const parts = Array.from(tally.entries()).map(
      ([status, count]) => `${count} ${t(RUN_STATUS_LABEL_KEY[status])}`
    );

    return t('message.last-count-runs-summary', {
      count: runs.length,
      summary: new Intl.ListFormat(i18n.language, { type: 'unit' }).format(
        parts
      ),
    });
  }, [runs, t, i18n.language]);

  const latestRun = runs[runs.length - 1];
  const errorMessage =
    summary.lastRunStatus === LastRunStatus.Failed
      ? latestRun?.error?.errorMessage
      : undefined;

  return (
    <li
      className={classNames(
        'tw:flex tw:min-w-0 tw:flex-col tw:gap-1 tw:py-3',
        TOPIC_ROW_CLASSES,
        TOPIC_ROW_DIVIDER_CLASSES
      )}
      data-testid={`pipeline-status-row-${summary.pipelineId}`}>
      {/* The tile centres on the name and meta lines only, so a failed run's
        error message below does not pull it down. */}
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
        <span
          aria-hidden
          className={classNames(
            'tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg',
            style.tile,
            TOPIC_ROW_TILE_CLASSES
          )}>
          <StatusIcon size={16} />
        </span>
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2">
            <Link
              className="tw:min-w-0 tw:flex-1 tw:no-underline!"
              to={getEntityDetailsPath(
                EntityType.PIPELINE,
                summary.pipelineFqn
              )}>
              <Typography
                className="tw:text-text-primary!"
                data-testid="pipeline-status-name"
                ellipsis={{ rows: 1 }}
                size="text-sm"
                weight="medium">
                {summary.pipelineName}
              </Typography>
            </Link>
            <Typography
              className={classNames('tw:shrink-0', style.text)}
              data-testid="pipeline-status-label"
              size="text-xs"
              weight="medium">
              {statusLabel}
            </Typography>
          </div>
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
            {/* The span takes the free width so the strip sits flush right;
            Typography's ellipsis box does not stretch as a flex item. */}
            <span className="tw:min-w-0 tw:flex-1">
              <Typography
                className="tw:text-text-tertiary!"
                ellipsis={{ rows: 1 }}
                size="text-xs">
                {meta}
              </Typography>
            </span>
            <RunHistoryBar
              ariaLabel={historyLabel}
              className="tw:shrink-0"
              data-testid="pipeline-run-history"
              max={PIPELINE_RUN_HISTORY_SIZE}
              runs={historyItems}
            />
          </div>
        </div>
      </div>
      {/* Indented by the tile and its gap, so it lines up with the name. */}
      {errorMessage && (
        <Typography
          className="tw:mt-1 tw:ms-11 tw:rounded-lg tw:bg-utility-error-50 tw:px-2.5 tw:py-2 tw:text-utility-error-700!"
          data-testid="pipeline-status-error"
          ellipsis={{ rows: 3 }}
          size="text-xs">
          {errorMessage}
        </Typography>
      )}
    </li>
  );
};

export default PipelineStatusRow;
