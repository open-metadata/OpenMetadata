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
import { getAppConfiguration } from '../../../../../../rest/settingConfigAPI';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import { SettingsSkeleton } from './SettingsFormLayout';
import SettingValue from './SettingValue';
import { COLUMN_ORDER_OPTIONS } from './TableSchemaSettings.constants';
import { getEffectiveColumnOrder } from './TableSchemaSettings.utils';
import { useEditHeaderAction } from './useEditHeaderAction';
import { useSettingsFetch } from './useSettingsFetch';

const TableSchemaSettings = (props: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { data: config, isLoading } = useSettingsFetch(getAppConfiguration);
  useEditHeaderAction('table-schema', isLoading, props);

  if (isLoading) {
    return <SettingsSkeleton rows={1} />;
  }

  const current = getEffectiveColumnOrder(config?.defaultColumnOrder);
  const option = COLUMN_ORDER_OPTIONS.find((item) => item.value === current);

  return (
    <SettingsSection
      testId="table-schema-settings"
      title={t('label.table-and-schema')}>
      <ReadOnlyRow
        description={t('message.default-column-order-description')}
        title={t('label.default-column-order')}>
        <SettingValue
          testId="default-column-order-value"
          value={option?.getLabel(t)}
        />
      </ReadOnlyRow>
    </SettingsSection>
  );
};

export default TableSchemaSettings;
