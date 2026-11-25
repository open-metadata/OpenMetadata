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

// Team tab content is padded by `.teams-scroll-component` (teams.less) for its tables; the
// empty state cancels that padding with the same tokens so it fills the tab panel edge to edge.
export const TEAM_TAB_EMPTY_STATE_CLASS =
  'tw:relative tw:-mx-(--om-space-20) tw:-my-(--om-space-8) tw:h-full tw:min-h-60 tw:rounded-xl tw:bg-surface';
