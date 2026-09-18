/*
 *  Copyright 2024 Collate.
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
  Card,
  FieldProp,
  FieldTypes,
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import { HTTP_STATUS_CODE } from '../../constants/Auth.constants';
import { ROUTES } from '../../constants/constants';
import { EMAIL_REG_EX } from '../../constants/regex.constants';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

interface ForgotPasswordValues {
  email: string;
}

const ForgotPassword = () => {
  const { t } = useTranslation();
  const { handleForgotPassword } = useBasicAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const form = useForm<ForgotPasswordValues>({
    defaultValues: { email: '' },
  });

  const handleSubmit = useCallback(
    async (data: ForgotPasswordValues) => {
      try {
        setLoading(true);
        await handleForgotPassword?.(data.email);
        showSuccessToast(t('message.reset-link-has-been-sent'));
      } catch (error) {
        showErrorToast(
          (error as AxiosError).response?.status ===
            HTTP_STATUS_CODE.FAILED_DEPENDENCY
            ? t('server.forgot-password-email-error')
            : t('server.email-not-found')
        );
      } finally {
        setLoading(false);
      }
    },
    [handleForgotPassword, t]
  );

  const handleLogin = () => {
    navigate(ROUTES.SIGNIN);
  };

  const emailField: FieldProp = {
    name: 'email',
    type: FieldTypes.TEXT,
    label: t('label.email'),
    id: 'root/email',
    placeholder: t('label.email'),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.email'),
      }),
      pattern: {
        value: EMAIL_REG_EX,
        message: t('label.field-invalid', { field: t('label.email') }),
      },
    },
    props: { 'data-testid': 'email', size: 'md' },
  };

  return (
    <div
      className="tw:relative tw:min-h-screen tw:w-full tw:overflow-hidden tw:bg-primary tw:py-24"
      data-testid="forgot-password-container">
      <DocumentTitle title={t('label.forgot-password')} />
      <Card
        className="tw:relative tw:mx-auto tw:w-full tw:max-w-[512px] tw:shadow-xl"
        variant="elevated">
        <Card.Content className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:p-12">
          <BrandImage
            isMonoGram
            className="tw:mx-auto"
            height="auto"
            width={50}
          />
          <Box className="tw:text-center" direction="col" gap={3}>
            <Typography as="h1" size="display-xs" weight="semibold">
              {t('label.forgot-your-password')}
            </Typography>
            <Typography
              as="p"
              className="tw:mt-2"
              color="secondary"
              size="text-md">
              {t('message.enter-your-registered-email')}
            </Typography>
          </Box>

          <HookForm
            className="tw:flex tw:w-full tw:flex-col tw:gap-6"
            form={form}
            onSubmit={form.handleSubmit(handleSubmit)}>
            {getField(emailField)}
            <Button
              showTextWhileLoading
              className="tw:w-full tw:justify-center"
              color="primary"
              data-testid="submit-button"
              isDisabled={loading}
              isLoading={loading}
              size="lg"
              type="submit">
              {t('label.send-login-link')}
            </Button>
          </HookForm>

          <div className="tw:flex tw:justify-center">
            <Button
              color="link-color"
              data-testid="go-back-button"
              size="sm"
              onPress={handleLogin}>
              {t('message.go-back-to-login-page')}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default ForgotPassword;
