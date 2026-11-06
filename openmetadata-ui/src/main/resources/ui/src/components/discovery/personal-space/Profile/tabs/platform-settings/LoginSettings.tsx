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

import { useTranslation } from 'react-i18next';
import { getLoginConfig } from '../../../../../../rest/settingConfigAPI';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import SettingValue from './SettingValue';
import { useEditHeaderAction } from './useEditHeaderAction';
import { useSettingsFetch } from './useSettingsFetch';

const LoginSettings = (props: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettingsFetch(getLoginConfig);
  useEditHeaderAction('login-configuration', isLoading, props);

  if (isLoading) {
    return <SettingsSkeleton rows={3} />;
  }

  return (
    <SettingsSection
      testId="login-settings"
      title={t('label.login-configuration')}>
      <ReadOnlyRow
        description={t('message.login-fail-attempt-message')}
        title={t('label.max-login-fail-attempt-plural')}>
        <SettingValue
          testId="max-login-fail-attampts"
          value={config?.maxLoginFailAttempts?.toString()}
        />
      </ReadOnlyRow>
      <ReadOnlyRow
        description={t('message.access-block-time-message')}
        title={t('label.access-block-time')}>
        <SettingValue
          testId="access-block-time"
          value={config?.accessBlockTime?.toString()}
        />
      </ReadOnlyRow>
      <ReadOnlyRow
        description={t('message.jwt-token-expiry-time-message')}
        title={t('label.jwt-token-expiry-time')}>
        <SettingValue
          testId="jwt-token-expiry-time"
          value={
            config?.jwtTokenExpiryTime === undefined
              ? undefined
              : `${config.jwtTokenExpiryTime} ${t('label.second-plural')}`
          }
        />
      </ReadOnlyRow>
    </SettingsSection>
  );
};

export default LoginSettings;
