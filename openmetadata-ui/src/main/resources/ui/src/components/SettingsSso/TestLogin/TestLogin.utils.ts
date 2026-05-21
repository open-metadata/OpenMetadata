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

import { ClaimValue, TestLoginResult } from './TestLogin.interface';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmailString = (value: unknown): boolean =>
  typeof value === 'string' && EMAIL_REGEX.test(value.trim());

export const claimValueHasEmail = (value: ClaimValue): boolean => {
  if (Array.isArray(value)) {
    return value.some(isEmailString);
  }

  return isEmailString(value);
};

export const formatClaimValue = (value: ClaimValue): string => {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value ?? '');
};

export const splitEmail = (
  email: string
): { local: string; domain: string } => {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) {
    return { local: trimmed, domain: '' };
  }

  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1) };
};

export const pickEmailFromClaim = (value: ClaimValue): string | null => {
  if (Array.isArray(value)) {
    const match = value.find(isEmailString);

    return typeof match === 'string' ? match.trim() : null;
  }

  return isEmailString(value) ? String(value).trim() : null;
};

export const deriveAdminAndDomain = (
  result: TestLoginResult,
  claimName: string
): { adminPrincipal: string; principalDomain: string; hasEmail: boolean } => {
  const raw = result.claims[claimName];
  if (raw === undefined) {
    return { adminPrincipal: '', principalDomain: '', hasEmail: false };
  }

  const email = pickEmailFromClaim(raw);
  if (email === null) {
    return { adminPrincipal: '', principalDomain: '', hasEmail: false };
  }

  const { local, domain } = splitEmail(email);

  return {
    adminPrincipal: local || result.suggestedAdminPrincipal || '',
    principalDomain: domain || result.derivedPrincipalDomain || '',
    hasEmail: true,
  };
};
