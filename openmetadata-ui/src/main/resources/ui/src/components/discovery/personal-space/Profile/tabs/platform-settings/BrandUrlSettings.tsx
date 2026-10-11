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
import { OpenMetadataBaseURLConfiguration } from '../../../../../../generated/configuration/openMetadataBaseUrlConfiguration';
import { SettingType } from '../../../../../../generated/settings/settings';
import { getSettingsConfigFromConfigType } from '../../../../../../rest/settingConfigAPI';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import SettingValue from './SettingValue';
import { useEditHeaderAction } from './useEditHeaderAction';
import { useSettingsFetch } from './useSettingsFetch';

export const fetchBrandUrlConfig = async () => {
  const { data } = await getSettingsConfigFromConfigType(
    SettingType.OpenMetadataBaseURLConfiguration
  );

  return data?.config_value as OpenMetadataBaseURLConfiguration | undefined;
};

const BrandUrlSettings = (props: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettingsFetch(fetchBrandUrlConfig);
  useEditHeaderAction('brand-url', isLoading, props);

  if (isLoading) {
    return <SettingsSkeleton rows={1} />;
  }

  return (
    <SettingsSection testId="brand-url-settings" title={t('label.general')}>
      <ReadOnlyRow
        description={t('message.om-url-configuration-message')}
        title={t('label.brand-name-url')}>
        <SettingValue
          testId="open-metadata-url"
          value={config?.openMetadataUrl}
        />
      </ReadOnlyRow>
    </SettingsSection>
  );
};

export default BrandUrlSettings;
