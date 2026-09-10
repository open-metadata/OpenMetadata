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

import type {
  BadgeColors,
  IconComponentType,
} from '@openmetadata/ui-core-components';
import {
  ArrowCircleDown,
  CheckCircle,
  Clipboard,
  Eye,
  XCircle,
} from '@untitledui/icons';
import { isNil } from 'lodash';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { EntityStatus } from '../generated/entity/data/glossaryTerm';

export const EntityStatusClass: Record<EntityStatus, StatusType> = {
  [EntityStatus.Approved]: StatusType.Success,
  [EntityStatus.Draft]: StatusType.Pending,
  [EntityStatus.Rejected]: StatusType.Failure,
  [EntityStatus.Deprecated]: StatusType.Deprecated,
  [EntityStatus.InReview]: StatusType.InReview,
  [EntityStatus.Unprocessed]: StatusType.Pending,
  [EntityStatus.Archived]: StatusType.Archived,
};

export const getEntityStatusClass = (status: EntityStatus): StatusType => {
  return EntityStatusClass[status] ?? StatusType.Pending;
};

export interface StatusBadgeConfig {
  color: BadgeColors;
  icon: IconComponentType;
}

const DEFAULT_STATUS_BADGE_CONFIG: StatusBadgeConfig = {
  color: 'success',
  icon: CheckCircle,
};

export const StatusBadgeConfigs: Partial<
  Record<StatusType, StatusBadgeConfig>
> = {
  [StatusType.Success]: DEFAULT_STATUS_BADGE_CONFIG,
  [StatusType.Failure]: { color: 'error', icon: XCircle },
  [StatusType.InReview]: { color: 'purple', icon: Eye },
  [StatusType.Pending]: { color: 'warning', icon: Clipboard },
  [StatusType.Deprecated]: { color: 'gray', icon: ArrowCircleDown },
  [StatusType.Archived]: { color: 'gray', icon: ArrowCircleDown },
};

export const getEntityStatusBadgeConfig = (
  status?: string
): StatusBadgeConfig =>
  StatusBadgeConfigs[EntityStatusClass[status as EntityStatus]] ??
  DEFAULT_STATUS_BADGE_CONFIG;

export const isDeleted = (deleted: unknown): boolean => {
  return (deleted as string) === 'false' || deleted === false || isNil(deleted)
    ? false
    : true;
};
