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

/** One `<field> is <value>` clause of a curated-assets rule. */
export interface CuratedRuleClause {
  /** i18n key naming the field, e.g. `label.tier`. */
  labelKey: string;
  /** Search keyword field the clause filters on. */
  termKey: string;
  /** Raw value as stored in the index, e.g. `Tier.Tier1`. */
  termValue: string;
  /** What the chip shows for the value — the tag's leaf, not its FQN. */
  displayValue: string;
}

export type CuratedRule = CuratedRuleClause[];

/**
 * The rule the card filters by when its layout entry carries no saved config.
 *
 * An admin who opens `CuratedAssetsModal` from the persona editor saves an
 * advanced filter onto the widget's entry, and that wins (see
 * {@link CuratedAssetsSource}). This is the out-of-the-box rule for a widget
 * nobody has configured yet — the chips and the query are both derived from it.
 */
export const DEFAULT_CURATED_RULE: CuratedRule = [
  {
    displayValue: 'Tier1',
    labelKey: 'label.tier',
    termKey: 'tier.tagFQN',
    termValue: 'Tier.Tier1',
  },
  {
    displayValue: 'Gold',
    labelKey: 'label.certification',
    termKey: 'certification.tagLabel.tagFQN',
    termValue: 'Certification.Gold',
  },
];

/** Every clause must match, so the rule reads as an AND across its chips. */
export const buildCuratedQueryFilter = (rule: CuratedRule) => ({
  query: {
    bool: {
      must: rule.map((clause) => ({
        term: { [clause.termKey]: clause.termValue },
      })),
    },
  },
});
