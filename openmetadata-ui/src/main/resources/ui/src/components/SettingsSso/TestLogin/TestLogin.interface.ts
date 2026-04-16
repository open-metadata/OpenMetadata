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

export type ClaimValue = string | number | boolean | string[];

export interface TestLoginResult {
  claims: Record<string, ClaimValue>;
  suggestedEmailClaim: string | null;
  derivedPrincipalDomain: string | null;
  suggestedAdminPrincipal: string | null;
  hasRefreshToken: boolean;
}

export interface ClaimSelectorProps {
  result: TestLoginResult;
  onConfirm: (emailClaim: string, principalDomain: string, adminPrincipal: string) => void;
  onCancel: () => void;
}

export interface TestLoginFormData {
  provider?: string;
  discoveryUri?: string;
  clientId?: string;
  clientSecret?: string;
  callbackUrl?: string;
  scope?: string;
  oidcConfiguration?: {
    discoveryUri?: string;
    id?: string;
    secret?: string;
    scope?: string;
    callbackUrl?: string;
    prompt?: string;
    disablePkce?: boolean;
    useNonce?: boolean;
    clientAuthenticationMethod?: string;
    maxAge?: string;
    customParams?: Record<string, string>;
  };
  samlConfiguration?: {
    idp?: {
      entityId?: string;
      ssoLoginUrl?: string;
      idpX509Certificate?: string;
      nameId?: string;
    };
    sp?: {
      entityId?: string;
      acs?: string;
      callback?: string;
    };
  };
}

export interface SecurityConfigForValidation {
  authenticationConfiguration?: Record<string, unknown>;
  authorizerConfiguration?: Record<string, unknown>;
}
