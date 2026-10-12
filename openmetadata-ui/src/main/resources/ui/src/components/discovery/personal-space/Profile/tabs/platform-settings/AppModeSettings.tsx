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
import { DefaultAppMode } from '../../../../../../generated/api/configuration/appConfiguration';
import { getAppConfiguration } from '../../../../../../rest/settingConfigAPI';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import SettingValue from './SettingValue';
import { useEditHeaderAction } from './useEditHeaderAction';
import { useSettingsFetch } from './useSettingsFetch';

// The wire value for "no tenant default" is `null`, which a radio cannot carry.
export const NO_DEFAULT_VALUE = 'null';

export const APP_MODE_OPTIONS = [
  { value: NO_DEFAULT_VALUE, labelKey: 'label.no-default' },
  { value: DefaultAppMode.Classic, labelKey: 'label.classic' },
  { value: DefaultAppMode.AI, labelKey: 'label.ai' },
];

const AppModeSettings = (props: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettingsFetch(getAppConfiguration);
  useEditHeaderAction('app-mode', isLoading, props);

  if (isLoading) {
    return <SettingsSkeleton rows={1} />;
  }

  const current = config?.defaultAppMode ?? NO_DEFAULT_VALUE;
  const option = APP_MODE_OPTIONS.find((item) => item.value === current);

  return (
    <SettingsSection
      testId="default-app-mode-page"
      title={t('label.default-app-mode')}>
      <ReadOnlyRow
        description={t('message.default-app-mode-description')}
        title={t('label.default-app-mode')}>
        <SettingValue
          testId="default-app-mode-value"
          value={option && t(option.labelKey)}
        />
      </ReadOnlyRow>
    </SettingsSection>
  );
};

export default AppModeSettings;
