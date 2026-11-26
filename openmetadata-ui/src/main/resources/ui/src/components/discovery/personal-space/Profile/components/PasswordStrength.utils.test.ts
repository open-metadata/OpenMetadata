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

import { passwordRegex } from '../../../../../constants/regex.constants';
import {
  getPasswordStrength,
  getSatisfiedPasswordRuleIds,
  isPasswordValid,
  PasswordRuleId,
  StrengthLevel,
} from './PasswordStrength.utils';

// Passay 1.6.6 `EnglishCharacterData.Special`, also pinned in PasswordUtilTest.java.
const SERVER_SPECIAL_CHARACTERS =
  '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~–—―‗‘’‚‛“”„†‡•…‰′″‹›‼‾⁄⁊₠₡₢₣₤₥₦₧₨₩₪₫€₭₮₯₰₱₲₳₴₵₶₷₸₹₺₻₼₽₾¡¢£¤¥¦§¨©ª«¬\u00AD®¯°±²³´µ¶·¸¹º»¼½¾¿×÷';

describe('PasswordStrength.utils', () => {
  describe('getSatisfiedPasswordRuleIds', () => {
    it('should return no rules for an empty password', () => {
      expect(getSatisfiedPasswordRuleIds('')).toEqual([]);
    });

    it('should return only the satisfied rules', () => {
      expect(getSatisfiedPasswordRuleIds('abcdefgh')).toEqual([
        PasswordRuleId.Length,
      ]);
      expect(getSatisfiedPasswordRuleIds('Abcdefg1')).toEqual([
        PasswordRuleId.Length,
        PasswordRuleId.MixedCase,
        PasswordRuleId.Number,
      ]);
    });

    it('should not satisfy the length rule when the password contains a space', () => {
      expect(getSatisfiedPasswordRuleIds('Abcd efg1@')).not.toContain(
        PasswordRuleId.Length
      );
    });

    it('should not satisfy the length rule beyond 56 characters', () => {
      expect(
        getSatisfiedPasswordRuleIds(`Ab1@${'x'.repeat(53)}`)
      ).not.toContain(PasswordRuleId.Length);
    });
  });

  describe('isPasswordValid', () => {
    it.each([
      ['Test@1234', true],
      ['test@1234', false],
      ['TEST@1234', false],
      ['Test@abcd', false],
      ['Test01234', false],
      ['Test@1', false],
      ['Test @1234', false],
    ])('should return %s for %s', (password, expected) => {
      expect(isPasswordValid(password as string)).toBe(expected);
    });

    it.each([
      ['Abcdef1_', true],
      ['Abcdef1:', true],
      ['Abcdef1–', true],
      ['Abcdef1é', false],
      ['AbcdefÄ1', false],
    ])(
      'should match the server special-character set for %s',
      (password, expected) => {
        expect(isPasswordValid(password as string)).toBe(expected);
      }
    );

    it('should treat exactly the server special characters as symbols', () => {
      const isSymbol = (char: string) =>
        getSatisfiedPasswordRuleIds(char).includes(PasswordRuleId.Symbol);

      for (let code = 0x20; code <= 0x2fff; code++) {
        const char = String.fromCharCode(code);

        expect([char, isSymbol(char)]).toEqual([
          char,
          SERVER_SPECIAL_CHARACTERS.includes(char),
        ]);
      }
    });

    it('should agree with passwordRegex', () => {
      [
        'Test@1234',
        'test@1234',
        'Test01234',
        'Test@1',
        'Test @1234',
        'Abcdef1_',
        'Abcdef1:',
        'Abcdef1é',
        'Abcdef1\\',
        'Abcdef1]',
        'Abcdef1^',
        'Abcdef1-',
        `Ab1@${'x'.repeat(53)}`,
      ].forEach((password) => {
        expect(isPasswordValid(password)).toBe(passwordRegex.test(password));
      });
    });
  });

  describe('getPasswordStrength', () => {
    it('should be weak with at most one rule satisfied', () => {
      expect(getPasswordStrength('')).toBe(StrengthLevel.Weak);
      expect(getPasswordStrength('abcdefgh')).toBe(StrengthLevel.Weak);
    });

    it('should be medium with two or three rules satisfied', () => {
      expect(getPasswordStrength('Abcdefgh')).toBe(StrengthLevel.Medium);
      expect(getPasswordStrength('Abcdefg1')).toBe(StrengthLevel.Medium);
    });

    it('should be strong only when every rule is satisfied', () => {
      expect(getPasswordStrength('Test@1234')).toBe(StrengthLevel.Strong);
    });
  });
});
