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

// The core Card's surface and hover. In light a hovered card turns gray-blue
// and what sits on it (its message, a change's panel) shows white. In dark the
// hover tint is translucent, so it is laid over the surface, not swapped in for
// it: swapped, the page shows through and the card darkens instead of lifting.
export const ACTIVITY_CARD_CLASS = classNames(
  'tw:group/activity-card tw:rounded-xl tw:border tw:border-subtle tw:bg-surface tw:pb-4 tw:shadow-xs',
  'tw:transition-colors tw:hover:border-primary tw:hover:bg-utility-gray-blue-50',
  'tw:dark:hover:bg-surface tw:dark:hover:bg-[linear-gradient(var(--tw-background-color-primary_hover),var(--tw-background-color-primary_hover))]'
);

// A message on a hovered card: white against the card's gray-blue in light;
// dark keeps its well.
export const ACTIVITY_CARD_MESSAGE_HOVER_CLASS =
  'tw:group-hover/activity-card:bg-surface tw:dark:group-hover/activity-card:bg-primary';

// A change's panel on a hovered card keeps its white in light, so its Before
// stays distinct from the card's gray-blue; dark keeps it clear.
export const ACTIVITY_CARD_PANEL_HOVER_CLASS =
  'tw:group-hover/activity-card:bg-surface tw:dark:group-hover/activity-card:bg-transparent';
