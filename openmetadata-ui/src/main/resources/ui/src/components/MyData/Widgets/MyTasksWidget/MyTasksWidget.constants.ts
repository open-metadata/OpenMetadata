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
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  IconProps,
  Key01,
} from '@openmetadata/ui-core-components/icons';
import type { FC } from 'react';
import { MyTaskBucket } from '../../../../utils/myTaskBuckets';
import { TOPIC_BLUE_TILE_CLASSES } from '../Common/TopicWidget/topicRowStyles';

export const MY_TASKS_TONE: Pick<MyTaskKindStyle, 'icon' | 'tile'> = {
  icon: ClipboardCheck,
  tile: TOPIC_BLUE_TILE_CLASSES,
};

export interface MyTaskKindStyle {
  icon: FC<IconProps>;
  tile: string;
  labelKey: string;
}

export const MY_TASK_KIND_STYLES: Record<MyTaskBucket, MyTaskKindStyle> = {
  [MyTaskBucket.INCIDENTS]: {
    icon: AlertTriangle,
    labelKey: 'label.incident',
    tile: 'tw:bg-utility-error-50 tw:text-utility-error-600',
  },
  [MyTaskBucket.ACCESS]: {
    icon: Key01,
    labelKey: 'label.access-request',
    tile: 'tw:bg-utility-blue-light-50 tw:text-utility-blue-light-600',
  },
  [MyTaskBucket.APPROVALS]: {
    icon: CheckCircle,
    labelKey: 'label.approval',
    tile: 'tw:bg-utility-blue-50 tw:text-utility-blue-600',
  },
  [MyTaskBucket.ALL]: {
    icon: ClipboardCheck,
    labelKey: 'label.task',
    tile: 'tw:bg-utility-gray-50 tw:text-utility-gray-600',
  },
};

// The inbox shows `TASK-00042` as `#00042`; the card reads the same.
export const TASK_ID_PREFIX = 'TASK-';
