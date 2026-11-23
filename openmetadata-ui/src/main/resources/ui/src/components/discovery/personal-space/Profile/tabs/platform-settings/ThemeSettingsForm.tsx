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

import {
  Box,
  FormField,
  FormItemLabel,
  HintText,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { HEX_COLOR_CODE_REGEX } from '../../../../../../constants/regex.constants';
import {
  Settings,
  SettingType,
} from '../../../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { useFormFieldDocs } from '../../../../../../hooks/useFormFieldDocs';
import { updateSettingsConfig } from '../../../../../../rest/settingConfigAPI';
import { generatePalette } from '../../../../../../styles/colorPallet';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import HexColorField from './HexColorField';
import LogoUrlField from './LogoUrlField';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, { SettingsFormSection } from './SettingsFormLayout';
import {
  LogoUrlKey,
  LOGO_URL_FIELDS,
  ThemeFormValues,
  THEME_COLOR_FIELDS,
  toThemeConfig,
  toThemeFormValues,
} from './ThemeSettings.utils';

// Shades of the primary palette the classic page derives hover/selected from.
const HOVER_SHADE = 2;
const SELECTED_SHADE = 8;

const ThemeSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const docs = useFormFieldDocs('CustomLogoConfiguration');
  const { applicationConfig, setApplicationConfig } = useApplicationStore();
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<ThemeFormValues>({
    defaultValues: toThemeFormValues(applicationConfig),
  });
  // Logo URLs still being checked or that failed to load; saving waits on them.
  const [blockingLogos, setBlockingLogos] = useState<LogoUrlKey[]>([]);

  useEffect(() => {
    form.reset(toThemeFormValues(applicationConfig));
  }, [applicationConfig, form]);

  const handleBlockingChange = useCallback(
    (name: LogoUrlKey, isBlocking: boolean) =>
      setBlockingLogos((current) => {
        const rest = current.filter((key) => key !== name);

        return isBlocking ? [...rest, name] : rest;
      }),
    []
  );

  // Picking a primary colour re-derives hover and selected, as the classic page does.
  const handlePrimaryChange = (value: string) => {
    if (!HEX_COLOR_CODE_REGEX.test(value)) {
      return;
    }
    const palette = generatePalette(value);
    form.setValue('hoverColor', palette[HOVER_SHADE], { shouldDirty: true });
    form.setValue('selectedColor', palette[SELECTED_SHADE], {
      shouldDirty: true,
    });
  };

  const backToView = () =>
    onNavigate({ type: 'page', page: 'theme', isEditing: false });

  const handleSubmit = async (values: ThemeFormValues) => {
    setIsSaving(true);
    try {
      const configValue = toThemeConfig(values);
      await updateSettingsConfig({
        config_type: SettingType.CustomUIThemePreference,
        config_value: configValue,
      } as Settings);
      setApplicationConfig(configValue);
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.theme') })
      );
      backToView();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsFormLayout
      centered
      form={form}
      isSaveDisabled={blockingLogos.length > 0}
      isSaving={isSaving}
      showHint={showHint}
      testId="theme-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.custom-logo')}>
        {LOGO_URL_FIELDS.map((config) => (
          <div className="tw:md:col-span-2" key={config.name}>
            <LogoUrlField
              config={config}
              docs={docs}
              form={form}
              onBlockingChange={handleBlockingChange}
            />
          </div>
        ))}
      </SettingsFormSection>

      <SettingsFormSection title={t('label.custom-theme')}>
        {THEME_COLOR_FIELDS.map(({ name, labelKey }) => (
          <FormField
            control={form.control}
            key={name}
            name={name}
            rules={{
              validate: (value: string) =>
                !value ||
                HEX_COLOR_CODE_REGEX.test(value) ||
                t('message.hex-color-validation'),
            }}>
            {({ field, fieldState }) => (
              <Box data-testid={name} direction="col" gap={2}>
                <FormItemLabel label={t(labelKey)} />
                <HexColorField
                  isInvalid={Boolean(fieldState.error)}
                  label={t(labelKey)}
                  name={name}
                  value={field.value ?? ''}
                  onBlur={field.onBlur}
                  onChange={(value) => {
                    field.onChange(value);
                    if (name === 'primaryColor') {
                      handlePrimaryChange(value);
                    }
                  }}
                />
                {fieldState.error && (
                  <HintText isInvalid>{fieldState.error.message}</HintText>
                )}
              </Box>
            )}
          </FormField>
        ))}
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default ThemeSettingsForm;
