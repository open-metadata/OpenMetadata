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

// AI shell entity pages: the active tab panel fills the rest of the canvas, so a
// tab's empty-state card reaches the bottom of the page body with its content
// centred instead of ending under the content. Scoped to the AI shell
// (`.assistant-content`) and to pages that render entity tabs; each level of the
// page stack, tabs and active panel grows into the space below it.
export const ENTITY_TABS_FILL_GRID_CLASS =
  'tw:in-[.assistant-content]:has-[.entity-details-page-tabs]:min-h-full';

export const ENTITY_TABS_FILL_COLUMN_CLASS = [
  'tw:in-[.assistant-content]:has-[.entity-details-page-tabs]:flex',
  'tw:in-[.assistant-content]:has-[.entity-details-page-tabs]:flex-col',
  'tw:in-[.assistant-content]:has-[.entity-details-page-tabs]:*:flex-[1_0_auto]',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs]:flex',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs]:flex-col',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs]:flex-[1_0_auto]',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs>*]:flex-[1_0_auto]',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_[role=tabpanel]]:flex',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_[role=tabpanel]]:flex-col',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_[role=tabpanel]]:flex-[1_0_auto]',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_[role=tabpanel]>*]:flex-[1_0_auto]',
  // Sample Data's empty state carries a classic-shell viewport height from LESS; the
  // panel already sizes it here. `!` because unlayered LESS beats layered utilities.
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_.error-placeholder]:h-auto!',
].join(' ');
