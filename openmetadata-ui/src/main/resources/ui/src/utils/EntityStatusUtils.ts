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

import { BadgeColors } from '@openmetadata/ui-core-components';
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

/**
 * BadgeColors equivalent of EntityStatusClass, for the UntitledUI Badge family.
 * Kept in the same palette as the legacy StatusBadge (`status-badge.less`) so a
 * status looks the same in both stacks: approved green, draft/unprocessed
 * yellow, in-review purple, rejected red, deprecated/archived grey.
 */
export const EntityStatusBadgeColor: Record<EntityStatus, BadgeColors> = {
  [EntityStatus.Approved]: 'success',
  [EntityStatus.Draft]: 'warning',
  [EntityStatus.Rejected]: 'error',
  [EntityStatus.Deprecated]: 'gray',
  [EntityStatus.InReview]: 'purple',
  [EntityStatus.Unprocessed]: 'warning',
  [EntityStatus.Archived]: 'gray',
};

/**
 * Takes the enum's string values rather than the enum itself: quicktype re-emits
 * EntityStatus per entity with no shared module, and TS string enums are nominal,
 * so callers holding e.g. the dataContract copy could not otherwise pass it.
 *
 * Falls back to a neutral grey — an unknown or absent status must not be painted
 * as a confident success.
 */
export const getEntityStatusBadgeColor = (
  status?: `${EntityStatus}`
): BadgeColors => {
  return (status && EntityStatusBadgeColor[status]) ?? 'gray';
};

export const isDeleted = (deleted: unknown): boolean => {
  return (deleted as string) === 'false' || deleted === false || isNil(deleted)
    ? false
    : true;
};
