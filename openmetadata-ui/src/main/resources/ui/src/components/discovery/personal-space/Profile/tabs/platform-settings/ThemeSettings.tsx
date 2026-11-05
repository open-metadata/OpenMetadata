/*
 *  Copyright 2023 Collate.
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

import { Box, Button, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  SettingType,
} from '../../../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { updateSettingsConfig } from '../../../../../../rest/settingConfigAPI';
import { getThemeConfig } from '../../../../../../utils/ThemeUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import BrandImage from '../../../../../common/BrandImage/BrandImage';
import SettingsSection, { ReadOnlyRow } from '../../components/SettingsSection';
import type { PlatformSettingsPageProps } from './PlatformSettings.types';
import SettingValue from './SettingValue';
import {
  EMPTY_THEME_CONFIG,
  LOGO_URL_FIELDS,
  THEME_COLOR_FIELDS,
} from './ThemeSettings.utils';
import { useEditHeaderAction } from './useEditHeaderAction';

/** Reads the live theme from the app store, which is what the app renders with. */
const ThemeSettings = (props: PlatformSettingsPageProps) => {
  const { t } = useTranslation();
  const { applicationConfig, setApplicationConfig } = useApplicationStore();
  const [isResetting, setIsResetting] = useState(false);

  const resetAction = useMemo(() => {
    const handleReset = async () => {
      setIsResetting(true);
      try {
        await updateSettingsConfig({
          config_type: SettingType.CustomUIThemePreference,
          config_value: EMPTY_THEME_CONFIG,
        } as Settings);
        setApplicationConfig({
          ...EMPTY_THEME_CONFIG,
          customTheme: getThemeConfig(EMPTY_THEME_CONFIG.customTheme),
        });
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsResetting(false);
      }
    };

    return (
      <Button
        color="secondary"
        data-testid="reset-button"
        isLoading={isResetting}
        size="sm"
        onPress={handleReset}>
        {t('label.reset')}
      </Button>
    );
  }, [isResetting, setApplicationConfig, t]);

  useEditHeaderAction('theme', false, props, resetAction);

  return (
    <Box data-testid="theme-settings" direction="col" gap={8}>
      <SettingsSection title={t('label.custom-logo')}>
        {LOGO_URL_FIELDS.map(({ name, labelKey, isMonogram }) => {
          const url = applicationConfig?.customLogoConfig?.[name];

          return (
            <ReadOnlyRow key={name} title={t(labelKey)}>
              <Box align="center" direction="row" gap={4}>
                <SettingValue testId={`${name}-value`} value={url} />
                <BrandImage
                  className="tw:rounded-md tw:border tw:border-secondary tw:object-contain tw:p-1"
                  dataTestId={`${name}-preview`}
                  height={40}
                  isMonoGram={isMonogram}
                  src={url || undefined}
                  width={isMonogram ? 40 : 100}
                />
              </Box>
            </ReadOnlyRow>
          );
        })}
      </SettingsSection>

      <SettingsSection title={t('label.custom-theme')}>
        {THEME_COLOR_FIELDS.map(({ name, labelKey }) => {
          const color = applicationConfig?.customTheme?.[name];

          return (
            <ReadOnlyRow key={name} title={t(labelKey)}>
              <Box align="center" direction="row" gap={3}>
                {color && (
                  <span
                    className="tw:size-6 tw:rounded-md tw:border tw:border-secondary"
                    data-testid={`${name}-swatch`}
                    style={{ backgroundColor: color }}
                  />
                )}
                {color ? (
                  <Typography
                    className="tw:font-mono tw:text-primary"
                    data-testid={`${name}-value`}
                    size="text-sm">
                    {color}
                  </Typography>
                ) : (
                  <SettingValue testId={`${name}-value`} />
                )}
              </Box>
            </ReadOnlyRow>
          );
        })}
      </SettingsSection>
    </Box>
  );
};

export default ThemeSettings;
