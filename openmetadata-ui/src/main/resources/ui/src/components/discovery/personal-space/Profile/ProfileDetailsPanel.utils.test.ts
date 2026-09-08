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

import { AuthProvider } from '../../../../generated/settings/settings';
import { canUserChangePassword } from './ProfileDetailsPanel.utils';

describe('canUserChangePassword', () => {
  it.each([AuthProvider.Basic, AuthProvider.LDAP])(
    'should allow the signed-in user on the %s provider',
    (provider) => {
      expect(canUserChangePassword({ provider, isSelf: true })).toBe(true);
    }
  );

  // Derived from the enum rather than hand-listed, so a provider added to
  // AuthProvider later is asserted against instead of silently untested.
  it.each(
    Object.values(AuthProvider).filter(
      (provider) =>
        provider !== AuthProvider.Basic && provider !== AuthProvider.LDAP
    )
  )('should not allow an externally managed credential (%s)', (provider) => {
    expect(canUserChangePassword({ provider, isSelf: true })).toBe(false);
  });

  it('should not allow when the provider is unknown', () => {
    expect(canUserChangePassword({ isSelf: true })).toBe(false);
  });

  it('should not allow another user’s profile', () => {
    expect(
      canUserChangePassword({ provider: AuthProvider.Basic, isSelf: false })
    ).toBe(false);
  });

  it('should not allow a deleted user', () => {
    expect(
      canUserChangePassword({
        provider: AuthProvider.Basic,
        isSelf: true,
        isDeleted: true,
      })
    ).toBe(false);
  });
});
