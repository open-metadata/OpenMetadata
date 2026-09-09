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

/**
 * Whether the user may create their own bracketed sub-groups.
 *
 * This governs plain `type: 'group'` nodes ONLY. RAQB also models array fields
 * (`owners`, `tags`) as a `type: 'rule_group'` with `mode: 'some'`, which is
 * what lets JSONLogic emit `some`; that wrapper is structural, is seeded on
 * mount by every JSONLogic caller, and must render in both modes.
 *
 * `flat` is implemented by withholding the addGroup/delGroup affordances and
 * `canRegroup` — never by `settings.maxNesting: 1`. `maxNesting` is not the
 * lever it looks like:
 *
 *  - It does not in fact protect `rule_group`. RAQB reads `maxNesting` off the
 *    *field* config once inside a rule-group (GroupContainer.jsx:167-178,
 *    stores/tree.js:229-239), so `settings.maxNesting` never reaches it.
 *  - What it does do is break trees that are *already* nested. A saved tree
 *    with a depth-2 group makes `isMaxNestingExceeded` true, and
 *    `Group.canAddRule()` returns false whenever that flag is set
 *    (item/Group.jsx:225-239) — so switching a caller to flat mode would leave
 *    its existing filters unable to accept another condition.
 *
 * Hiding the affordance leaves saved nested trees fully editable, which is the
 * behaviour flat mode actually wants.
 */
export const QUERY_BUILDER_GROUP_MODE = {
  NESTED: 'nested',
  FLAT: 'flat',
} as const;

export type GroupMode =
  (typeof QUERY_BUILDER_GROUP_MODE)[keyof typeof QUERY_BUILDER_GROUP_MODE];

/**
 * How the AND/OR control behaves.
 *
 * Named for RAQB's own vocabulary: a "conjunction" is the AND/OR joining
 * siblings in a group, whereas an "operator" is the per-rule comparison
 * (`equal`, `like`, …). Do not overload the latter.
 */
/**
 * The conjunction values RAQB itself uses as tree keys. These are protocol,
 * not display text: they are written into `properties.conjunction` on every
 * group, matched against `config.conjunctions`, and persisted in saved
 * filters. Changing their case breaks stored trees, so the UI uppercases the
 * *label* for display (see OMConjs) rather than touching these.
 */
/**
 * Which ground the group card sits on.
 *
 * The same builder appears on surfaces of different colour — a white side
 * panel in the workflow editor, a tinted modal body in Explore — and a card
 * that is always tinted reads as a stray block on the white one. Callers pick;
 * `SUBTLE` stays the default so no existing screen shifts.
 */
export const QUERY_BUILDER_SURFACE = {
  /** White — for a card sitting on a tinted or grouped background. */
  PLAIN: 'plain',
  /** Tinted — for a card sitting on white. */
  SUBTLE: 'subtle',
} as const;

export type QueryBuilderSurface =
  (typeof QUERY_BUILDER_SURFACE)[keyof typeof QUERY_BUILDER_SURFACE];

/**
 * How each surface paints its card.
 *
 * The two are not just different fills. A card on a white page can carry the
 * tint itself; a card inside a panel that is already white needs an edge to
 * read as a card at all, so it goes white-with-a-border and moves the tint to
 * its header strip. Both tokens carry their own dark-mode value.
 */
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

export const QUERY_BUILDER_CONJUNCTION = {
  AND: 'AND',
  OR: 'OR',
} as const;

export type QueryBuilderConjunction =
  (typeof QUERY_BUILDER_CONJUNCTION)[keyof typeof QUERY_BUILDER_CONJUNCTION];

export const QUERY_BUILDER_CONJUNCTION_MODE = {
  EDITABLE: 'editable',
  AND: 'and',
  OR: 'or',
} as const;

export type ConjunctionMode =
  (typeof QUERY_BUILDER_CONJUNCTION_MODE)[keyof typeof QUERY_BUILDER_CONJUNCTION_MODE];

/**
 * The four jobs `isExplorePage` used to do, as separate inputs.
 *
 * One boolean previously decided whether field/operator labels rendered,
 * whether operators got the friendly `is` / `is not` / `is set` wording, which
 * of four button renderers was installed, and — through that last one —
 * whether nested groups were reachable at all. That is why "the Automator has
 * nesting" and "the Automator has no nesting" were both true, depending on
 * which page mounted the provider.
 *
 * Defaults reproduce the old `isExplorePage = true` branch.
 */
export interface QueryBuilderConfigModes {
  /** Renders the "Fields:" / "Condition:" / "Criteria:" column labels. */
  showLabels?: boolean;
  /** `is` / `is not` / `is set` instead of `equal` / `not equal` / `not null`. */
  useFriendlyOperatorLabels?: boolean;
  /** RAQB `settings.renderButton`. Left untyped here to keep this file JSX-free. */
  renderButton?: RenderSettings['renderButton'];
}
