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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import IconAuth0 from '../../assets/img/icon-auth0.svg';
import IconCognito from '../../assets/img/icon-aws-cognito.png';
import IconAzure from '../../assets/img/icon-azure.png';
import IconGoogle from '../../assets/img/icon-google.png';
import IconOkta from '../../assets/img/icon-okta.png';
import { useAuthProvider } from '../../components/Auth/AuthProviders/AuthProvider';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthContext';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import Loader from '../../components/common/Loader/Loader';
import LoginButton from '../../components/common/LoginButton/LoginButton';
import { CarouselLayout } from '../../components/Layout/CarouselLayout/CarouselLayout';
import { ROUTES } from '../../constants/constants';
import { EMAIL_REG_EX } from '../../constants/regex.constants';
import { AuthProvider } from '../../generated/settings/settings';
import { useApplicationStore } from '../../hooks/useApplicationStore';

interface LoginFormValues {
  email: string;
  password: string;
}

const SignInPage = () => {
  const [loading, setLoading] = useState(false);
  const form = useForm<LoginFormValues>({
    defaultValues: { email: '', password: '' },
  });
  const hasTriggeredAutoRedirect = useRef(false);

  const navigate = useNavigate();
  const { authConfig, isAuthenticated } = useApplicationStore();
  const { onLoginHandler } = useAuthProvider();
  const { t } = useTranslation();

  const brandName = t('label.brand-name');

  const { isAuthProviderBasic, isAuthProviderLDAP } = useMemo(() => {
    return {
      isAuthProviderBasic:
        authConfig?.provider === AuthProvider.Basic ||
        authConfig?.provider === AuthProvider.LDAP,
      isAuthProviderLDAP: authConfig?.provider === AuthProvider.LDAP,
    };
  }, [authConfig]);

  const { handleLogin } = useBasicAuth();

  const handleSignIn = useCallback(() => {
    onLoginHandler && onLoginHandler();
  }, [onLoginHandler]);

  const shouldAutoRedirect =
    authConfig?.enableAutoRedirect &&
    !isAuthProviderBasic &&
    !isAuthenticated &&
    Boolean(onLoginHandler);

  useLayoutEffect(() => {
    if (shouldAutoRedirect && !hasTriggeredAutoRedirect.current) {
      hasTriggeredAutoRedirect.current = true;
      handleSignIn();
    }
  }, [shouldAutoRedirect, handleSignIn]);

  const signInButton = useMemo(() => {
    let ssoBrandLogo;
    let ssoBrandName;
    switch (authConfig?.provider) {
      case AuthProvider.Google: {
        ssoBrandLogo = IconGoogle;
        ssoBrandName = 'Google';

        break;
      }
      case AuthProvider.CustomOidc: {
        ssoBrandName = authConfig?.providerName
          ? authConfig?.providerName
          : 'SSO';

        break;
      }
      case AuthProvider.Saml: {
        ssoBrandName = authConfig?.providerName
          ? authConfig?.providerName
          : 'SAML SSO';

        break;
      }
      case AuthProvider.Okta: {
        ssoBrandLogo = IconOkta;
        ssoBrandName = 'Okta';

        break;
      }
      case AuthProvider.AwsCognito: {
        ssoBrandLogo = IconCognito;
        ssoBrandName = 'AWS Cognito';

        break;
      }
      case AuthProvider.Azure: {
        ssoBrandLogo = IconAzure;
        ssoBrandName = 'Azure';

        break;
      }
      case AuthProvider.Auth0: {
        ssoBrandLogo = IconAuth0;
        ssoBrandName = 'Auth0';

        break;
      }
      default: {
        return (
          <Typography as="div" color="secondary" size="text-md">
            {t('message.sso-provider-not-supported', {
              provider: authConfig?.provider,
            })}
          </Typography>
        );
      }
    }

    return (
      <LoginButton
        ssoBrandLogo={ssoBrandLogo}
        ssoBrandName={ssoBrandName}
        onClick={handleSignIn}
      />
    );
  }, [authConfig?.provider, authConfig?.providerName, handleSignIn, t]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTES.HOME);
    }
  }, [isAuthenticated, navigate]);

  if (!authConfig) {
    return <Loader fullScreen />;
  }

  if (isAuthenticated) {
    return <Loader fullScreen />;
  }

  if (shouldAutoRedirect) {
    return <Loader fullScreen />;
  }

  const handleSubmit = async ({ email, password }: LoginFormValues) => {
    setLoading(true);
    await Promise.resolve(handleLogin(email, password));
    setLoading(false);
  };

  const onClickSignUp = () => {
    navigate(ROUTES.REGISTER);
  };

  const onClickForgotPassword = () => {
    navigate(ROUTES.FORGOT_PASSWORD);
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
        message: t('message.field-text-is-invalid', {
          fieldText: t('label.email'),
        }),
      },
    },
    props: {
      'data-testid': 'email',
      size: 'md',
    },
  };

  const passwordField: FieldProp = {
    name: 'password',
    type: FieldTypes.PASSWORD,
    label: t('label.password'),
    id: 'root/password',
    placeholder: t('label.password'),
    required: true,
    rules: {
      required: t('message.field-text-is-required', {
        fieldText: t('label.password'),
      }),
    },
    props: {
      'data-testid': 'password',
      size: 'md',
    },
  };

  return (
    <CarouselLayout pageTitle={t('label.sign-in')}>
      <div
        className="tw:m-auto tw:flex tw:w-full tw:max-w-[520px] tw:flex-col tw:justify-center tw:px-6 tw:py-10"
        data-testid="login-form-container">
        <Card
          className="tw:w-full tw:border-none tw:rounded-[20px]"
          variant="elevated">
          <Card.Content className="tw:flex tw:flex-col tw:items-center tw:gap-6 tw:p-10">
            <BrandImage isMonoGram height={50} width={50} />
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
                  <FormFields fields={[emailField, passwordField]} />

                  <Button
                    color="link-color"
                    data-testid="forgot-password"
                    size="sm"
                    onPress={onClickForgotPassword}>
                    {t('label.forgot-password')}
                  </Button>

                  <Button
                    showTextWhileLoading
                    className="tw:w-full tw:justify-center"
                    color="primary"
                    data-testid="login"
                    isDisabled={loading}
                    isLoading={loading}
                    size="lg"
                    type="submit">
                    {t('label.sign-in')}
                  </Button>
                </HookForm>

                {!isAuthProviderLDAP && authConfig?.enableSelfSignup && (
                  <div className="tw:flex tw:items-center tw:justify-center tw:gap-1">
                    <Typography color="secondary" size="text-sm">
                      {t('message.new-to-the-platform')}
                    </Typography>
                    <Button
                      color="link-color"
                      data-testid="signup"
                      size="sm"
                      onPress={onClickSignUp}>
                      {t('label.create-entity', {
                        entity: t('label.account'),
                      })}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="tw:flex tw:w-full tw:flex-col tw:items-center tw:gap-6">
                <Typography
                  as="p"
                  className="tw:text-center"
                  color="secondary"
                  size="text-md">
                  {t('message.om-description')}
                </Typography>
                <div className="tw:w-full">{signInButton}</div>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </CarouselLayout>
  );
};

export default SignInPage;
