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
import { Select, Tabs, Toggle } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import type { Key } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../../../../context/UntitledUIThemeProvider/theme-provider';
import type { ThemePreference } from '../../../../../../context/UntitledUIThemeProvider/theme-provider.interface';
import localUtilClassBase from '../../../../../../utils/i18next/LocalUtilClassBase';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import {
  readCompactSidebarPreference,
  setCompactSidebarPreference,
} from '../../../../../platform/ai-shell/Sidebar/sidebarPreference.utils';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import { LANGUAGE_ITEMS, THEME_OPTIONS } from './PreferencesPanel.constants';

/** Per-device preferences: theme, compact sidebar and language. */
const PreferencesPanel = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { themePreference, setTheme } = useTheme();
  const [isCompactSidebar, setIsCompactSidebar] = useState(
    readCompactSidebarPreference
  );

  const handleCompactSidebarChange = (compact: boolean) => {
    setIsCompactSidebar(compact);
    setCompactSidebarPreference(compact);
  };

  // Same as the user menu's language switch: the new locale is loaded, then
  // the page reloads so every screen picks it up.
  const handleLanguageChange = async (key: Key | null) => {
    if (!key || key === i18n.language) {
      return;
    }
    try {
      await localUtilClassBase.loadLocales(String(key));
      await i18n.changeLanguage(String(key));
      void navigate(0);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-8"
      data-testid="preferences-panel">
      <SettingsSection title={t('label.profile')}>
        <ReadOnlyRow
          description={t('message.theme-preference-description')}
          title={t('label.theme')}>
          <Tabs
            aria-label={t('label.theme')}
            className="tw:w-fit"
            data-testid="theme-preference"
            selectedKey={themePreference}
            onSelectionChange={(key) => setTheme(key as ThemePreference)}>
            <Tabs.List size="sm" type="button-border">
              {THEME_OPTIONS.map(({ id, labelKey }) => (
                <Tabs.Item
                  data-testid={`theme-preference-${id}`}
                  id={id}
                  key={id}>
                  {t(labelKey)}
                </Tabs.Item>
              ))}
            </Tabs.List>
          </Tabs>
        </ReadOnlyRow>
        <ReadOnlyRow
          description={t('message.compact-sidebar-description')}
          title={t('label.compact-sidebar')}>
          <Toggle
            aria-label={t('label.compact-sidebar')}
            data-testid="compact-sidebar-toggle"
            isSelected={isCompactSidebar}
            onChange={handleCompactSidebarChange}
          />
        </ReadOnlyRow>
      </SettingsSection>

      <SettingsSection title={t('label.language-and-region')}>
        <ReadOnlyRow
          description={t('message.language-preference-description')}
          title={t('label.language')}>
          <Select
            aria-label={t('label.language')}
            className="tw:w-56"
            data-testid="language-preference"
            items={LANGUAGE_ITEMS}
            size="sm"
            value={i18n.language}
            onChange={handleLanguageChange}>
            {(item) => <Select.Item id={item.id} label={item.label} />}
          </Select>
        </ReadOnlyRow>
      </SettingsSection>
    </div>
  );
};

export default PreferencesPanel;
