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

import { Edit05, File02, Globe01, Tag01, UserCheck01 } from '@untitledui/icons';
import { FC } from 'react';
import { ACTIVITY_TYPE_OTHER } from './inbox.utils';

/** How a kind of change is drawn: its icon, badge fill and icon tint. */
export interface ActivityKind {
  icon: FC<{ className?: string }>;
  badgeClassName: string;
  iconClassName: string;
}

// Keyed by the Type filter's keys (getActivityTypeKey), so a card's badge and
// its Type option always agree.
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
