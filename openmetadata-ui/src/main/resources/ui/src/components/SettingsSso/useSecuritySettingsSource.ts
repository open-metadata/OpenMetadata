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
import { useMemo } from 'react';
import type { SecurityManagedPaths } from './SSOConfigurationForm/SSOConfigurationForm.interface';
import { SettingType } from '../../generated/settings/settings';
import { SettingSource } from '../../generated/system/settingsSourceResponse';
import {
  findSettingSource,
  getManagedPaths,
  isPathManaged,
  isWholeSettingManaged,
} from '../../utils/platform/settingsSource.utils';
import { useSettingsSource } from '../../hooks/platform/useSettingsSource';

const SECURITY_SETTING_TYPES = [
  SettingType.AuthenticationConfiguration,
  SettingType.AuthorizerConfiguration,
];

export interface UseSecuritySettingsSourceResult {
  sources: SettingSource[];
  refetch: () => Promise<void>;
  managedPaths: SecurityManagedPaths;
  /** The deployment owns both settings whole, so the SSO form only displays them. */
  isReadOnly: boolean;
  isProviderManaged: boolean;
  isSelfSignupManaged: boolean;
}

/** Which parts of the SSO configuration the deployment owns, for every SSO settings screen. */
export const useSecuritySettingsSource =
  (): UseSecuritySettingsSourceResult => {
    const { sources, refetch } = useSettingsSource(SECURITY_SETTING_TYPES);

    return useMemo(() => {
      const authenticationSource = findSettingSource(
        sources,
        SettingType.AuthenticationConfiguration
      );
      const authorizerSource = findSettingSource(
        sources,
        SettingType.AuthorizerConfiguration
      );

      return {
        sources,
        refetch,
        managedPaths: {
          authenticationConfiguration: getManagedPaths(authenticationSource),
          authorizerConfiguration: getManagedPaths(authorizerSource),
        },
        isReadOnly:
          isWholeSettingManaged(authenticationSource) &&
          isWholeSettingManaged(authorizerSource),
        isProviderManaged: isPathManaged(authenticationSource, '/provider'),
        isSelfSignupManaged: isPathManaged(
          authenticationSource,
          '/enableSelfSignup'
        ),
      };
    }, [sources, refetch]);
  };
