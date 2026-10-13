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

import { Toggle } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { globalSettings as NUMBER_SETTINGS } from '../../../../../../../constants/SearchSettings.constant';
import { GlobalSettings } from '../../../../../../../generated/configuration/searchSettings';
import SettingsSection, {
  ReadOnlyRow,
} from '../../../components/SettingsSection';
import NumberSettingRow from './NumberSettingRow';

interface GlobalSearchSettingsProps {
  globalSettings: GlobalSettings;
  isDisabled: boolean;
  onUpdate: (
    update: Partial<GlobalSettings>,
    successMessage?: string
  ) => Promise<boolean>;
  /** Turning column indexing off is confirmed first: it drops column search. */
  onDisableColumnIndexing: () => void;
}

/** Toggles and limits that apply to every index, each saved on change. */
const GlobalSearchSettings = ({
  globalSettings,
  isDisabled,
  onUpdate,
  onDisableColumnIndexing,
}: GlobalSearchSettingsProps) => {
  const { t } = useTranslation();
  // Installs that predate the setting have no stored value, and they index columns.
  const columnIndexing = globalSettings.enableColumnIndexing ?? true;

  return (
    <SettingsSection title={t('label.global-setting-plural')}>
      <ReadOnlyRow title={t('label.enable-roles-polices-in-search')}>
        <Toggle
          aria-label={t('label.enable-roles-polices-in-search')}
          data-testid="enable-roles-polices-in-search-switch"
          isDisabled={isDisabled}
          isSelected={Boolean(globalSettings.enableAccessControl)}
          onChange={(enabled) => onUpdate({ enableAccessControl: enabled })}
        />
      </ReadOnlyRow>
      <ReadOnlyRow
        title={t('label.enable-entity', {
          entity: t('label.column-indexing'),
        })}>
        <Toggle
          aria-label={t('label.column-indexing')}
          data-testid="enable-column-indexing-switch"
          isDisabled={isDisabled}
          isSelected={columnIndexing}
          onChange={() =>
            columnIndexing
              ? onDisableColumnIndexing()
              : onUpdate(
                  { enableColumnIndexing: true },
                  t('message.column-indexing-enabled-reindex')
                )
          }
        />
      </ReadOnlyRow>
      {NUMBER_SETTINGS.map(({ key, label, min, max }) => (
        <NumberSettingRow
          isDisabled={isDisabled}
          key={key}
          label={t(label)}
          max={max ?? Number.MAX_SAFE_INTEGER}
          min={min ?? 0}
          name={key}
          value={(globalSettings[key as keyof GlobalSettings] as number) ?? 0}
          onSave={(value) => onUpdate({ [key]: value })}
        />
      ))}
    </SettingsSection>
  );
};

export default GlobalSearchSettings;
