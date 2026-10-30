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
// (`.assistant-content`) and applied only by pages that render entity tabs
// (PageLayoutV1's `fillEntityTabs`); each level of the page stack, tabs and
// active panel grows into the space below it. Never gate these with
// `:has(.entity-details-page-tabs)`: see ADR:2026-10-23-page-layout-wrappers-never-use-has-selectors.
export const ENTITY_TABS_FILL_GRID_CLASS =
  'tw:in-[.assistant-content]:min-h-full';

export const ENTITY_TABS_FILL_COLUMN_CLASS = [
  'tw:in-[.assistant-content]:flex',
  'tw:in-[.assistant-content]:flex-col',
  'tw:in-[.assistant-content]:*:flex-[1_0_auto]',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs]:flex',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs]:flex-col',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs]:flex-[1_0_auto]',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs>*]:flex-[1_0_auto]',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_[role=tabpanel]]:flex',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_[role=tabpanel]]:flex-col',
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_[role=tabpanel]]:flex-[1_0_auto]',
  // A spinner keeps its square size; growing it stretches it into an ellipse.
  'tw:in-[.assistant-content]:[&_.entity-details-page-tabs_[role=tabpanel]>*:not(.loader)]:flex-[1_0_auto]',
].join(' ');
