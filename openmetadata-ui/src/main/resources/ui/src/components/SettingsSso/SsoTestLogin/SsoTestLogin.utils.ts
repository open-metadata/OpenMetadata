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
import { isEqual, isNil, isPlainObject, union } from 'lodash';
import { AuthProvider, ClientType } from '../../../generated/settings/settings';
import {
  Stage,
  StageStatus,
  Status,
  TestLoginResult,
} from '../../../generated/system/testLoginResult';
import type { ConnectionStepState } from '../../common/TestConnection/TestConnectionModal/TestConnectionModal.interface';

/**
 * Edits that cannot change who signs in, or whether they can. Saving an edit that touches only these
 * skips the Test Login gate; any other change requires a passing test first.
 */
export const SAFE_EDIT_PATHS: readonly string[] = [
  'authenticationConfiguration.enableSelfSignup',
  'authenticationConfiguration.sessionExpiry',
  'authenticationConfiguration.maxActiveSessionsPerUser',
  'authenticationConfiguration.forceSecureSessionCookie',
  'authenticationConfiguration.displayNameClaim',
  'authenticationConfiguration.jwtTeamClaimMapping',
  'authenticationConfiguration.oidcConfiguration.tokenValidity',
  'authenticationConfiguration.oidcConfiguration.sessionExpiry',
  'authenticationConfiguration.oidcConfiguration.maxClockSkew',
  'authenticationConfiguration.samlConfiguration.security.tokenValidity',
  'authorizerConfiguration.botPrincipals',
  'authorizerConfiguration.testPrincipals',
  'authorizerConfiguration.defaultOAuthRole',
  'authorizerConfiguration.allowedEmailRegistrationDomains',
];

const NON_OIDC_PROVIDERS: readonly string[] = [
  AuthProvider.Basic,
  AuthProvider.LDAP,
  AuthProvider.Openmetadata,
  AuthProvider.Saml,
];

const STEP_STATE_BY_STAGE_STATUS: Record<StageStatus, ConnectionStepState> = {
  [StageStatus.Pending]: 'queued',
  [StageStatus.Running]: 'running',
  [StageStatus.Passed]: 'passed',
  [StageStatus.Failed]: 'failed',
  [StageStatus.Skipped]: 'skipped',
};

export const STAGE_LABEL_KEYS: Record<Stage, string> = {
  [Stage.Started]: 'label.sso-test-stage-started',
  [Stage.Redirected]: 'label.sso-test-stage-redirected',
  [Stage.TokenReceived]: 'label.sso-test-stage-token-received',
  [Stage.TokenValidated]: 'label.sso-test-stage-token-validated',
  [Stage.CredentialsVerified]: 'label.sso-test-stage-credentials-verified',
  [Stage.ClaimsExtracted]: 'label.sso-test-stage-claims-extracted',
  [Stage.IdentityResolved]: 'label.sso-test-stage-identity-resolved',
  [Stage.RolesMapped]: 'label.sso-test-stage-roles-mapped',
  [Stage.DomainChecked]: 'label.sso-test-stage-domain-checked',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  isPlainObject(value);

/** The form writes cleared fields as '', [] or null where the saved config has none at all. */
const isBlank = (value: unknown): boolean =>
  isNil(value) || value === '' || (Array.isArray(value) && value.length === 0);

/**
 * Every leaf path whose value differs between two configurations, including the leaves of objects
 * that were added or removed outright.
 */
export const getChangedPaths = (
  before: unknown,
  after: unknown,
  path = ''
): string[] => {
  if (isRecord(before) || isRecord(after)) {
    const beforeFields = isRecord(before) ? before : {};
    const afterFields = isRecord(after) ? after : {};

    return union(Object.keys(beforeFields), Object.keys(afterFields)).flatMap(
      (key) =>
        getChangedPaths(
          beforeFields[key],
          afterFields[key],
          path ? `${path}.${key}` : key
        )
    );
  }
  const isUnchanged =
    (isBlank(before) && isBlank(after)) || isEqual(before, after);

  return isUnchanged ? [] : [path];
};

const isSafeEditPath = (path: string): boolean =>
  SAFE_EDIT_PATHS.some(
    (safePath) => path === safePath || path.startsWith(`${safePath}.`)
  );

/**
 * Whether saving the candidate must first be proven by a passing Test Login. A new configuration
 * always must. An edit must unless every field it changes is known to be safe — deliberately failing
 * closed, so a field nobody thought to classify is still tested rather than waved through.
 */
export const requiresTestLogin = (
  saved: unknown,
  candidate: unknown
): boolean =>
  !saved ||
  getChangedPaths(saved, candidate).some((path) => !isSafeEditPath(path));

/**
 * Public-client OIDC signs in in the browser, so its test does too. Every other provider signs in on
 * the server, so the server drives its test.
 */
export const isBrowserTestLogin = (
  provider?: string,
  clientType?: ClientType
): boolean =>
  !!provider &&
  !NON_OIDC_PROVIDERS.includes(provider) &&
  clientType !== ClientType.Confidential;

/**
 * Maps a stage outcome onto Test Connection's step states, so both timelines render alike. Once a
 * test has settled, a stage it never reached did not run — showing it as queued would suggest the
 * test is still waiting on it.
 */
export const toConnectionStepState = (
  status: StageStatus,
  isSettled: boolean
): ConnectionStepState =>
  isSettled && status === StageStatus.Pending
    ? 'skipped'
    : STEP_STATE_BY_STAGE_STATUS[status];

export const isTestLoginSettled = (result?: TestLoginResult): boolean =>
  !!result && result.status !== Status.Pending;
