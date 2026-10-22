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

import { AssetsFilterOptions } from '../../../../constants/Assets.constants';
import { UserAssetsKind } from './UserAssets.utils';

export const SEARCH_DEBOUNCE_MS = 300;

export const INCIDENT_PAGE_SIZE = 100;
// Backstop for the incident paging loop: a cursor that never ends stops here.
export const INCIDENT_MAX_PAGES = 50;

// Queries relate to data via `queryUsedIn.id` (the tables they touch), not via
// ownership, so the query count is scoped to the user's owned tables. Only the
// 1000 most-used ones are fetched: queries on owned tables past that cap are
// not counted.
export const OWNED_TABLES_LIMIT = 1000;
export const SKELETON_KEYS = [1, 2, 3];
// Once the trail has collapsed to first + last, each crumb ellipsizes past this.
export const CRUMB_MAX_WIDTH = 200;

export const TYPE_OPTIONS = AssetsFilterOptions.map(({ label, value }) => ({
  label,
  value,
}));

// [title, description] keys, for the current user and for anyone else.
export const EMPTY_STATE_COPY: Record<
  UserAssetsKind,
  Record<'self' | 'other', [string, string]>
> = {
  owned: {
    self: [
      'message.you-do-not-own-any-assets',
      'message.your-owned-assets-appear-here',
    ],
    other: [
      'message.user-does-not-own-any-assets',
      'message.user-owned-assets-appear-here',
    ],
  },
  following: {
    self: [
      'message.you-are-not-following-anything',
      'message.follow-assets-to-get-updates',
    ],
    other: [
      'message.user-is-not-following-anything',
      'message.user-followed-assets-appear-here',
    ],
  },
};
