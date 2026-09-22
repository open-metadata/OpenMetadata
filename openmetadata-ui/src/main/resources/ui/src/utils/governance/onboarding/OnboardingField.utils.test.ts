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
  Assistance,
  CheckType,
  OnboardingStep,
  Operator,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import {
  describeCondition,
  describeRule,
  dtypeOf,
  DTYPE_LABEL_KEY,
  estimateMinutes,
  formatAge,
  stageLabel,
} from './OnboardingField.utils';

const step = (overrides: Partial<OnboardingStep> = {}): OnboardingStep => ({
  id: 'check',
  type: CheckType.Attribute,
  ...overrides,
});

const property = (name: string, type: string): CustomProperty => ({
  name,
  description: name,
  propertyType: { id: name, type: 'type', name: type },
});

describe('dtypeOf', () => {
  it('answers by check type before looking at a field', () => {
    expect(dtypeOf(step({ type: CheckType.Approval }))).toBe('workflow');
    expect(dtypeOf(step({ type: CheckType.Assessment }))).toBe('automated');
  });

  it('knows the shape a native field holds', () => {
    expect(dtypeOf(step({ fieldPath: 'description' }))).toBe('markdown');
    expect(dtypeOf(step({ fieldPath: 'tags' }))).toBe('tag[]');
    expect(dtypeOf(step({ fieldPath: 'glossaryTerms' }))).toBe('termRef[]');
    expect(dtypeOf(step({ fieldPath: 'owners' }))).toBe('user[]');
  });

  it('falls back to text for a field nothing is known about', () => {
    expect(dtypeOf(step({ fieldPath: 'displayName' }))).toBe('string');
    expect(dtypeOf(step({ fieldPath: 'somethingNew' }))).toBe('string');
  });

  it('reads a custom property shape from its declared property type', () => {
    const properties = [
      property('retentionPolicy', 'enum'),
      property('reviewedOn', 'date-cp'),
    ];

    expect(
      dtypeOf(step({ fieldPath: 'extension.retentionPolicy' }), properties)
    ).toBe('enum');
    expect(
      dtypeOf(step({ fieldPath: 'extension.reviewedOn' }), properties)
    ).toBe('date');
  });

  it('treats an unknown custom property as text rather than failing', () => {
    expect(dtypeOf(step({ fieldPath: 'extension.gone' }), [])).toBe('string');
  });

  it('has a label for every shape', () => {
    Object.values(DTYPE_LABEL_KEY).forEach((key) =>
      expect(key).toMatch(/^label\./)
    );
  });
});

describe('estimateMinutes', () => {
  it('counts an unassisted check as three minutes and an assisted one as one', () => {
    expect(
      estimateMinutes([
        step({ assistance: Assistance.None }),
        step({ assistance: Assistance.Example }),
        step({ assistance: Assistance.Autofill }),
        step(),
      ])
    ).toBe(8);
  });

  it('is zero for an empty gate', () => {
    expect(estimateMinutes([])).toBe(0);
  });
});

describe('describeRule', () => {
  it('describes an approval as a recorded decision, whatever its rules say', () => {
    expect(
      describeRule(step({ type: CheckType.Approval, rules: { minLength: 10 } }))
    ).toEqual({ key: 'message.accepted-when-decision-recorded' });
  });

  it('prefers a length rule, then a count rule, then non-empty', () => {
    expect(describeRule(step({ rules: { minLength: 120 } }))).toEqual({
      key: 'message.accepted-when-min-length',
      count: 120,
    });
    expect(describeRule(step({ rules: { minItems: 3 } }))).toEqual({
      key: 'message.accepted-when-min-items',
      count: 3,
    });
    expect(describeRule(step())).toEqual({
      key: 'message.accepted-when-not-empty',
    });
  });
});

describe('describeCondition', () => {
  it('names the field and the value the check is gated on', () => {
    expect(
      describeCondition({
        fieldPath: 'tags',
        operator: Operator.StartsWith,
        value: 'PII.',
      })
    ).toEqual({
      key: 'message.condition-starts-with',
      field: 'tags',
      value: 'PII.',
    });
  });

  it('leaves the value blank when the operator does not take one', () => {
    expect(
      describeCondition({ fieldPath: 'tags', operator: Operator.Present })
    ).toEqual({
      key: 'message.condition-present',
      field: 'tags',
      value: '',
    });
  });
});

describe('formatAge', () => {
  const now = Date.parse('2026-09-18T12:00:00Z');

  it('has nothing to say about an asset with no timestamp', () => {
    expect(formatAge(undefined, 'en-US', 'just now', now)).toBeUndefined();
  });

  it('says just now inside the first minute', () => {
    expect(formatAge(now - 30_000, 'en-US', 'just now', now)).toBe('just now');
  });

  it('picks the coarsest unit that still has a whole number in it', () => {
    expect(formatAge(now - 45 * 60_000, 'en-US', 'just now', now)).toBe('45m');
    expect(formatAge(now - 4 * 3_600_000, 'en-US', 'just now', now)).toBe('4h');
    expect(formatAge(now - 6 * 86_400_000, 'en-US', 'just now', now)).toBe(
      '6d'
    );
  });

  it('never reports a negative age for a clock-skewed timestamp', () => {
    expect(formatAge(now + 86_400_000, 'en-US', 'just now', now)).toBe(
      'just now'
    );
  });
});

describe('stageLabel', () => {
  const translate = (key: string) => `t:${key}`;

  it('prefers the name the playbook gave the stage', () => {
    expect(
      stageLabel('draft', translate, [
        { key: 'draft', displayName: 'Working copy', order: 1 },
      ])
    ).toBe('Working copy');
  });

  it('falls back to the shared translation for a default stage', () => {
    expect(stageLabel('inReview', translate)).toBe('t:label.in-review');
  });

  it('shows an unknown stage as itself rather than a missing key', () => {
    expect(stageLabel('stage1758', translate)).toBe('stage1758');
  });
});
