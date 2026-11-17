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
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';

/** The menu label for requesting each stage the lifecycle can be asked for. */
export const STAGE_ACTION: Partial<Record<EntityStatus, string>> = {
  [EntityStatus.Deprecated]: 'label.deprecate',
  [EntityStatus.Archived]: 'label.archive',
};

// The badge itself is the trigger, as the incident status chip is: no padding or fill of its own.
export const STAGE_TRIGGER_CLASS =
  'tw:h-auto tw:min-h-0 tw:gap-0.5 tw:p-0 tw:shadow-none tw:after:outline-0 tw:bg-transparent';

// Every stage badge in the menu has one width, so the column reads as a list: wide enough for the
// longest stage name ("Unprocessed") with its icon.
export const STAGE_MENU_BADGE_CLASS = 'tw:w-30 tw:shrink-0 tw:justify-center';

// Wide enough for "Move to <stage>" plus the stage's badge on one line.
export const STAGE_MENU_CLASS = 'tw:w-auto tw:min-w-62';

// Lines up with the items' icons: the item's outer and inner padding add up to 16px.
export const STAGE_MENU_HEADER_CLASS =
  'tw:px-4 tw:pt-1.5 tw:pb-1 tw:text-xs tw:font-semibold tw:text-quaternary';

/** The pending-request label for each stage; other stages read "<stage> requested". */
export const STAGE_REQUESTED: Partial<Record<EntityStatus, string>> = {
  [EntityStatus.Deprecated]: 'label.deprecation-requested',
  [EntityStatus.Archived]: 'label.archival-requested',
};
