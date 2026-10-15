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
import {
  Box,
  FormField,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DefaultTimeFormat } from '../../../../../../generated/api/configuration/appConfiguration';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { TIME_FORMAT_OPTIONS } from './PlatformSettings.constants';
import { useSettingsFetch } from './useSettingsFetch';

interface TimeFormatFormValues {
  defaultTimeFormat: DefaultTimeFormat;
}

const TimeFormatSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const pageTitle = t('label.default-time-format');
  const setTimeFormat = useApplicationStore((state) => state.setTimeFormat);
  const { data: config, isLoading } = useSettingsFetch(getAppConfiguration);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<TimeFormatFormValues>({
    defaultValues: { defaultTimeFormat: DefaultTimeFormat.The12H },
  });

  useEffect(() => {
    form.reset({
      defaultTimeFormat: config?.defaultTimeFormat ?? DefaultTimeFormat.The12H,
    });
  }, [config, form]);

  const backToView = () =>
    onNavigate({ type: 'page', page: 'time-format', isEditing: false });

  const handleSubmit = async ({ defaultTimeFormat }: TimeFormatFormValues) => {
    setIsSaving(true);
    try {
      await patchAppConfiguration({ defaultTimeFormat });
      setTimeFormat(defaultTimeFormat);
      showSuccessToast(
        t('server.entity-updated-success', { entity: pageTitle })
      );
      backToView();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="tw:p-8 tw:pt-0">
        <SettingsSkeleton rows={2} />
      </div>
    );
  }

  return (
    <SettingsFormLayout
      form={form}
      isSaveDisabled={!form.formState.isDirty}
      isSaving={isSaving}
      showHint={showHint}
      testId="time-format-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={pageTitle}>
        <Box className="tw:md:col-span-2" direction="col" gap={4}>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.default-time-format-description')}
          </Typography>
          <FormField control={form.control} name="defaultTimeFormat">
            {({ field }) => (
              <RadioGroup
                aria-label={pageTitle}
                data-testid="time-format-radio-group"
                value={field.value}
                onChange={field.onChange}>
                {TIME_FORMAT_OPTIONS.map((option) => (
                  <RadioButton
                    data-testid={`time-format-option-${option.value}`}
                    key={option.value}
                    label={t(option.labelKey)}
                    value={option.value}
                  />
                ))}
              </RadioGroup>
            )}
          </FormField>
        </Box>
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default TimeFormatSettingsForm;
