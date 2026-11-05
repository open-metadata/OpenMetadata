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
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../generated/system/settingsSourceResponse';
import {
  applyManagedPathsToUiSchema,
  areAllPathsManaged,
  findSettingSource,
  getEnvSourceVariables,
  getManagedPaths,
  getOverriddenFields,
  getPointerSegments,
  isPathManaged,
  isPointerManaged,
  isWholeSettingManaged,
  pinManagedFields,
  toJsonPointer,
} from './settingsSource.utils';

const envSource = (managedPaths?: string[]): SettingSource => ({
  configType: SettingType.AuthenticationConfiguration,
  source: ConfigSourceMode.Env,
  sourceVariable: 'SECURITY_CONFIG_SOURCE',
  editable: false,
  managedPaths,
});

const autoSource: SettingSource = {
  configType: SettingType.EmailConfiguration,
  source: ConfigSourceMode.Auto,
  sourceVariable: 'EMAIL_CONFIG_SOURCE',
  editable: true,
  managedPaths: ['/senderMail'],
  overriddenFields: [
    { path: '/serverPort', envVariable: 'SMTP_SERVER_PORT' },
    { path: '/supportUrl' },
  ],
};

describe('settingsSource.utils', () => {
  describe('JSON pointers', () => {
    it('should escape and unescape the characters a pointer reserves', () => {
      const pointer = toJsonPointer('customParams', 'a/b', 'c~d');

      expect(pointer).toBe('/customParams/a~1b/c~0d');
      expect(getPointerSegments(pointer)).toEqual([
        'customParams',
        'a/b',
        'c~d',
      ]);
    });

    it('should read the whole-setting pointer as no segments', () => {
      expect(getPointerSegments('/')).toEqual([]);
    });
  });

  describe('managed paths', () => {
    it('should report managed paths only in ENV mode', () => {
      expect(getManagedPaths(envSource(['/provider']))).toEqual(['/provider']);
      expect(getManagedPaths(autoSource)).toEqual([]);
      expect(getManagedPaths(undefined)).toEqual([]);
    });

    it('should report only the root pointer when the whole setting is managed', () => {
      expect(getManagedPaths(envSource(['/', '/provider']))).toEqual(['/']);
      expect(getManagedPaths(envSource())).toEqual(['/']);
    });

    it('should match a pointer against a plain list of managed paths', () => {
      expect(
        isPointerManaged(['/ldapConfiguration'], '/ldapConfiguration/host')
      ).toBe(true);
      expect(isPointerManaged(['/'], '/provider')).toBe(true);
      expect(isPointerManaged([], '/provider')).toBe(false);
    });

    it('should treat a field under a managed path as managed', () => {
      const source = envSource(['/oidcConfiguration/id', '/publicKeyUrls']);

      expect(isPathManaged(source, '/oidcConfiguration/id')).toBe(true);
      expect(isPathManaged(source, '/publicKeyUrls')).toBe(true);
      expect(isPathManaged(source, '/oidcConfiguration/secret')).toBe(false);
      // A partly managed object is still editable as a whole.
      expect(isPathManaged(source, '/oidcConfiguration')).toBe(false);
      // A shared prefix is not an ancestor.
      expect(isPathManaged(source, '/oidcConfiguration/idp')).toBe(false);
    });

    it('should never lock a field outside ENV mode', () => {
      expect(isPathManaged(autoSource, '/senderMail')).toBe(false);
      expect(isWholeSettingManaged(autoSource)).toBe(false);
    });

    it('should lock the whole setting for the root pointer', () => {
      const source = envSource(['/']);

      expect(isWholeSettingManaged(source)).toBe(true);
      expect(isPathManaged(source, '/anything/at/all')).toBe(true);
    });

    it('should lock the whole setting when edits are refused without a field list', () => {
      expect(isWholeSettingManaged(envSource())).toBe(true);
      expect(isWholeSettingManaged(envSource([]))).toBe(true);
      expect(isWholeSettingManaged({ ...envSource([]), editable: true })).toBe(
        false
      );
    });

    it('should lock individual fields, not the whole setting, for a field list', () => {
      expect(isWholeSettingManaged(envSource(['/provider']))).toBe(false);
    });

    it('should report whether every given field is managed', () => {
      const source = envSource(['/baseUrl', '/allowedOrigins']);

      expect(areAllPathsManaged(source, ['/baseUrl', '/allowedOrigins'])).toBe(
        true
      );
      expect(areAllPathsManaged(source, ['/baseUrl', '/path'])).toBe(false);
      expect(areAllPathsManaged(source, [])).toBe(false);
    });
  });

  describe('source lookup and summaries', () => {
    it('should find the source of a setting by its type', () => {
      expect(
        findSettingSource([autoSource], SettingType.EmailConfiguration)
      ).toBe(autoSource);
      expect(
        findSettingSource([autoSource], SettingType.MCPConfiguration)
      ).toBeUndefined();
    });

    it('should list overridden fields with their setting, outside ENV mode only', () => {
      const envWithStaleOverrides = {
        ...envSource(['/provider']),
        overriddenFields: [{ path: '/provider' }],
      };

      expect(getOverriddenFields([autoSource, envWithStaleOverrides])).toEqual([
        {
          configType: SettingType.EmailConfiguration,
          path: '/serverPort',
          envVariable: 'SMTP_SERVER_PORT',
        },
        {
          configType: SettingType.EmailConfiguration,
          path: '/supportUrl',
        },
      ]);
    });

    it('should list each ENV variable once', () => {
      const authorizer = {
        ...envSource(['/adminEmails']),
        configType: SettingType.AuthorizerConfiguration,
      };

      expect(
        getEnvSourceVariables([envSource(['/']), authorizer, autoSource])
      ).toEqual(['SECURITY_CONFIG_SOURCE']);
    });
  });

  describe('pinManagedFields', () => {
    const saved: {
      authenticationConfiguration: {
        provider: string;
        oidcConfiguration?: Record<string, unknown>;
      };
    } = {
      authenticationConfiguration: {
        provider: 'okta',
        oidcConfiguration: { id: 'stored-id', secret: '*********' },
      },
    };

    it('should restore managed fields to their saved value and keep other edits', () => {
      const candidate = {
        authenticationConfiguration: {
          provider: 'google',
          oidcConfiguration: { id: 'edited-id', secret: 'new-secret' },
        },
      };

      expect(
        pinManagedFields(
          candidate,
          saved,
          ['/provider', '/oidcConfiguration/id'],
          'authenticationConfiguration'
        )
      ).toEqual({
        authenticationConfiguration: {
          provider: 'okta',
          oidcConfiguration: { id: 'stored-id', secret: 'new-secret' },
        },
      });
      expect(candidate.authenticationConfiguration.provider).toBe('google');
    });

    it('should drop a managed field the saved value does not have', () => {
      const candidate = {
        authenticationConfiguration: {
          ...saved.authenticationConfiguration,
          oidcConfiguration: {
            ...saved.authenticationConfiguration.oidcConfiguration,
            useNonce: false,
          },
        },
      };

      expect(
        pinManagedFields(
          candidate,
          saved,
          ['/oidcConfiguration/useNonce'],
          'authenticationConfiguration'
        )
      ).toEqual(saved);
    });

    it('should restore the whole setting for the root pointer', () => {
      expect(
        pinManagedFields(
          { authenticationConfiguration: { provider: 'google' } },
          saved,
          ['/'],
          'authenticationConfiguration'
        )
      ).toEqual(saved);
      expect(
        pinManagedFields({ enabled: true }, { enabled: false }, ['/'])
      ).toEqual({ enabled: false });
    });
  });

  describe('applyManagedPathsToUiSchema', () => {
    it('should disable managed fields under the setting key without touching the input', () => {
      const clientId = { 'ui:title': 'Client ID' };
      const uiSchema = {
        authenticationConfiguration: {
          clientId,
          oidcConfiguration: { id: { 'ui:title': 'OIDC Client ID' } },
        },
      };

      const result = applyManagedPathsToUiSchema(
        uiSchema,
        ['/clientId', '/oidcConfiguration/id', '/ldapConfiguration/host'],
        'authenticationConfiguration'
      );

      expect(result).toEqual({
        authenticationConfiguration: {
          clientId: { 'ui:title': 'Client ID', 'ui:disabled': true },
          oidcConfiguration: {
            id: { 'ui:title': 'OIDC Client ID', 'ui:disabled': true },
          },
          ldapConfiguration: { host: { 'ui:disabled': true } },
        },
      });
      // uiSchema objects are shared module constants; mutating them would leak the lock.
      expect(clientId).toEqual({ 'ui:title': 'Client ID' });
    });

    it('should disable the whole form for the root pointer', () => {
      expect(applyManagedPathsToUiSchema({}, ['/'])).toEqual({
        'ui:disabled': true,
      });
    });

    it('should keep a field hidden when it is also managed', () => {
      expect(
        applyManagedPathsToUiSchema({ provider: { 'ui:widget': 'hidden' } }, [
          '/provider',
        ])
      ).toEqual({ provider: { 'ui:widget': 'hidden', 'ui:disabled': true } });
    });
  });
});
