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

import type { FieldProp } from '@openmetadata/ui-core-components';
import {
  Box,
  FieldTypes,
  FormField,
  FormItemLabel,
  getField,
  HintText,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { HEX_COLOR_CODE_REGEX } from '../../../../../../constants/regex.constants';
import {
  Settings,
  SettingType,
} from '../../../../../../generated/settings/settings';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { updateSettingsConfig } from '../../../../../../rest/settingConfigAPI';
import { generatePalette } from '../../../../../../styles/colorPallet';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import BrandImage from '../../../../../common/BrandImage/BrandImage';
import HexColorField from './HexColorField';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, { SettingsFormSection } from './SettingsFormLayout';
import {
  isValidUrl,
  LOGO_URL_FIELDS,
  ThemeFormValues,
  THEME_COLOR_FIELDS,
  toThemeConfig,
  toThemeFormValues,
} from './ThemeSettings.utils';
import { useFormFieldDocs } from './useFormFieldDocs';

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
  const logoUrls = useWatch({
    control: form.control,
    name: LOGO_URL_FIELDS.map(({ name }) => name),
  });

  useEffect(() => {
    form.reset(toThemeFormValues(applicationConfig));
  }, [applicationConfig, form]);

  const logoFields: FieldProp[] = useMemo(
    () =>
      LOGO_URL_FIELDS.map(({ name, labelKey }) => ({
        name,
        label: t(labelKey),
        type: FieldTypes.TEXT,
        doc: docs[name],
        props: { 'data-testid': name },
        rules: {
          validate: (value: string) =>
            !value ||
            isValidUrl(value) ||
            t('message.entity-is-not-valid-url', { entity: t(labelKey) }),
        },
      })),
    [docs, t]
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
      form={form}
      isSaving={isSaving}
      showHint={showHint}
      testId="theme-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.custom-logo')}>
        {logoFields.map((field, index) => {
          const { isMonogram } = LOGO_URL_FIELDS[index];

          return (
            <Box
              align="end"
              className="tw:md:col-span-2"
              direction="row"
              gap={6}
              key={field.name}>
              <div className="tw:flex-1">{getField(field)}</div>
              <BrandImage
                className="tw:rounded-md tw:border tw:border-secondary tw:object-contain tw:p-1"
                dataTestId={`${field.name}-preview`}
                height={40}
                isMonoGram={isMonogram}
                src={logoUrls[index] || undefined}
                width={isMonogram ? 40 : 100}
              />
            </Box>
          );
        })}
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
