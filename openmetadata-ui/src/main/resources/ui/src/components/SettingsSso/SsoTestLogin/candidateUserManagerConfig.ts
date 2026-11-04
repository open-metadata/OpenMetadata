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
  InMemoryWebStorage,
  UserManagerSettings,
  WebStorageStateStore,
} from 'oidc-client';
import { getRedirectUri, OIDC_SCOPE } from '../../../utils/AuthProvider.util';
import { SSO_TEST_LOGIN_STORE_PREFIX } from '../../../utils/SsoTestLoginPopup';
import { AuthenticationConfigurationWithScope } from '../../Auth/AuthProviders/AuthProvider.interface';

/**
 * Build an isolated UserManager config used ONLY for the SSO "Test Login" popup.
 * The tested identity's tokens stay in memory and its sign-in state goes to a
 * dedicated prefixed store (never the app's oidcTokenStorage), but the popup
 * uses the SAME configured callback URL the real login uses — so
 * the test exercises the actual registered redirect URI and never requires the
 * admin to register an extra one. Isolation is achieved by diverting the popup
 * at the callback (see isSsoTestLoginPopup), not by using a separate route.
 */
export const getCandidateUserManagerConfig = (
  authClient: AuthenticationConfigurationWithScope
): UserManagerSettings => {
  const {
    authority = '',
    clientId = '',
    callbackUrl,
    scope,
    responseType,
  } = authClient;

  return {
    authority,
    client_id: clientId,
    redirect_uri: getRedirectUri(callbackUrl),
    response_type: responseType ?? 'id_token',
    scope: scope || OIDC_SCOPE,
    loadUserInfo: false,
    monitorSession: false,
    // Only this page reads the tested identity's tokens back, so they are never written to storage.
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
    // The same-origin popup finds its sign-in state here (see isSsoTestLoginPopup).
    stateStore: new WebStorageStateStore({
      store: globalThis.localStorage,
      prefix: SSO_TEST_LOGIN_STORE_PREFIX,
    }),
  };
};
