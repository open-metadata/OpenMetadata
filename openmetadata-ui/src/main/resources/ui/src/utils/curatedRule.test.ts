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
import {
  buildCuratedQueryFilter,
  DEFAULT_CURATED_RULE,
  describeCuratedClause,
  describeCuratedRule,
} from './curatedRule';

// Stands in for i18next: interpolates `{{field}} is {{value}}` the way the en
// bundle would, and echoes any other key.
const t = ((key: string, options?: Record<string, string>) =>
  key === 'message.field-is-value'
    ? `${options?.field} is ${options?.value}`
    : key) as never;

describe('curatedRule', () => {
  it('requires every clause, so the rule reads as an AND', () => {
    expect(
      buildCuratedQueryFilter(DEFAULT_CURATED_RULE).query.bool.must
    ).toEqual([
      { term: { 'tier.tagFQN': 'Tier.Tier1' } },
      { term: { 'certification.tagLabel.tagFQN': 'Certification.Gold' } },
    ]);
  });

  it('describes a clause through one interpolated key', () => {
    expect(describeCuratedClause(DEFAULT_CURATED_RULE[0], t)).toBe(
      'label.tier is Tier1'
    );
  });

  // The summary used to be joined with a hardcoded ', '. The conjunction is
  // the locale's, so English reads "and" and another language its own word.
  it('joins the clauses with the locale conjunction', () => {
    expect(describeCuratedRule(DEFAULT_CURATED_RULE, t, 'en')).toBe(
      'label.tier is Tier1 and label.certification is Gold'
    );
    expect(describeCuratedRule(DEFAULT_CURATED_RULE, t, 'fr')).toBe(
      'label.tier is Tier1 et label.certification is Gold'
    );
  });
});
