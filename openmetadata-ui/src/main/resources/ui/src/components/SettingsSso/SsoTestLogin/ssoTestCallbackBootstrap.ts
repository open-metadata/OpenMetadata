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
import { UserManager } from 'oidc-client';
import { getCandidateUserManagerConfig } from '../../../utils/AuthProvider.util';
import { SSO_TEST_LOGIN_STORE_PREFIX } from '../../../utils/SsoTestLoginPopup';
import { AuthenticationConfigurationWithScope } from '../../Auth/AuthProviders/AuthProvider.interface';

export const SSO_TEST_LOGIN_CANDIDATE_KEY = `${SSO_TEST_LOGIN_STORE_PREFIX}candidate`;

/**
 * Runs INSIDE the Test Login popup when it returns from the identity provider to
 * the configured callback URL (the index.tsx guard routes here via
 * isSsoTestLoginPopup instead of mounting the app).
 *
 * It completes the OIDC popup handshake against the candidate configuration and
 * hands the resulting token back to the opener. It deliberately does NOT mount
 * the application, so it cannot touch the admin's real session, token storage,
 * or auth context.
 */
export const runSsoTestCallback = async (): Promise<void> => {
  try {
    const raw = globalThis.localStorage.getItem(SSO_TEST_LOGIN_CANDIDATE_KEY);
    const candidate = (
      raw ? JSON.parse(raw) : {}
    ) as AuthenticationConfigurationWithScope;
    const userManager = new UserManager(
      await getCandidateUserManagerConfig(candidate)
    );
    await userManager.signinPopupCallback();
  } catch {
    // The opener resolves the failure via its signinPopup() rejection/timeout.
  } finally {
    globalThis.close();
  }
};
