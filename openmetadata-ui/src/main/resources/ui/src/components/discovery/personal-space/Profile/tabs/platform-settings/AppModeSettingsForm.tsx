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
  FormField,
  RadioButton,
  RadioGroup,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DefaultAppMode } from '../../../../../../generated/api/configuration/appConfiguration';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import { APP_MODE_OPTIONS, NO_DEFAULT_VALUE } from './AppModeSettings';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { useSettingsFetch } from './useSettingsFetch';

interface AppModeFormValues {
  defaultAppMode: string;
}

const AppModeSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const pageTitle = t('label.default-app-mode');
  const { data: config, isLoading } = useSettingsFetch(getAppConfiguration);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<AppModeFormValues>({
    defaultValues: { defaultAppMode: NO_DEFAULT_VALUE },
  });

  useEffect(() => {
    form.reset({ defaultAppMode: config?.defaultAppMode ?? NO_DEFAULT_VALUE });
  }, [config, form]);

  const backToView = () =>
    onNavigate({ type: 'page', page: 'app-mode', isEditing: false });

  const handleSubmit = async ({ defaultAppMode }: AppModeFormValues) => {
    setIsSaving(true);
    try {
      await patchAppConfiguration({
        defaultAppMode:
          defaultAppMode === NO_DEFAULT_VALUE
            ? null
            : (defaultAppMode as DefaultAppMode),
      });
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
        <SettingsSkeleton rows={3} />
      </div>
    );
  }

  return (
    <SettingsFormLayout
      form={form}
      isSaveDisabled={!form.formState.isDirty}
      isSaving={isSaving}
      showHint={showHint}
      testId="app-mode-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={pageTitle}>
        <FormField control={form.control} name="defaultAppMode">
          {({ field }) => (
            <RadioGroup
              aria-label={pageTitle}
              data-testid="app-mode-radio-group"
              value={field.value}
              onChange={field.onChange}>
              {APP_MODE_OPTIONS.map((option) => (
                <RadioButton
                  data-testid={`app-mode-option-${option.value}`}
                  key={option.value}
                  label={t(option.labelKey)}
                  value={option.value}
                />
              ))}
            </RadioGroup>
          )}
        </FormField>
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default AppModeSettingsForm;
