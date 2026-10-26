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

import type { RunHistoryStatus } from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  Clock,
  Dataflow03,
  IconProps,
  PlayCircle,
  SlashCircle01,
  XCircle,
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { StatusType } from '../../../../generated/entity/data/pipeline';
import { LastRunStatus } from '../../../../generated/type/pipelineSummary';
import type { TopicFilterTone } from '../Common/TopicWidget/TopicFilterChips';
import { TOPIC_BLUE_TILE_CLASSES } from '../Common/TopicWidget/topicRowStyles';

export interface PipelineStatusStyle {
  icon: FC<IconProps>;
  /** Tinted circle behind the icon. */
  tile: string;
  /**
   * The status label beside the pipeline name. `!` because Typography's
   * `.prose` colour rule is emitted after the utilities and would otherwise win.
   */
  text: string;
  labelKey: string;
  chipTone: TopicFilterTone;
}

/** A pipeline that has never run carries no status at all. */
export const NOT_RUN_STYLE: PipelineStatusStyle = {
  chipTone: 'muted',
  icon: Clock,
  labelKey: 'label.not-run-yet',
  text: 'tw:text-text-tertiary!',
  tile: 'tw:bg-utility-gray-50 tw:text-utility-gray-500',
};

// Spelled out rather than interpolated, which Tailwind cannot see.
export const PIPELINE_STATUS_STYLES: Record<
  LastRunStatus,
  PipelineStatusStyle
> = {
  [LastRunStatus.Failed]: {
    chipTone: 'error',
    icon: XCircle,
    labelKey: 'label.failed',
    text: 'tw:text-utility-error-700!',
    tile: 'tw:bg-utility-error-50 tw:text-utility-error-600',
  },
  [LastRunStatus.Skipped]: {
    chipTone: 'warning',
    icon: SlashCircle01,
    labelKey: 'label.skipped',
    text: 'tw:text-utility-warning-700!',
    tile: 'tw:bg-utility-warning-50 tw:text-utility-warning-600',
  },
  [LastRunStatus.Pending]: {
    chipTone: 'muted',
    icon: Clock,
    labelKey: 'label.pending',
    text: 'tw:text-text-secondary!',
    tile: 'tw:bg-utility-gray-50 tw:text-utility-gray-500',
  },
  [LastRunStatus.Running]: {
    chipTone: 'brand',
    icon: PlayCircle,
    labelKey: 'label.running',
    text: 'tw:text-utility-blue-700!',
    tile: 'tw:bg-utility-blue-50 tw:text-utility-blue-600',
  },
  [LastRunStatus.Successful]: {
    chipTone: 'success',
    icon: CheckCircle,
    labelKey: 'label.successful',
    text: 'tw:text-utility-success-700!',
    tile: 'tw:bg-utility-success-50 tw:text-utility-success-600',
  },
};

/** A recorded run's status in the history strip's vocabulary. */
export const RUN_HISTORY_STATUS: Record<StatusType, RunHistoryStatus> = {
  [StatusType.Successful]: 'success',
  [StatusType.Failed]: 'failed',
  [StatusType.Skipped]: 'skipped',
  [StatusType.Pending]: 'pending',
};

export const RUN_STATUS_LABEL_KEY: Record<StatusType, string> = {
  [StatusType.Successful]: 'label.successful',
  [StatusType.Failed]: 'label.failed',
  [StatusType.Skipped]: 'label.skipped',
  [StatusType.Pending]: 'label.pending',
};

export const PIPELINE_STATUS_TONE: {
  icon: typeof Dataflow03;
  tile: string;
} = {
  icon: Dataflow03,
  tile: TOPIC_BLUE_TILE_CLASSES,
};

/** A run's duration, at most this many units ("1h 4m", not "1h 4m 12s"). */
export const DURATION_UNITS = 2;
