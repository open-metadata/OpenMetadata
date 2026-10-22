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

/** Auth providers that keep the credential in OpenMetadata itself. */
const PASSWORD_OWNING_PROVIDERS: readonly AuthProvider[] = [
  AuthProvider.Basic,
  AuthProvider.LDAP,
];

/**
 * The SECURITY section is offered on a live profile that is your own, or to an
 * admin acting on someone else, on a password-owning provider (legacy parity).
 * With an external IdP (SAML, OIDC, Google, ...) the credential lives there, so
 * the section is hidden rather than offered as an action that would always fail.
 */
export const canUserChangePassword = ({
  provider,
  isSelf,
  isAdmin,
  isDeleted,
}: {
  provider?: AuthProvider;
  isSelf: boolean;
  isAdmin?: boolean;
  isDeleted?: boolean;
}): boolean =>
  Boolean(provider && PASSWORD_OWNING_PROVIDERS.includes(provider)) &&
  (isSelf || Boolean(isAdmin)) &&
  !isDeleted;

/** "Alice" from "Alice Johnson" — used where copy addresses another user. */
export const getUserFirstName = (user: {
  name: string;
  displayName?: string;
}): string => (user.displayName?.trim() || user.name).split(/\s+/)[0];
