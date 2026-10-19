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

import type { BadgeColors, Typography } from '@openmetadata/ui-core-components';
import type { ComponentProps } from 'react';
import { RelationCategory } from './KnowledgeGraph.relations';

/**
 * Chips shown per cell before the rest collapse behind "+N more".
 * ADR:2026-10-19-kg-inspector-expands-relationships-inline
 */
export const CHIP_LIMIT = 5;

export const FAMILY_BADGE_COLORS: Record<RelationCategory, BadgeColors> = {
  lineage: 'blue-dark',
  structure: 'gray-blue',
  ontology: 'purple',
  governance: 'success',
  ownership: 'orange',
  quality: 'pink',
  other: 'gray',
};

export type CellTone = 'primary' | 'muted' | 'brand' | 'warning' | 'success';

/**
 * Typography props per cell tone. Uses the `color` prop where Typography has
 * the tone; primary and brand have no `color` option, so they keep a class.
 */
export const CELL_TONE_PROPS: Record<
  CellTone,
  Pick<ComponentProps<typeof Typography>, 'color' | 'weight' | 'className'>
> = {
  primary: { className: 'tw:text-primary' },
  muted: { color: 'secondary' },
  brand: { className: 'tw:text-brand-secondary' },
  warning: { color: 'warning', weight: 'semibold' },
  success: { color: 'success' },
};
