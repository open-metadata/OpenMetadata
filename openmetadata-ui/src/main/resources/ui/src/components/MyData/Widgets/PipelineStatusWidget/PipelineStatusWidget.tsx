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

import classNames from 'classnames';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ExplorePageTabs } from '../../../../enums/Explore.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { LastRunStatus } from '../../../../generated/type/pipelineSummary';
import {
  ALL_PIPELINES,
  PipelineStatusBucket,
  PIPELINE_STATUS_BUCKETS,
  usePipelineRunHistory,
  usePipelineStatus,
} from '../../../../hooks/usePipelineStatus';
import { WidgetCommonProps } from '../../../../interface/customization.interface';
import customizeMyDataPageClassBase from '../../../../utils/CustomizeMyDataPageClassBase';
import { getRelativeTime } from '../../../../utils/date-time/DateTimeUtils';
import { getExplorePath } from '../../../../utils/RouterUtils';
import { useAddServiceAction } from '../../../integration/ConnectionsPage/useAddServiceAction';
import TopicCard from '../Common/TopicWidget/TopicCard';
import TopicFilterChips from '../Common/TopicWidget/TopicFilterChips';
import {
  TOPIC_FILTERED_BODY_CLASSES,
  TOPIC_FILTERED_LIST_CLASSES,
} from '../Common/TopicWidget/topicRowStyles';
import {
  TopicEmptyStateConfig,
  TopicKey,
} from '../Common/TopicWidget/topics.types';
import PipelineStatusRow from './PipelineStatusRow';
import {
  PIPELINE_STATUS_STYLES,
  PIPELINE_STATUS_TONE,
} from './PipelineStatusWidget.constants';

export type PipelineStatusWidgetProps = WidgetCommonProps;

/** Each pipeline's latest run, failures first, with its recent run history. */
const PipelineStatusWidget: React.FC<PipelineStatusWidgetProps> = ({
  widgetKey,
  isEditView,
  handleRemoveWidget,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bucket, setBucket] = useState<PipelineStatusBucket>(ALL_PIPELINES);
  const {
    rows,
    counts,
    dataUpdatedAt,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = usePipelineStatus();
  const visibleRows = rows[bucket];
  const fqns = useMemo(
    () => visibleRows.map((row) => row.pipelineFqn),
    [visibleRows]
  );
  const runsByFqn = usePipelineRunHistory(fqns);
  const { addService, canAddService } = useAddServiceAction(
    ServiceCategory.PIPELINE_SERVICES
  );

  const total = counts[ALL_PIPELINES];
  const failedCount = counts[LastRunStatus.Failed];
  const remaining = Math.max(0, counts[bucket] - visibleRows.length);

  const chips = useMemo(
    () => [
      {
        count: total,
        id: ALL_PIPELINES,
        label: t('label.all'),
        tone: 'brand' as const,
      },
      ...PIPELINE_STATUS_BUCKETS.map((status) => ({
        count: counts[status],
        id: status,
        label: t(PIPELINE_STATUS_STYLES[status].labelKey),
        tone: PIPELINE_STATUS_STYLES[status].chipTone,
      })),
    ],
    [counts, total, t]
  );

  const summary =
    failedCount > 0
      ? t('message.count-of-total-pipelines-failed-last-run', {
          count: failedCount,
          total,
        })
      : t('message.no-pipeline-failed-last-run', { count: total });

  // Pipelines arrive through a pipeline connector's ingestion; until one has
  // run there is nothing to report on.
  const emptyState: TopicEmptyStateConfig | undefined =
    total === 0
      ? {
          description: t('message.pipeline-status-empty-description'),
          footer: {
            action: canAddService
              ? {
                  label: t('label.add-entity', {
                    entity: t('label.pipeline-service'),
                  }),
                  onPress: addService,
                }
              : undefined,
            meta: t('message.no-runs-recorded'),
          },
          icon: PIPELINE_STATUS_TONE.icon,
          summary: t('message.no-pipelines-connected-yet'),
          title: t('message.no-pipeline-runs-yet'),
        }
      : undefined;

  return (
    <TopicCard
      action={{
        label: t('label.open-entity', { entity: t('label.pipeline-plural') }),
        onPress: () =>
          navigate(
            customizeMyDataPageClassBase.getPipelineStatusActionPath() ??
              getExplorePath({ tab: ExplorePageTabs.PIPELINES })
          ),
      }}
      bodyClassName={TOPIC_FILTERED_BODY_CLASSES}
      emptyState={emptyState}
      handleRemoveWidget={handleRemoveWidget}
      isEditView={isEditView}
      isError={isError}
      isFetching={isFetching}
      isLoading={isLoading}
      meta={
        remaining > 0
          ? t('message.count-more-pipelines', { count: remaining })
          : t('message.updated-relative', {
              time: getRelativeTime(dataUpdatedAt),
            })
      }
      status={
        failedCount > 0
          ? {
              color: 'error',
              label: t('message.count-failed-test', { count: failedCount }),
            }
          : undefined
      }
      summary={summary}
      title={t('label.pipeline-status')}
      tone={PIPELINE_STATUS_TONE}
      topicKey={TopicKey.PIPELINE_STATUS}
      widgetKey={widgetKey}
      onRetry={refetch}>
      {!emptyState && (
        <>
          <TopicFilterChips
            chips={chips}
            label={t('label.pipeline-status')}
            testIdPrefix="pipeline-status"
            value={bucket}
            onChange={(next) => setBucket(next as PipelineStatusBucket)}
          />

          <ul
            className={classNames(
              'tw:flex tw:flex-col',
              TOPIC_FILTERED_LIST_CLASSES
            )}
            data-testid="pipeline-status-rows">
            {visibleRows.map((row) => (
              <PipelineStatusRow
                key={row.pipelineId}
                runs={runsByFqn[row.pipelineFqn] ?? []}
                summary={row}
              />
            ))}
          </ul>
        </>
      )}
    </TopicCard>
  );
};

export default PipelineStatusWidget;
