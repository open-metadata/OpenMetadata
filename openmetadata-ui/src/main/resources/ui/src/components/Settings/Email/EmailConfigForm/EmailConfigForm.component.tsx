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
  Button,
  FieldProp,
  FieldTypes,
  FormFields,
  HookForm,
} from '@openmetadata/ui-core-components';
import { FocusEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  EMAIL_CONFIG_FORM_FIELDS,
  TRANSPORTATION_STRATEGY_OPTIONS,
} from '../../../../constants/EmailConfig.constants';
import { SMTPSettings } from '../../../../generated/email/smtpSettings';
import {
  EmailFormValues,
  toEmailFormValues,
  toSmtpSettings,
} from '../../../discovery/personal-space/Profile/tabs/platform-settings/EmailSettingsForm';

interface EmailConfigFormProps {
  isLoading: boolean;
  emailConfigValues?: SMTPSettings;
  /** Fields the deployment configuration owns: shown, but not editable. */
  managedFields?: (keyof SMTPSettings)[];
  onSubmit: (configValues: SMTPSettings) => void;
  onCancel: () => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
}

function EmailConfigForm({
  emailConfigValues,
  isLoading,
  managedFields = [],
  onCancel,
  onFocus,
  onSubmit,
}: EmailConfigFormProps) {
  const { t } = useTranslation();
  const form = useForm<EmailFormValues>({
    defaultValues: toEmailFormValues(emailConfigValues),
  });

  const isManaged = (field: keyof SMTPSettings) =>
    managedFields.includes(field);
  const isEveryFieldManaged = EMAIL_CONFIG_FORM_FIELDS.every(isManaged);

  const textField = (
    name: keyof EmailFormValues & keyof SMTPSettings,
    label: string,
    testId: string,
    type: FieldTypes = FieldTypes.TEXT,
    required = false
  ): FieldProp => ({
    name,
    label,
    type,
    required,
    id: `root/${name}`,
    props: { inputDataTestId: testId, isDisabled: isManaged(name) },
    rules: required
      ? {
          required: t('message.field-text-is-required', { fieldText: label }),
        }
      : undefined,
  });

  const fields: FieldProp[] = [
    textField('username', t('label.username'), 'username-input'),
    textField(
      'password',
      t('label.password'),
      'password-input',
      FieldTypes.PASSWORD
    ),
    textField(
      'senderMail',
      t('label.sender-email'),
      'sender-email-input',
      FieldTypes.TEXT,
      true
    ),
    textField(
      'serverEndpoint',
      t('label.server-endpoint'),
      'server-endpoint-input',
      FieldTypes.TEXT,
      true
    ),
    textField(
      'serverPort',
      t('label.server-port'),
      'server-port-input',
      FieldTypes.NUMBER,
      true
    ),
    textField(
      'emailingEntity',
      t('label.emailing-entity'),
      'emailing-entity-input'
    ),
    {
      name: 'enableSmtpServer',
      label: t('label.enable-smtp-server'),
      type: FieldTypes.SWITCH,
      id: 'root/enableSmtpServer',
      props: {
        'data-testid': 'smtp-server-input',
        isDisabled: isManaged('enableSmtpServer'),
      },
    },
    textField('supportUrl', t('label.support-url'), 'support-url-input'),
    {
      name: 'transportationStrategy',
      label: t('label.transportation-strategy'),
      type: FieldTypes.SELECT,
      id: 'root/transportationStrategy',
      props: {
        'data-testid': 'transportation-strategy-input',
        isDisabled: isManaged('transportationStrategy'),
        items: TRANSPORTATION_STRATEGY_OPTIONS.map(({ value, label }) => ({
          id: value,
          label,
        })),
      },
    },
  ];

  return (
    // Reports the focused field to the doc panel; focus events bubble.
    <div role="presentation" onFocus={onFocus}>
      <HookForm
        className="tw:flex tw:flex-col tw:gap-4"
        data-testid="email-config-form"
        form={form}
        id="email-config-form"
        onSubmit={form.handleSubmit((values) =>
          onSubmit(toSmtpSettings(values))
        )}>
        <FormFields fields={fields} />
        <Box className="layout-row" gap={3} justify="end" wrap="wrap">
          <Box className="layout-column tw:block">
            <Button color="secondary" onClick={onCancel}>
              {t('label.cancel')}
            </Button>
          </Box>
          {!isEveryFieldManaged && (
            <Box className="layout-column tw:block">
              <Button color="primary" isLoading={isLoading} type="submit">
                {t('label.save')}
              </Button>
            </Box>
          )}
        </Box>
      </HookForm>
    </div>
  );
}

export default EmailConfigForm;
