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
import { FieldTypes, getField } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EMAIL_REG_EX } from '../../../../../../constants/regex.constants';
import { MASKED_PASSWORD_VALUE } from '../../../../../../constants/Secrets.constants';
import {
  SMTPSettings,
  TransportationStrategy,
} from '../../../../../../generated/email/smtpSettings';
import { SettingType } from '../../../../../../generated/settings/settings';
import {
  getSettingsConfigFromConfigType,
  updateSettingsConfig,
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
import { useFormFieldDocs } from './useFormFieldDocs';
import { useSettingsFetch } from './useSettingsFetch';

interface SelectOption {
  id: string;
  label: string;
}

export interface EmailFormValues {
  serverEndpoint: string;
  serverPort: string;
  transportationStrategy: SelectOption | null;
  enableSmtpServer: boolean;
  senderMail: string;
  emailingEntity: string;
  username: string;
  password: string;
  supportUrl: string;
}

const STRATEGY_OPTIONS: SelectOption[] = Object.values(
  TransportationStrategy
).map((strategy) => ({ id: strategy, label: strategy }));

const toOption = (value?: string) =>
  STRATEGY_OPTIONS.find((option) => option.id === value) ?? null;

export const toEmailFormValues = (config?: SMTPSettings): EmailFormValues => ({
  serverEndpoint: config?.serverEndpoint ?? '',
  serverPort: config?.serverPort?.toString() ?? '',
  transportationStrategy: toOption(config?.transportationStrategy),
  enableSmtpServer: Boolean(config?.enableSmtpServer),
  senderMail: config?.senderMail ?? '',
  emailingEntity: config?.emailingEntity ?? '',
  username: config?.username ?? '',
  password: config?.password ?? '',
  supportUrl: config?.supportUrl ?? '',
});

/**
 * Keeps server-owned keys (templates, templatePath) and drops the masked
 * password placeholder so an untouched password field never overwrites the
 * stored secret.
 */
export const toSmtpSettings = (
  values: EmailFormValues,
  original?: SMTPSettings
): SMTPSettings => {
  const settings: SMTPSettings = {
    ...original,
    serverEndpoint: values.serverEndpoint,
    serverPort: Number(values.serverPort),
    transportationStrategy: values.transportationStrategy?.id as
      | TransportationStrategy
      | undefined,
    enableSmtpServer: values.enableSmtpServer,
    senderMail: values.senderMail,
    emailingEntity: values.emailingEntity || undefined,
    username: values.username || undefined,
    password: values.password || undefined,
    supportUrl: values.supportUrl || undefined,
  };

  if (settings.password === MASKED_PASSWORD_VALUE) {
    delete settings.password;
  }

  return settings;
};

const fetchEmailConfig = async () => {
  const { data } = await getSettingsConfigFromConfigType(
    SettingType.EmailConfiguration
  );

  return data?.config_value as SMTPSettings | undefined;
};

const EmailSettingsForm = ({
  showHint,
  onNavigate,
}: PlatformSettingsFormProps) => {
  const { t } = useTranslation();
  const docs = useFormFieldDocs('EmailConfiguration');
  const { data: config, isLoading } = useSettingsFetch(fetchEmailConfig);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<EmailFormValues>({
    defaultValues: toEmailFormValues(),
  });

  useEffect(() => {
    form.reset(toEmailFormValues(config));
  }, [config, form]);

  const backToView = () =>
    onNavigate({ type: 'page', page: 'email', isEditing: false });

  const fields = useMemo(() => {
    const requiredRule = (labelKey: string) => ({
      required: t('label.field-required', { field: t(labelKey) }),
    });
    const textField = (
      name: keyof EmailFormValues,
      labelKey: string,
      testId: string,
      extra: Partial<FieldProp> = {}
    ): FieldProp => ({
      name,
      label: t(labelKey),
      type: FieldTypes.TEXT,
      doc: docs[name],
      props: { 'data-testid': testId },
      ...extra,
    });

    return {
      serverEndpoint: textField(
        'serverEndpoint',
        'label.server-endpoint',
        'server-endpoint-input',
        { required: true, rules: requiredRule('label.server-endpoint') }
      ),
      serverPort: textField(
        'serverPort',
        'label.server-port',
        'server-port-input',
        {
          type: FieldTypes.NUMBER,
          required: true,
          rules: requiredRule('label.server-port'),
        }
      ),
      transportationStrategy: {
        name: 'transportationStrategy',
        label: t('label.transportation-strategy'),
        type: FieldTypes.SELECT,
        doc: docs.transportationStrategy,
        props: {
          'data-testid': 'transportation-strategy-input',
          items: STRATEGY_OPTIONS,
        },
      } as FieldProp,
      enableSmtpServer: {
        name: 'enableSmtpServer',
        label: t('label.enable-smtp-server'),
        type: FieldTypes.SWITCH,
        doc: docs.enableSmtpServer,
        props: { 'data-testid': 'smtp-server-input' },
      } as FieldProp,
      senderMail: textField(
        'senderMail',
        'label.sender-email',
        'sender-email-input',
        {
          doc: docs.senderEmail,
          required: true,
          rules: {
            ...requiredRule('label.sender-email'),
            pattern: {
              value: EMAIL_REG_EX,
              message: t('message.field-text-is-invalid', {
                fieldText: t('label.sender-email'),
              }),
            },
          },
        }
      ),
      emailingEntity: textField(
        'emailingEntity',
        'label.emailing-entity',
        'emailing-entity-input'
      ),
      username: textField('username', 'label.username', 'username-input'),
      password: textField('password', 'label.password', 'password-input', {
        type: FieldTypes.PASSWORD,
      }),
      supportUrl: textField(
        'supportUrl',
        'label.support-url',
        'support-url-input'
      ),
    };
  }, [docs, t]);

  const handleSubmit = async (values: EmailFormValues) => {
    setIsSaving(true);
    try {
      await updateSettingsConfig({
        config_type: SettingType.EmailConfiguration,
        config_value: toSmtpSettings(values, config),
      });
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.email-configuration'),
        })
      );
      backToView();
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-updating-error', {
          entity: t('label.email-configuration-lowercase'),
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="tw:p-8 tw:pt-0">
        <SettingsSkeleton rows={8} />
      </div>
    );
  }

  return (
    <SettingsFormLayout
      form={form}
      isSaving={isSaving}
      showHint={showHint}
      testId="email-config-form"
      onCancel={backToView}
      onSubmit={handleSubmit}>
      <SettingsFormSection title={t('label.server')}>
        {getField(fields.serverEndpoint)}
        {getField(fields.serverPort)}
        {getField(fields.transportationStrategy)}
        {getField(fields.enableSmtpServer)}
      </SettingsFormSection>
      <SettingsFormSection title={t('label.sender-and-authentication')}>
        {getField(fields.senderMail)}
        {getField(fields.emailingEntity)}
        {getField(fields.username)}
        {getField(fields.password)}
        {getField(fields.supportUrl)}
      </SettingsFormSection>
    </SettingsFormLayout>
  );
};

export default EmailSettingsForm;
