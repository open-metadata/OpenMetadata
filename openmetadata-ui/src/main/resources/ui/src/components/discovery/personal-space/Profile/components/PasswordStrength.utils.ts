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

export enum PasswordRuleId {
  Length = 'length',
  MixedCase = 'mixed-case',
  Number = 'number',
  Symbol = 'symbol',
}

export enum StrengthLevel {
  Weak = 'weak',
  Medium = 'medium',
  Strong = 'strong',
}

export interface PasswordRule {
  id: PasswordRuleId;
  /** Translation key rendered next to the rule's checkbox. */
  labelKey: string;
  isSatisfied: (password: string) => boolean;
}

/**
 * The four rules together are equivalent to the server-side password pattern
 * (`passwordRegex`): 8-56 non-whitespace characters with at least one
 * lowercase, one uppercase, one digit and one special character. Keeping them
 * as separate predicates lets the UI show which requirement is still missing,
 * and avoids `passwordRegex`'s `g` flag, whose `lastIndex` makes repeated
 * `test()` calls on the same instance return alternating results.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: PasswordRuleId.Length,
    labelKey: 'message.password-rule-length',
    isSatisfied: (password) => /^\S{8,56}$/.test(password),
  },
  {
    id: PasswordRuleId.MixedCase,
    labelKey: 'message.password-rule-mixed-case',
    isSatisfied: (password) => /[a-z]/.test(password) && /[A-Z]/.test(password),
  },
  {
    id: PasswordRuleId.Number,
    labelKey: 'message.password-rule-number',
    isSatisfied: (password) => /\d/.test(password),
  },
  {
    id: PasswordRuleId.Symbol,
    labelKey: 'message.password-rule-symbol',
    isSatisfied: (password) => /[^\w\d\s:]/.test(password),
  },
];

export const getSatisfiedPasswordRuleIds = (
  password: string
): PasswordRuleId[] =>
  PASSWORD_RULES.filter((rule) => rule.isSatisfied(password)).map(
    (rule) => rule.id
  );

export const isPasswordValid = (password: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.isSatisfied(password));

/**
 * Strength is derived from how many rules pass: everything short of all four
 * is at best `Medium`, so the meter never reads "Strong" for a password the
 * server would reject.
 */
export const getPasswordStrength = (password: string): StrengthLevel => {
  const satisfiedCount = getSatisfiedPasswordRuleIds(password).length;

  if (satisfiedCount === PASSWORD_RULES.length) {
    return StrengthLevel.Strong;
  }

  return satisfiedCount > 1 ? StrengthLevel.Medium : StrengthLevel.Weak;
};
