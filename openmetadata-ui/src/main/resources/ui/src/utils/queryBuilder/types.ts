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
import type { RenderSettings } from '@react-awesome-query-builder/ui';

// Whether the user may create their own bracketed sub-groups.
export const QUERY_BUILDER_GROUP_MODE = {
  NESTED: 'nested',
  FLAT: 'flat',
} as const;

export type GroupMode =
  (typeof QUERY_BUILDER_GROUP_MODE)[keyof typeof QUERY_BUILDER_GROUP_MODE];

// Which ground the group card sits on.
export const QUERY_BUILDER_SURFACE = {
  // White — for a card sitting on a tinted or grouped background.
  PLAIN: 'plain',
  // Tinted — for a card sitting on white.
  SUBTLE: 'subtle',
} as const;

export type QueryBuilderSurface =
  (typeof QUERY_BUILDER_SURFACE)[keyof typeof QUERY_BUILDER_SURFACE];

// How each surface paints its card.
export const QUERY_BUILDER_SURFACE_CLASS: Record<
  QueryBuilderSurface,
  { card: string; header: string }
> = {
  [QUERY_BUILDER_SURFACE.PLAIN]: {
    card: 'tw:bg-primary tw:border tw:border-primary',
    header: 'tw:bg-utility-gray-blue-50 tw:border-b tw:border-primary',
  },
  [QUERY_BUILDER_SURFACE.SUBTLE]: {
    card: 'tw:bg-utility-gray-blue-50',
    header: 'tw:border-b tw:border-secondary',
  },
};

// The conjunction values RAQB itself uses as tree keys.
export const QUERY_BUILDER_CONJUNCTION = {
  AND: 'AND',
  OR: 'OR',
} as const;

// How the AND/OR control behaves.
export const QUERY_BUILDER_CONJUNCTION_MODE = {
  EDITABLE: 'editable',
  AND: 'and',
  OR: 'or',
} as const;

export type ConjunctionMode =
  (typeof QUERY_BUILDER_CONJUNCTION_MODE)[keyof typeof QUERY_BUILDER_CONJUNCTION_MODE];

// The jobs `isExplorePage` used to conflate, as separate inputs.
export interface QueryBuilderConfigModes {
  // Renders the "Fields:" / "Condition:" / "Criteria:" column labels.
  showLabels?: boolean;
  // `is` / `is not` / `is set` instead of `equal` / `not equal` / `not null`.
  useFriendlyOperatorLabels?: boolean;
  // RAQB `settings.renderButton`.
  renderButton?: RenderSettings['renderButton'];
}
