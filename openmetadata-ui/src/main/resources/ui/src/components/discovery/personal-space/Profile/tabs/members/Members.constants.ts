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

import { Clock, ShieldTick, User01, Users01 } from '@untitledui/icons';

import type { MembersLandingCard, TimeWindowOption } from './Members.types';

export const LANDING_CARDS: MembersLandingCard[] = [
  {
    id: 'teams',
    icon: Users01,
    titleKey: 'label.team-plural',
    descriptionKey: 'message.members-teams-description',
    view: { type: 'teams' },
  },
  {
    id: 'users',
    icon: User01,
    titleKey: 'label.user-plural',
    descriptionKey: 'message.members-users-description',
    view: { type: 'users' },
  },
  {
    id: 'admins',
    icon: ShieldTick,
    titleKey: 'label.admin-plural',
    descriptionKey: 'message.members-admins-description',
    view: { type: 'admins' },
  },
  {
    id: 'online-users',
    icon: Clock,
    titleKey: 'label.online-user-plural',
    descriptionKey: 'message.members-online-users-description',
    view: { type: 'online-users' },
  },
];

export const TIME_WINDOW_OPTIONS: TimeWindowOption[] = [
  { value: 5, labelKey: 'label.last-n-minutes', labelParams: { n: 5 } },
  { value: 60, labelKey: 'label.last-hour' },
  { value: 1440, labelKey: 'label.last-24-hours' },
  { value: 10080, labelKey: 'label.last-7-days' },
  { value: 43200, labelKey: 'label.last-30-days' },
  { value: 0, labelKey: 'label.all-time' },
];

export const DEFAULT_TIME_WINDOW = 1440;
