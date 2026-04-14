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
import { expect, Page } from '@playwright/test';
import { OM_BASE_URL, SSO_ENV } from '../../constant/ssoAuth';
import { ProviderConfigOverride, ProviderCredentials } from '../ssoAuth';
import { ProviderHelper } from './index';

// Defaults target Collate's nightly test Azure AD tenant. These are non-secret
// SAML metadata values — the entity ID, login URL, and signing certificate are
// published in Azure's federation metadata XML endpoint — so committing them is
// intentional. Override via the matching env vars to point the suite at a
// different tenant without a code change.
const AZURE_SAML_TENANT = {
  tenantId:
    process.env[SSO_ENV.AZURE_SAML_TENANT_ID] ??
    'face9c4e-1b50-41d3-b404-d4d2432a5be3',
  principalDomain:
    process.env[SSO_ENV.AZURE_SAML_PRINCIPAL_DOMAIN] ?? 'getcollate.io',
  idpX509Certificate:
    process.env[SSO_ENV.AZURE_SAML_IDP_CERTIFICATE] ??
    [
      '-----BEGIN CERTIFICATE-----',
      'MIIC8DCCAdigAwIBAgIQRWr0YoCt5oRIk335kT5DjjANBgkqhkiG9w0BAQsFADA0',
      'MTIwMAYDVQQDEylNaWNyb3NvZnQgQXp1cmUgRmVkZXJhdGVkIFNTTyBDZXJ0aWZp',
      'Y2F0ZTAeFw0yNTA3MjQwNzM0MTZaFw0yODA3MjQwNzM0MTZaMDQxMjAwBgNVBAMT',
      'KU1pY3Jvc29mdCBBenVyZSBGZWRlcmF0ZWQgU1NPIENlcnRpZmljYXRlMIIBIjAN',
      'BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwXhfRXgCUkqU8fpAoSBq+xh0f38I',
      'kV1RwipcLRIYSXyWZTXs79WiWB9s+fzinB9oPr2TX+BwWPk0Z4PraeMXng5LvPck',
      'RgpvLCgTyiy3RPDaPcUqkWIkLvO949qS+IiAuzdjVM/Tw72fi88SyRGyEa/HjDio',
      'SND6yf/mzWJ4eX59yvEEWrHW2T9IB5+Rb8VA7JzLU5/AnYsxugve7HzMfJYl3wWW',
      'B/qoBOyyrhamCCW8GFD8sfE7Um8yxGyAM5q+IXYX0Iuzxo+JnWuBPUKlTdmLbfnX',
      'odtjQn//RFnmA8b4uodwCmObzNnN2xCExj33PPIBezemWSmMq4bYOoA6tQIDAQAB',
      'MA0GCSqGSIb3DQEBCwUAA4IBAQAZz/SQLmJdHAD4tU8lsPJyWEw5CKDGvBYvCnyZ',
      'Ph5/gCKujlFgGAvmXAPtl616itGndlVnWsA6ofyrGBtwWBeMk+XJTqol9ki9ZTzo',
      'Vuj5/2Un2gREQaInKN2uDcs64E9j74dWO3t/litN4XYRUGirsKSKOubV0PVtkmiBW',
      'CHYDySsZ3z3XAyRRCoV3DCdkf3kiy4fGTM/VatirBBAZfu/MaoTtIvDEUKotfn6tO',
      'UxRdvegHWqa5Tn8QjDqcLbN8ok0AmrCP5WOTQjtt1+PO6v4mvzvkiNeypxEqOwcQ',
      'WVdgvw/IldUp0TDomvr6xZeYEPv0Xn0l4ot1lwq3/tv/Kz',
      '-----END CERTIFICATE-----',
    ].join('\n'),
} as const;

const buildConfigPayload = (): ProviderConfigOverride => {
  const { tenantId } = AZURE_SAML_TENANT;

  return {
    authenticationConfiguration: {
      provider: 'saml',
      providerName: 'Azure AD',
      jwtPrincipalClaims: ['email', 'preferred_username', 'sub'],
      enableSelfSignup: true,
      samlConfiguration: {
        idp: {
          entityId: `https://sts.windows.net/${tenantId}/`,
          ssoLoginUrl: `https://login.microsoftonline.com/${tenantId}/saml2`,
          idpX509Certificate: AZURE_SAML_TENANT.idpX509Certificate,
          nameId: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        sp: {
          entityId: `${OM_BASE_URL}/api/v1/saml/metadata`,
          acs: `${OM_BASE_URL}/api/v1/saml/acs`,
          callback: `${OM_BASE_URL}/callback`,
        },
        security: {
          strictMode: false,
          tokenValidity: 3600,
          sendEncryptedNameId: false,
          sendSignedAuthRequest: false,
          wantMessagesSigned: false,
          wantAssertionsSigned: false,
        },
        debugMode: false,
      },
    },
    authorizerConfiguration: {
      principalDomain: AZURE_SAML_TENANT.principalDomain,
    },
  };
};

const performProviderLogin = async (
  page: Page,
  { username, password }: ProviderCredentials
): Promise<void> => {
  const emailInput = page.locator('input[type="email"]');

  await expect(emailInput).toBeVisible();
  await emailInput.fill(username);

  const nextButton = page.locator('input[type="submit"]');

  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  const passwordInput = page.locator('input[type="password"]');

  await expect(passwordInput).toBeVisible();
  await passwordInput.fill(password);

  const signInButton = page.locator('input[type="submit"]');

  await expect(signInButton).toBeEnabled();
  await signInButton.click();

  // Azure may show a "Stay signed in?" prompt — dismiss it if it appears
  const staySignedInNo = page.locator('input#idBtn_Back');

  if (await staySignedInNo.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await staySignedInNo.click();
  }
};

// OM's sign-in page uses a single "SAML SSO" label for every SAML provider —
// `authenticationConfiguration.providerName` isn't propagated into the store
// for the SAML branch in getAuthConfig, so even with providerName="Azure AD"
// the button renders as "Sign in with SAML SSO".
export const azureSamlProviderHelper: ProviderHelper = {
  expectedButtonText: 'Sign in with SAML SSO',
  loginUrlPattern: /login\.microsoftonline\.com/,
  buildConfigPayload,
  performProviderLogin,
};
