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
import { ClientType } from '../../../generated/settings/settings';
import { StageStatus, Status } from '../../../generated/system/testLoginResult';
import {
  getChangedPaths,
  isBrowserTestLogin,
  isTestLoginSettled,
  requiresTestLogin,
  toConnectionStepState,
} from './SsoTestLogin.utils';

const saved = {
  authenticationConfiguration: {
    provider: 'custom-oidc',
    clientId: 'client-1',
    jwtPrincipalClaims: ['email'],
    enableSelfSignup: false,
  },
  authorizerConfiguration: {
    principalDomain: 'example.com',
    adminPrincipals: ['admin'],
  },
};

const withChanges = (changes: {
  authenticationConfiguration?: Record<string, unknown>;
  authorizerConfiguration?: Record<string, unknown>;
}) => ({
  authenticationConfiguration: {
    ...saved.authenticationConfiguration,
    ...changes.authenticationConfiguration,
  },
  authorizerConfiguration: {
    ...saved.authorizerConfiguration,
    ...changes.authorizerConfiguration,
  },
});

describe('SsoTestLogin.utils', () => {
  describe('requiresTestLogin', () => {
    it('always requires a test for a new configuration', () => {
      expect(requiresTestLogin(undefined, saved)).toBe(true);
    });

    it('does not require a test when nothing changed', () => {
      expect(requiresTestLogin(saved, withChanges({}))).toBe(false);
    });

    it('lets an edit of only safe fields through', () => {
      expect(
        requiresTestLogin(
          saved,
          withChanges({
            authenticationConfiguration: {
              enableSelfSignup: true,
              sessionExpiry: 7200,
            },
          })
        )
      ).toBe(false);
    });

    it('gates an edit that changes how users sign in', () => {
      expect(
        requiresTestLogin(
          saved,
          withChanges({ authenticationConfiguration: { clientId: 'client-2' } })
        )
      ).toBe(true);
      expect(
        requiresTestLogin(
          saved,
          withChanges({ authorizerConfiguration: { adminPrincipals: [] } })
        )
      ).toBe(true);
    });

    it('gates a nested block that was added outright', () => {
      // SSOUtils.findChangedFields reports nothing here, which would let the edit skip the test.
      expect(
        requiresTestLogin(
          saved,
          withChanges({
            authenticationConfiguration: {
              oidcConfiguration: { discoveryUri: 'https://idp.example.com' },
            },
          })
        )
      ).toBe(true);
    });

    it('fails closed for a field nobody classified', () => {
      expect(
        requiresTestLogin(
          saved,
          withChanges({ authenticationConfiguration: { someFutureField: 'x' } })
        )
      ).toBe(true);
    });
  });

  describe('getChangedPaths', () => {
    it('treats blank values the form writes as unchanged', () => {
      expect(
        getChangedPaths(
          { a: { b: undefined, c: null } },
          { a: { b: '', c: [], d: undefined } }
        )
      ).toEqual([]);
    });

    it('reports the leaf paths that changed', () => {
      expect(
        getChangedPaths({ a: { b: 1, c: 2 } }, { a: { b: 1, c: 3 }, d: true })
      ).toEqual(['a.c', 'd']);
    });
  });

  describe('isBrowserTestLogin', () => {
    it('routes public-client OIDC to the browser and everything else to the server', () => {
      expect(isBrowserTestLogin('google', ClientType.Public)).toBe(true);
      expect(isBrowserTestLogin('okta', undefined)).toBe(true);
      expect(isBrowserTestLogin('custom-oidc', ClientType.Confidential)).toBe(
        false
      );
      expect(isBrowserTestLogin('saml', undefined)).toBe(false);
      expect(isBrowserTestLogin('ldap', undefined)).toBe(false);
      expect(isBrowserTestLogin(undefined, undefined)).toBe(false);
    });
  });

  describe('toConnectionStepState', () => {
    it('reports an unreached stage as not run once the test has settled', () => {
      expect(toConnectionStepState(StageStatus.Pending, false)).toBe('queued');
      expect(toConnectionStepState(StageStatus.Pending, true)).toBe('skipped');
      expect(toConnectionStepState(StageStatus.Failed, true)).toBe('failed');
      expect(toConnectionStepState(StageStatus.Running, false)).toBe('running');
    });
  });

  describe('isTestLoginSettled', () => {
    it('is settled only once a result is no longer pending', () => {
      expect(isTestLoginSettled(undefined)).toBe(false);
      expect(isTestLoginSettled({ status: Status.Pending })).toBe(false);
      expect(isTestLoginSettled({ status: Status.Failed })).toBe(true);
    });
  });
});
