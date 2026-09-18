/*
 *  Copyright 2022 Collate.
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
  Card,
  FieldProp,
  FieldTypes,
  FormFields,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import QueryString from 'qs';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import { ROUTES } from '../../constants/constants';
import { passwordRegex } from '../../constants/regex.constants';
import { PasswordResetRequest } from '../../generated/auth/passwordResetRequest';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { showErrorToast } from '../../utils/ToastUtils';

interface ResetFormData {
  password: string;
  confirmPassword: string;
}

const ResetPassword = () => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const { handleResetPassword } = useBasicAuth();
  const navigate = useNavigate();
  const form = useForm<ResetFormData>({
    defaultValues: { password: '', confirmPassword: '' },
  });

  const params = useMemo(() => {
    const search = location.search;
    const data = QueryString.parse(
      search.startsWith('?') ? search.substring(1) : search
    );

    return data as { token: string; user: string };
  }, [location]);

  const handleSubmit = async (data: ResetFormData) => {
    const ResetRequest = {
      token: params?.token,
      username: params?.user,
      password: data.password,
      confirmPassword: data.confirmPassword,
    } as PasswordResetRequest;

    try {
      await handleResetPassword(ResetRequest);
      navigate(ROUTES.SIGNIN);
    } catch (err) {
      showErrorToast(err as AxiosError, t('server.unexpected-response'));
    }
  };

  const passwordField: FieldProp = {
    name: 'password',
    type: FieldTypes.PASSWORD,
    label: t('label.new-password'),
    id: 'root/password',
    placeholder: t('label.enter-entity', { entity: t('label.new-password') }),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.password'),
      }),
      pattern: {
        value: passwordRegex,
        message: t('message.password-pattern-error'),
      },
    },
    props: { 'data-testid': 'password', size: 'md' },
  };

  const confirmPasswordField: FieldProp = {
    name: 'confirmPassword',
    type: FieldTypes.PASSWORD,
    label: t('label.confirm-new-password'),
    id: 'root/confirmPassword',
    placeholder: t('label.re-enter-new-password'),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.confirm-new-password'),
      }),
      validate: (value: string) => {
        if (!value) {
          return true;
        }

        return (
          value === form.getValues('password') || t('label.password-not-match')
        );
      },
      deps: ['password'],
    },
    props: { 'data-testid': 'confirm-password', size: 'md' },
  };

  return (
    <div
      className="tw:min-h-screen tw:w-full tw:bg-primary tw:py-36"
      data-testid="reset-password-container">
      <DocumentTitle title={t('label.reset-your-password')} />
      <Card
        className="tw:mx-auto tw:w-full tw:max-w-[450px] tw:shadow-xl"
        variant="elevated">
        <Card.Content className="tw:flex tw:flex-col tw:gap-6 tw:p-12">
          <BrandImage
            isMonoGram
            className="tw:mx-auto"
            height="auto"
            width={50}
          />

          <Typography
            as="p"
            className="tw:text-center"
            color="secondary"
            size="text-xl"
            weight="medium">
            {t('label.reset-your-password')}
          </Typography>

          <HookForm
            className="tw:flex tw:w-full tw:flex-col tw:gap-6"
            form={form}
            onSubmit={form.handleSubmit(handleSubmit)}>
            <FormFields fields={[passwordField, confirmPasswordField]} />

            <Button
              className="tw:mt-2 tw:w-full tw:justify-center"
              color="primary"
              data-testid="submit-button"
              size="lg"
              type="submit">
              {t('label.save')}
            </Button>
          </HookForm>
        </Card.Content>
      </Card>
    </div>
  );
};

export default ResetPassword;
