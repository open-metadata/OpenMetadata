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

/**
 * Identifier for the app-mode sidebar persona customization. Doubles as:
 *  - the `:pageFqn` segment of the customize-page route
 *  - the key under `document.data` in the persona doc-store document
 *  - the category key on the persona "Customize UI" tab
 */
export const APP_MODE_SIDEBAR_CUSTOMIZATION_KEY = 'askCollateSidebar';

/**
 * Number of nav items shown directly in the app-mode sidebar; the rest go
 * under "More". The default visible slice covers the first entries in
 * `navOrder`, with the overflow collapsing into the "More" popover.
 */
export const APP_MODE_SIDEBAR_VISIBLE_ITEM_COUNT = 10;

/**
 * Dispatched on `window` after the customize-sidebar page saves a persona's
 * sidebar customization. `useCustomizedMainNav` listens for this so the live
 * sidebar picks up the change immediately instead of waiting for the persona
 * to be reselected or the app to reload.
 */
export const APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT =
  'appMode:sidebar-customization-changed';
