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

import { TestLoginResult } from './TestLogin.interface';
import {
  claimValueHasEmail,
  deriveAdminAndDomain,
  isEmailString,
  pickEmailFromClaim,
  splitEmail,
} from './TestLogin.utils';

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

describe('pickEmailFromClaim', () => {
  it('returns trimmed email for a scalar email string', () => {
    expect(pickEmailFromClaim('  alice@example.com  ')).toBe(
      'alice@example.com'
    );
  });

  it('returns null for a scalar non-email string', () => {
    expect(pickEmailFromClaim('not-an-email')).toBeNull();
  });

  it('returns null for number and boolean values', () => {
    expect(pickEmailFromClaim(123)).toBeNull();
    expect(pickEmailFromClaim(true)).toBeNull();
    expect(pickEmailFromClaim(false)).toBeNull();
  });

  it('picks the first email-shaped element from a mixed array (trimmed)', () => {
    expect(
      pickEmailFromClaim(['admin', '  alice@example.com  ', 'engineer'])
    ).toBe('alice@example.com');
  });

  it('returns null for an array with no email-shaped elements', () => {
    expect(pickEmailFromClaim(['admin', 'engineer'])).toBeNull();
  });

  it('returns null for an empty array', () => {
    expect(pickEmailFromClaim([])).toBeNull();
  });
});

describe('splitEmail', () => {
  it('trims whitespace before splitting', () => {
    expect(splitEmail('  alice@example.com  ')).toEqual({
      local: 'alice',
      domain: 'example.com',
    });
  });

  it('returns local only when input has no @', () => {
    expect(splitEmail('admin')).toEqual({ local: 'admin', domain: '' });
  });

  it('returns empty local and domain for empty or whitespace-only input', () => {
    expect(splitEmail('')).toEqual({ local: '', domain: '' });
    expect(splitEmail('   ')).toEqual({ local: '', domain: '' });
  });

  it('treats leading @ as no valid local', () => {
    expect(splitEmail('@example.com')).toEqual({
      local: '@example.com',
      domain: '',
    });
  });
});

describe('deriveAdminAndDomain', () => {
  const baseResult: TestLoginResult = {
    claims: {},
    suggestedEmailClaim: null,
    derivedPrincipalDomain: null,
    suggestedAdminPrincipal: null,
    hasRefreshToken: true,
  };

  it('extracts the email element from a mixed array', () => {
    const result: TestLoginResult = {
      ...baseResult,
      claims: { groups: ['admin', 'alice@example.com', 'engineer'] },
    };

    expect(deriveAdminAndDomain(result, 'groups')).toEqual({
      adminPrincipal: 'alice',
      principalDomain: 'example.com',
      hasEmail: true,
    });
  });

  it('returns hasEmail false when the claim is missing from the result', () => {
    expect(deriveAdminAndDomain(baseResult, 'missing')).toEqual({
      adminPrincipal: '',
      principalDomain: '',
      hasEmail: false,
    });
  });

  it('returns hasEmail false when the claim value is a non-email scalar', () => {
    const result: TestLoginResult = {
      ...baseResult,
      claims: { sub: 'not-an-email' },
      suggestedAdminPrincipal: 'fallback',
      derivedPrincipalDomain: 'fallback.com',
    };

    expect(deriveAdminAndDomain(result, 'sub')).toEqual({
      adminPrincipal: '',
      principalDomain: '',
      hasEmail: false,
    });
  });

  it('returns hasEmail false when an array claim has no email entries', () => {
    const result: TestLoginResult = {
      ...baseResult,
      claims: { groups: ['admin', 'engineer'] },
    };

    expect(deriveAdminAndDomain(result, 'groups')).toEqual({
      adminPrincipal: '',
      principalDomain: '',
      hasEmail: false,
    });
  });

  it('preserves fallbacks only when the extracted email is missing parts', () => {
    const withSplittableEmail: TestLoginResult = {
      ...baseResult,
      claims: { email: 'alice@example.com' },
      suggestedAdminPrincipal: 'fallback-admin',
      derivedPrincipalDomain: 'fallback.com',
    };

    expect(deriveAdminAndDomain(withSplittableEmail, 'email')).toEqual({
      adminPrincipal: 'alice',
      principalDomain: 'example.com',
      hasEmail: true,
    });

    const withMissingDomainFallback: TestLoginResult = {
      ...baseResult,
      claims: { email: 'alice@example.com' },
      suggestedAdminPrincipal: null,
      derivedPrincipalDomain: null,
    };

    expect(deriveAdminAndDomain(withMissingDomainFallback, 'email')).toEqual({
      adminPrincipal: 'alice',
      principalDomain: 'example.com',
      hasEmail: true,
    });
  });

  it('trims whitespace-padded email values before persisting', () => {
    const result: TestLoginResult = {
      ...baseResult,
      claims: { email: '  alice@example.com  ' },
    };

    expect(deriveAdminAndDomain(result, 'email')).toEqual({
      adminPrincipal: 'alice',
      principalDomain: 'example.com',
      hasEmail: true,
    });
  });
});
