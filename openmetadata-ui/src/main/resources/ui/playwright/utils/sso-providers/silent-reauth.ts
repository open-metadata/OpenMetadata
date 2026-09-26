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
import { Page, Request } from '@playwright/test';

// Keycloak keeps its SSO session in these cookies (the *_LEGACY twins cover
// browsers without SameSite=None support). Dropping them ends the IdP
// session for this browser while leaving OpenMetadata's own cookie alone.
const KEYCLOAK_SESSION_COOKIES = [
  'KEYCLOAK_IDENTITY',
  'KEYCLOAK_IDENTITY_LEGACY',
  'KEYCLOAK_SESSION',
  'KEYCLOAK_SESSION_LEGACY',
  'AUTH_SESSION_ID',
  'AUTH_SESSION_ID_LEGACY',
];

export const endKeycloakSession = async (page: Page): Promise<void> => {
  await Promise.all(
    KEYCLOAK_SESSION_COOKIES.map((name) =>
      page.context().clearCookies({ name })
    )
  );
};

// Counts page-level navigations to `urlPattern` that carry prompt=none. The
// hidden silent-renew iframe asks for prompt=none too, so only main-frame
// navigations count as a silent re-authentication.
export const trackPromptNoneNavigations = (
  page: Page,
  urlPattern: RegExp
): (() => Promise<number>) => {
  let count = 0;
  page.on('request', (request: Request) => {
    const isTopLevel =
      request.isNavigationRequest() && request.frame() === page.mainFrame();
    if (
      isTopLevel &&
      urlPattern.test(request.url()) &&
      new URL(request.url()).searchParams.get('prompt') === 'none'
    ) {
      count += 1;
    }
  });

  return async () => count;
};
