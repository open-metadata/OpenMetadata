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

import { AuthenticationConfiguration } from '../../../constants/SSO.constant';

export const TEST_LOGIN_RESULT_KEY = 'sso-test-login-result';
export const POPUP_NAME = 'sso-test-login';
export const POPUP_TIMEOUT_MS = 60_000;
export const CLOSE_WATCH_INTERVAL_MS = 500;
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;
const DEFAULT_SAML_NAME_ID =
  'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';

export const openCenteredPopup = (): Window | null => {
  const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
  const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;

  return window.open(
    '',
    POPUP_NAME,
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},scrollbars=yes`
  );
};

export const submitFormToPopup = (
  action: string,
  fields: Record<string, string>
): void => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = POPUP_NAME;
  form.style.display = 'none';

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  try {
    form.submit();
  } finally {
    document.body.removeChild(form);
  }
};

const modeFor = (hasExistingConfig: boolean): string =>
  hasExistingConfig ? 'existing' : 'new';

export const buildSamlPopupFields = (
  formData: AuthenticationConfiguration | undefined,
  hasExistingConfig: boolean
): Record<string, string> | null => {
  const idp = formData?.samlConfiguration?.idp;
  const sp = formData?.samlConfiguration?.sp;
  const idpEntityId = idp?.entityId ?? '';
  const idpSsoLoginUrl = idp?.ssoLoginUrl ?? '';
  const idpX509Certificate = idp?.idpX509Certificate ?? '';

  if (!idpEntityId || !idpSsoLoginUrl || !idpX509Certificate) {
    return null;
  }

  return {
    mode: modeFor(hasExistingConfig),
    idpEntityId,
    idpSsoLoginUrl,
    idpX509Certificate,
    spEntityId: sp?.entityId ?? window.location.origin,
    spAcsUrl: sp?.acs ?? sp?.callback ?? `${window.location.origin}/callback`,
    nameIdFormat: idp?.nameId ?? DEFAULT_SAML_NAME_ID,
  };
};

export interface OidcPopupFieldsInput {
  formData: AuthenticationConfiguration | undefined;
  hasExistingConfig: boolean;
  discoveryUri: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

export const buildOidcPopupFields = ({
  formData,
  hasExistingConfig,
  discoveryUri,
  clientId,
  clientSecret,
  scope,
}: OidcPopupFieldsInput): Record<string, string> => {
  const oidc = formData?.oidcConfiguration;
  const callbackUrl =
    oidc?.callbackUrl ?? `${window.location.origin}/callback`;

  return {
    mode: modeFor(hasExistingConfig),
    discoveryUri,
    clientId,
    clientSecret,
    scope,
    callbackUrl,
    prompt: oidc?.prompt ?? '',
    maxAge: String(oidc?.maxAge ?? ''),
    clientAuthenticationMethod:
      oidc?.clientAuthenticationMethod ??
      (clientSecret ? 'client_secret_post' : ''),
    disablePkce: String(oidc?.disablePkce ?? true),
    useNonce: String(oidc?.useNonce ?? true),
    customParams: JSON.stringify(oidc?.customParams ?? {}),
  };
};
