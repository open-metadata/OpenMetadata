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
import { DefaultTimeFormat } from '../../../../../../generated/api/configuration/appConfiguration';
import { getAppConfiguration } from '../../../../../../rest/settingConfigAPI';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import { TIME_FORMAT_OPTIONS } from './PlatformSettings.constants';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import SettingValue from './SettingValue';
import { useEditHeaderAction } from './useEditHeaderAction';
import { useSettingsFetch } from './useSettingsFetch';

const TimeFormatSettings = (props: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettingsFetch(getAppConfiguration);
  useEditHeaderAction('time-format', isLoading, props);

  if (isLoading) {
    return <SettingsSkeleton rows={1} />;
  }

  const current = config?.defaultTimeFormat ?? DefaultTimeFormat.The12H;
  const option = TIME_FORMAT_OPTIONS.find((item) => item.value === current);

  return (
    <SettingsSection
      testId="time-format-settings"
      title={t('label.default-time-format')}>
      <ReadOnlyRow
        description={t('message.default-time-format-description')}
        title={t('label.default-time-format')}>
        <SettingValue
          testId="default-time-format-value"
          value={option && t(option.labelKey)}
        />
      </ReadOnlyRow>
    </SettingsSection>
  );
};

export default TimeFormatSettings;
