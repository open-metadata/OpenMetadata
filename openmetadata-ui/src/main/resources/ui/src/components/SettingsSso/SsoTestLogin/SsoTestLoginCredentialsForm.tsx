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
  Button,
  FieldProp,
  FieldTypes,
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EMAIL_REG_EX } from '../../../constants/regex.constants';
import {
  SsoTestLoginCredentialsFormProps,
  SsoTestLoginCredentialsFormValues,
} from './SsoTestLogin.interface';

/**
 * LDAP and Basic sign in with a password, not a redirect, so their Test Login asks for the
 * credentials here. They are sent once to the admin-only credentials endpoint and never stored.
 */
const SsoTestLoginCredentialsForm = ({
  isSubmitting,
  onSubmit,
}: Readonly<SsoTestLoginCredentialsFormProps>) => {
  const { t } = useTranslation();
  const form = useForm<SsoTestLoginCredentialsFormValues>({
    defaultValues: { email: '', password: '' },
  });

  const emailField: FieldProp = useMemo(
    () => ({
      name: 'email',
      label: t('label.email'),
      type: FieldTypes.TEXT,
      required: true,
      id: 'sso-test-login-email',
      // Same rules as the sign-in page, so the test accepts exactly what login would.
      rules: {
        required: t('message.field-text-is-required', {
          fieldText: t('label.email'),
        }),
        pattern: {
          value: EMAIL_REG_EX,
          message: t('message.field-text-is-invalid', {
            fieldText: t('label.email'),
          }),
        },
      },
      // These are the tested account's credentials: keep the browser from saving them as this
      // admin's own sign-in.
      props: { 'data-testid': 'sso-test-login-email', autoComplete: 'off' },
    }),
    [t]
  );

  const passwordField: FieldProp = useMemo(
    () => ({
      name: 'password',
      label: t('label.password'),
      type: FieldTypes.PASSWORD,
      required: true,
      id: 'sso-test-login-password',
      rules: {
        required: t('message.field-text-is-required', {
          fieldText: t('label.password'),
        }),
      },
      props: {
        'data-testid': 'sso-test-login-password',
        autoComplete: 'new-password',
      },
    }),
    [t]
  );

  const submitForm = form.handleSubmit(({ email, password }) =>
    onSubmit(email, password)
  );

  return (
    <HookForm
      className="tw:flex tw:flex-col tw:gap-4"
      data-testid="sso-test-login-credentials-form"
      form={form}
      onSubmit={submitForm}>
      <Typography as="p" className="tw:text-sm tw:text-tertiary">
        {t('message.sso-test-login-credentials-description')}
      </Typography>
      {getField(emailField)}
      {getField(passwordField)}
      <Button
        className="tw:self-end"
        data-testid="sso-test-login-submit-credentials"
        isDisabled={isSubmitting}
        isLoading={isSubmitting}
        type="submit">
        {t('label.test-sign-in')}
      </Button>
    </HookForm>
  );
};

export default SsoTestLoginCredentialsForm;
