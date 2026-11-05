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
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthContext';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import { CarouselLayout } from '../../components/Layout/CarouselLayout/CarouselLayout';
import { ROUTES } from '../../constants/constants';
import { EMAIL_REG_EX, passwordRegex } from '../../constants/regex.constants';
import { AuthProvider } from '../../generated/settings/settings';
import { useApplicationStore } from '../../hooks/useApplicationStore';

interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

const BasicSignUp = () => {
  const { t } = useTranslation();
  const { authConfig } = useApplicationStore();
  const { handleRegister } = useBasicAuth();
  const navigate = useNavigate();

  const form = useForm<SignUpFormData>({
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const brandName = t('label.brand-name');

  const { isAuthProviderBasic } = useMemo(() => {
    return {
      isAuthProviderBasic:
        authConfig?.provider === AuthProvider.Basic ||
        authConfig?.provider === AuthProvider.LDAP,
    };
  }, [authConfig]);

  const handleSubmit = async (data: SignUpFormData) => {
    if (data.confirmPassword) {
      delete data['confirmPassword'];
    }
    if (data) {
      handleRegister(data);
    }
  };

  const handleLogin = () => {
    navigate(ROUTES.SIGNIN);
  };

  const firstNameField: FieldProp = {
    name: 'firstName',
    type: FieldTypes.TEXT,
    label: t('label.first-name'),
    id: 'root/firstName',
    placeholder: t('label.enter-entity', {
      entity: t('label.first-name-lowercase'),
    }),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.first-name'),
      }),
    },
    props: { 'data-testid': 'firstName', size: 'md' },
  };

  const lastNameField: FieldProp = {
    name: 'lastName',
    type: FieldTypes.TEXT,
    label: t('label.last-name'),
    id: 'root/lastName',
    placeholder: t('label.enter-entity', {
      entity: t('label.last-name-lowercase'),
    }),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.last-name'),
      }),
    },
    props: { 'data-testid': 'lastName', size: 'md' },
  };

  const emailField: FieldProp = {
    name: 'email',
    type: FieldTypes.TEXT,
    label: t('label.email'),
    id: 'root/email',
    placeholder: t('label.enter-entity', {
      entity: t('label.email-lowercase'),
    }),
    required: true,
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
    props: { 'data-testid': 'email', size: 'md' },
  };

  const passwordField: FieldProp = {
    name: 'password',
    type: FieldTypes.PASSWORD,
    label: t('label.password'),
    id: 'root/password',
    placeholder: t('label.enter-entity', {
      entity: t('label.password-lowercase'),
    }),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.password'),
      }),
      pattern: {
        value: passwordRegex,
        message: t('message.password-error-message'),
      },
    },
    props: { 'data-testid': 'password', size: 'md' },
  };

  const confirmPasswordField: FieldProp = {
    name: 'confirmPassword',
    type: FieldTypes.PASSWORD,
    label: t('label.password-type', { type: t('label.confirm') }),
    id: 'root/confirmPassword',
    placeholder: t('label.confirm-password'),
    required: true,
    rules: {
      validate: (value: string) => {
        const password = form.getValues('password');
        if (isEmpty(password)) {
          return t('label.please-password-type-first');
        }
        if (value !== password) {
          return t('label.password-not-match');
        }

        return true;
      },
      deps: ['password'],
    },
    props: { 'data-testid': 'confirmPassword', size: 'md' },
  };

  return (
    <CarouselLayout
      carouselClassName="signup-page"
      pageTitle={t('label.sign-up')}>
      <div
        className="tw:m-auto tw:flex tw:w-full tw:max-w-[520px] tw:flex-col tw:justify-center tw:px-6 tw:py-10"
        data-testid="signin-page">
        <Card className="tw:w-full tw:shadow-xl" variant="elevated">
          <Card.Content className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:p-10">
            <BrandImage isMonoGram height="auto" width={50} />
            <Typography
              as="h1"
              className="tw:whitespace-nowrap tw:text-center"
              size="display-sm"
              weight="semibold">
              {t('label.welcome-to')} {brandName}
            </Typography>

            {isAuthProviderBasic ? (
              <div className="tw:flex tw:w-full tw:flex-col tw:gap-6">
                <HookForm
                  className="tw:flex tw:flex-col tw:gap-5"
                  form={form}
                  onSubmit={form.handleSubmit(handleSubmit)}>
                  <FormFields
                    fields={[
                      firstNameField,
                      lastNameField,
                      emailField,
                      passwordField,
                      confirmPasswordField,
                    ]}
                  />

                  <Button
                    className="tw:w-full tw:justify-center"
                    color="primary"
                    data-testid="create-account"
                    size="lg"
                    type="submit">
                    {t('label.create-entity', { entity: t('label.account') })}
                  </Button>
                </HookForm>

                <div className="tw:flex tw:items-center tw:justify-center tw:gap-1">
                  <Typography color="secondary" size="text-sm">
                    {t('message.already-a-user')}
                  </Typography>
                  <Button
                    color="link-color"
                    data-testid="login"
                    size="sm"
                    onPress={handleLogin}>
                    {t('label.login')}
                  </Button>
                </div>
              </div>
            ) : null}
          </Card.Content>
        </Card>
      </div>
    </CarouselLayout>
  );
};

export default BasicSignUp;
