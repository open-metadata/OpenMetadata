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

export const USER_ASSETS_PANEL_PATH = 'user-assets';

// Drawers and personal-space asset lists sit on their host's surface.
export const TRANSPARENT_PANEL_PATHS = new Set([
  'explore',
  'lineage',
  USER_ASSETS_PANEL_PATH,
]);
