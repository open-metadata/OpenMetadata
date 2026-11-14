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

import { CLEAR_OF_STUDIO_DRAWER } from '../OntologyStudioDrawer/OntologyStudioDrawer.constants';

export const AI_GRAPH_BACKDROP_CLASS = [
  'tw:pointer-events-none tw:absolute tw:inset-0 tw:z-0 tw:bg-secondary_alt tw:[background-size:18px_18px]',
  'tw:[background-image:radial-gradient(circle,var(--tw-border-color-secondary)_1px,transparent_1px)]',
].join(' ');
export const AI_GRAPH_CONTROLS_CLASS =
  'tw:absolute tw:bottom-3.5 tw:left-3.5 tw:z-6 tw:overflow-hidden tw:rounded-md tw:border tw:border-secondary tw:bg-surface tw:shadow-xs';
// Data-mode side panels: sized to their content and capped above the canvas's bottom toolbar,
// so the footer action is never covered.
export const DATA_PANEL_CLASS = [
  'tw:absolute tw:top-16 tw:right-3.5 tw:z-20 tw:flex tw:max-h-[calc(100%-9rem)] tw:w-80 tw:flex-col',
  CLEAR_OF_STUDIO_DRAWER,
  'tw:overflow-hidden tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:shadow-lg',
].join(' ');
export const DATA_PANEL_SECTION_CLASS =
  'tw:border-t tw:border-secondary tw:px-4 tw:py-3';
export const GRAPH_MODES = ['model', 'data'] as const;

export type OntologyGraphMode = (typeof GRAPH_MODES)[number];
