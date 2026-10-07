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

import { AuthProvider } from '../../../../../../generated/settings/settings';
import {
  getVisiblePlatformSettingsPages,
  hashSubPathToView,
  nonNegativeNumberRules,
  toOptionalNumber,
  viewToSubPath,
} from './PlatformSettings.utils';

const t = ((key: string) => key) as unknown as Parameters<
  typeof nonNegativeNumberRules
>[0];

describe('PlatformSettings.utils', () => {
  const allPages = getVisiblePlatformSettingsPages(AuthProvider.Basic);

  it('shows login configuration only for providers whose login OpenMetadata owns', () => {
    const ids = (provider?: AuthProvider) =>
      getVisiblePlatformSettingsPages(provider).map((page) => page.id);

    expect(ids(AuthProvider.Basic)).toContain('login-configuration');
    expect(ids(AuthProvider.LDAP)).toContain('login-configuration');
    expect(ids(AuthProvider.Google)).not.toContain('login-configuration');
    expect(ids(AuthProvider.Google)).toContain('email');
  });

  it.each([
    ['', { type: 'landing' }],
    ['unknown-page', { type: 'landing' }],
    ['email', { type: 'page', page: 'email', isEditing: false }],
    ['email/edit', { type: 'page', page: 'email', isEditing: true }],
    // Pages without a read-only view never enter edit mode.
    [
      'health-check/edit',
      { type: 'page', page: 'health-check', isEditing: false },
    ],
    ['lineage/edit', { type: 'page', page: 'lineage', isEditing: true }],
  ])('maps sub-path "%s" to its view', (subPath, expected) => {
    expect(hashSubPathToView(subPath, allPages)).toEqual(expected);
  });

  it('falls back to landing for a page hidden by the auth provider', () => {
    expect(
      hashSubPathToView(
        'login-configuration',
        getVisiblePlatformSettingsPages(AuthProvider.Google)
      )
    ).toEqual({ type: 'landing' });
  });

  it('round-trips views through their sub-path', () => {
    expect(viewToSubPath({ type: 'landing' })).toBeUndefined();
    expect(
      viewToSubPath({ type: 'page', page: 'brand-url', isEditing: true })
    ).toBe('brand-url/edit');
    expect(
      viewToSubPath({ type: 'page', page: 'health-check', isEditing: false })
    ).toBe('health-check');
  });

  it('treats an empty number input as unset rather than zero', () => {
    expect(toOptionalNumber('')).toBeUndefined();
    expect(toOptionalNumber('  ')).toBeUndefined();
    expect(toOptionalNumber('0')).toBe(0);
    expect(toOptionalNumber('42')).toBe(42);
  });

  it('rejects negative numbers and enforces required only when asked', () => {
    const optional = nonNegativeNumberRules(t, 'label.access-block-time');
    const required = nonNegativeNumberRules(t, 'label.upstream-depth', true);

    expect(optional).not.toHaveProperty('required');
    expect(required.required).toBe('label.field-required');
    expect(optional.validate('')).toBe(true);
    expect(optional.validate('3')).toBe(true);
    expect(optional.validate('-1')).toBe('label.greater-than-or-equal-to 0');
  });
});
