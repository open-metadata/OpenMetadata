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
  ActivityAssetCreated,
  ActivityAssetDeleted,
  ActivityAssetRestored,
  ActivityAssetSoftDeleted,
  ActivityAssetUpdated,
  ActivityColumnDescriptionUpdated,
  ActivityColumnTagsUpdated,
  ActivityConversation,
  ActivityCustomPropertyUpdated,
  ActivityDescriptionUpdated,
  ActivityDomainChanged,
  ActivityOwnerChanged,
  ActivityPipelineStatusChanged,
  ActivityTagsUpdated,
  ActivityTestCaseStatusChanged,
  ActivityTierChanged,
  Edit05,
  File02,
  Globe01,
  Tag01,
  UserCheck01,
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { ActivityEventType } from '../../../../generated/entity/activity/activityEvent';
import { ACTIVITY_TYPE_OTHER } from './inbox.utils';

/** How a kind of change is drawn: its icon, badge fill and icon tint. */
export interface ActivityKind {
  icon: FC<{ className?: string }>;
  badgeClassName: string;
  iconClassName: string;
}

// The Type filter's options, keyed by its keys (getActivityTypeKey).
export const ACTIVITY_TYPE_KIND: Record<string, ActivityKind> = {
  'label.tag-plural': {
    icon: Tag01,
    badgeClassName: 'tw:bg-utility-purple-600',
    iconClassName: 'tw:text-utility-purple-600',
  },
  'label.owner-plural': {
    icon: UserCheck01,
    badgeClassName: 'tw:bg-utility-indigo-600',
    iconClassName: 'tw:text-utility-indigo-600',
  },
  'label.domain-plural': {
    icon: Globe01,
    badgeClassName: 'tw:bg-utility-blue-light-600',
    iconClassName: 'tw:text-utility-blue-light-600',
  },
  'label.description': {
    icon: File02,
    badgeClassName: 'tw:bg-utility-blue-600',
    iconClassName: 'tw:text-utility-blue-600',
  },
  [ACTIVITY_TYPE_OTHER]: {
    icon: Edit05,
    badgeClassName: 'tw:bg-utility-gray-600',
    iconClassName: 'tw:text-utility-gray-600',
  },
};

/** The badge on an actor's avatar: its icon and fill. */
export type ActivityBadge = Pick<ActivityKind, 'icon' | 'badgeClassName'>;

export const CONVERSATION_BADGE: ActivityBadge = {
  icon: ActivityConversation,
  badgeClassName: 'tw:bg-utility-yellow-700',
};

// One badge per kind of activity, as the design's "Activity icons" draws them.
// The fills are the nearest utility tokens to the design's colors.
export const ACTIVITY_EVENT_BADGE: Record<ActivityEventType, ActivityBadge> = {
  [ActivityEventType.EntityCreated]: {
    icon: ActivityAssetCreated,
    badgeClassName: 'tw:bg-utility-pink-700',
  },
  [ActivityEventType.EntityRestored]: {
    icon: ActivityAssetRestored,
    badgeClassName: 'tw:bg-utility-green-700',
  },
  [ActivityEventType.EntityDeleted]: {
    icon: ActivityAssetDeleted,
    badgeClassName: 'tw:bg-utility-success-700',
  },
  [ActivityEventType.EntitySoftDeleted]: {
    icon: ActivityAssetSoftDeleted,
    badgeClassName: 'tw:bg-utility-blue-dark-700',
  },
  [ActivityEventType.DescriptionUpdated]: {
    icon: ActivityDescriptionUpdated,
    badgeClassName: 'tw:bg-utility-error-700',
  },
  [ActivityEventType.ColumnDescriptionUpdated]: {
    icon: ActivityColumnDescriptionUpdated,
    badgeClassName: 'tw:bg-utility-gray-blue-500',
  },
  [ActivityEventType.TagsUpdated]: {
    icon: ActivityTagsUpdated,
    badgeClassName: 'tw:bg-utility-blue-light-700',
  },
  [ActivityEventType.ColumnTagsUpdated]: {
    icon: ActivityColumnTagsUpdated,
    badgeClassName: 'tw:bg-utility-purple-600',
  },
  [ActivityEventType.OwnerUpdated]: {
    icon: ActivityOwnerChanged,
    badgeClassName: 'tw:bg-utility-blue-light-700',
  },
  [ActivityEventType.DomainUpdated]: {
    icon: ActivityDomainChanged,
    badgeClassName: 'tw:bg-utility-orange-700',
  },
  [ActivityEventType.TierUpdated]: {
    icon: ActivityTierChanged,
    badgeClassName: 'tw:bg-utility-success-700',
  },
  [ActivityEventType.CustomPropertyUpdated]: {
    icon: ActivityCustomPropertyUpdated,
    badgeClassName: 'tw:bg-utility-blue-dark-700',
  },
  [ActivityEventType.TestCaseStatusChanged]: {
    icon: ActivityTestCaseStatusChanged,
    badgeClassName: 'tw:bg-utility-orange-dark-700',
  },
  [ActivityEventType.PipelineStatusChanged]: {
    icon: ActivityPipelineStatusChanged,
    badgeClassName: 'tw:bg-utility-gray-800',
  },
  [ActivityEventType.EntityUpdated]: {
    icon: ActivityAssetUpdated,
    badgeClassName: 'tw:bg-utility-green-700',
  },
};
