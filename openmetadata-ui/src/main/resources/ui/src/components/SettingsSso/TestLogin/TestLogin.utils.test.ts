/*
 *  Copyright 2025 Collate.
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

import { claimValueHasEmail, isEmailString } from './TestLogin.utils';

describe('isEmailString', () => {
  it.each([
    ['user@example.com', true],
    ['  user@example.com  ', true],
    ['first.last+tag@sub.example.co.uk', true],
    ['noatsign', false],
    ['user@', false],
    ['user@host', false],
    ['@example.com', false],
    ['user @example.com', false],
    ['user@ex ample.com', false],
    ['', false],
  ])('returns %j for input %s', (input, expected) => {
    expect(isEmailString(input)).toBe(expected);
  });

  it('returns false for non-string values', () => {
    expect(isEmailString(undefined)).toBe(false);
    expect(isEmailString(null)).toBe(false);
    expect(isEmailString(42)).toBe(false);
    expect(isEmailString(true)).toBe(false);
    expect(isEmailString({})).toBe(false);
    expect(isEmailString([])).toBe(false);
  });
});

describe('claimValueHasEmail', () => {
  it('returns true for a single email string', () => {
    expect(claimValueHasEmail('alice@example.com')).toBe(true);
  });

  it('returns false for a single non-email string', () => {
    expect(claimValueHasEmail('not-an-email')).toBe(false);
  });

  it('returns false for non-string scalars (number, boolean)', () => {
    expect(claimValueHasEmail(123)).toBe(false);
    expect(claimValueHasEmail(true)).toBe(false);
    expect(claimValueHasEmail(false)).toBe(false);
  });

  it('returns true for an array containing only emails', () => {
    expect(claimValueHasEmail(['alice@example.com', 'bob@example.com'])).toBe(
      true
    );
  });

  it('returns true for a mixed array where AT LEAST ONE element is an email', () => {
    expect(claimValueHasEmail(['admin', 'alice@example.com', 'engineer'])).toBe(
      true
    );
  });

  it('returns false for an array with no email-shaped elements', () => {
    expect(claimValueHasEmail(['admin', 'engineer', 'reader'])).toBe(false);
  });

  it('returns false for an empty array', () => {
    expect(claimValueHasEmail([])).toBe(false);
  });

  it('handles arrays with whitespace-padded emails', () => {
    expect(claimValueHasEmail(['  alice@example.com  '])).toBe(true);
  });
});
