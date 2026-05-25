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

import { RefObject } from 'react';
import { AuthenticationConfiguration } from '../../../constants/SSO.constant';
import { FormData } from '../../../utils/SSOUtils';

export type ClaimValue = string | number | boolean | string[];

export interface TestLoginResult {
  claims: Record<string, ClaimValue>;
  suggestedEmailClaim: string | null;
  derivedPrincipalDomain: string | null;
  suggestedAdminPrincipal: string | null;
  hasRefreshToken: boolean;
}

export interface ClaimSelectorConfirm {
  emailClaim: string;
  principalDomain: string;
  adminPrincipal: string;
}

export interface ClaimSelectorProps {
  open: boolean;
  result: TestLoginResult | null;
  onConfirm: (selection: ClaimSelectorConfirm) => void;
  onCancel: () => void;
}

export interface EmailClaimRecommendationProps {
  onRunTestLogin: () => void;
  isDisabled?: boolean;
}

export interface EmailClaimStatusProps {
  emailClaim?: string;
  onChange: () => void;
  isDisabled?: boolean;
}

export interface TestLoginButtonHandle {
  triggerTestLogin: () => void;
}

export interface TestLoginButtonProps {
  formData?: AuthenticationConfiguration;
  securityConfig?: FormData;
  hasExistingConfig?: boolean;
  isDisabled?: boolean;
  onSuccess: (result: TestLoginResult) => void;
  triggerRef?: RefObject<TestLoginButtonHandle | null>;
}

export const TEST_LOGIN_MESSAGE_TYPE = 'sso-test-login';

export interface TestLoginPopupPayload {
  type: typeof TEST_LOGIN_MESSAGE_TYPE;
  success: boolean;
  error?: string;
  claims?: Record<string, ClaimValue>;
  suggestedEmailClaim?: string | null;
  derivedPrincipalDomain?: string | null;
  suggestedAdminPrincipal?: string | null;
  hasRefreshToken?: boolean;
}

export const isTestLoginPopupPayload = (
  value: unknown
): value is TestLoginPopupPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<TestLoginPopupPayload>;

  return (
    candidate.type === TEST_LOGIN_MESSAGE_TYPE &&
    typeof candidate.success === 'boolean'
  );
};
