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

import type { FieldProp } from '@openmetadata/ui-core-components';
import { FieldTypes, FormFields } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LoginConfiguration } from '../../../../../../generated/configuration/loginConfiguration';
import {
  Settings,
  SettingType,
} from '../../../../../../generated/settings/settings';
import {
  getLoginConfig,
  updateSettingsConfig,
} from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import type { PlatformSettingsFormProps } from './PlatformSettings.types';
import {
  nonNegativeNumberRules,
  toOptionalNumber,
} from './PlatformSettings.utils';
import SettingsFormLayout, {
  SettingsFormSection,
  SettingsSkeleton,
} from './SettingsFormLayout';
import { useFormFieldDocs } from './useFormFieldDocs';
import { useSettingsFetch } from './useSettingsFetch';

type LoginFormValues = Record<keyof LoginConfiguration, string>;

const LOGIN_FIELDS: [keyof LoginConfiguration, string][] = [
  ['maxLoginFailAttempts', 'label.max-login-fail-attempt-plural'],
  ['accessBlockTime', 'label.access-block-time'],
  ['jwtTokenExpiryTime', 'label.jwt-token-expiry-time'],
];

const toFormValues = (config?: LoginConfiguration): LoginFormValues => ({
  maxLoginFailAttempts: config?.maxLoginFailAttempts?.toString() ?? '',
  accessBlockTime: config?.accessBlockTime?.toString() ?? '',
  jwtTokenExpiryTime: config?.jwtTokenExpiryTime?.toString() ?? '',
});

const LoginSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const docs = useFormFieldDocs('CustomLoginConfiguration');
  const { data: config, isLoading } = useSettingsFetch(getLoginConfig);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<LoginFormValues>({ defaultValues: toFormValues() });

  useEffect(() => {
    form.reset(toFormValues(config));
  }, [config, form]);

  const fields: FieldProp[] = useMemo(
    () =>
      LOGIN_FIELDS.map(([name, labelKey]) => ({
        name,
        label: t(labelKey),
        type: FieldTypes.NUMBER,
        doc: docs[name],
        props: { 'data-testid': name },
        rules: nonNegativeNumberRules(t, labelKey),
      })),
    [docs, t]
  );

  const backToView = () =>
    onNavigate({
      type: 'page',
      page: 'login-configuration',
      isEditing: false,
    });

  const handleSubmit = async (values: LoginFormValues) => {
    setIsSaving(true);
    try {
      const configValue: LoginConfiguration = {
        maxLoginFailAttempts: toOptionalNumber(values.maxLoginFailAttempts),
        accessBlockTime: toOptionalNumber(values.accessBlockTime),
        jwtTokenExpiryTime: toOptionalNumber(values.jwtTokenExpiryTime),
      };
      // The generated `Settings.config_value` union omits LoginConfiguration.
      await updateSettingsConfig({
        config_type: SettingType.LoginConfiguration,
        config_value: configValue,
      } as Settings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.login-configuration'),
        })
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
      isSaving={isSaving}
      showHint={showHint}
      testId="custom-login-config-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.login-configuration')}>
        <FormFields fields={fields} />
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default LoginSettingsForm;
