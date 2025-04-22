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

import { Button, Col, Divider, Form, Input, Row, Typography } from 'antd';
import classNames from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import IconAuth0 from '../../assets/img/icon-auth0.png';
import IconCognito from '../../assets/img/icon-aws-cognito.png';
import IconAzure from '../../assets/img/icon-azure.png';
import IconGoogle from '../../assets/img/icon-google.png';
import IconOkta from '../../assets/img/icon-okta.png';
import loginBG from '../../assets/img/login-bg.png';
import AlertBar from '../../components/AlertBar/AlertBar';
import { useBasicAuth } from '../../components/Auth/AuthProviders/BasicAuthProvider';
import BrandImage from '../../components/common/BrandImage/BrandImage';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import Loader from '../../components/common/Loader/Loader';
import LoginButton from '../../components/common/LoginButton/LoginButton';
import { ROUTES, VALIDATION_MESSAGES } from '../../constants/constants';
import { EMAIL_REG_EX } from '../../constants/regex.constants';
import { AuthProvider } from '../../generated/settings/settings';
import { useAlertStore } from '../../hooks/useAlertStore';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import './login.style.less';
import LoginCarousel from './LoginCarousel';

const SignInPage = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const navigate = useNavigate();
  const { authConfig, onLoginHandler, isAuthenticated } = useApplicationStore();
  const { alert, resetAlert } = useAlertStore();

  const { t } = useTranslation();

  const { isAuthProviderBasic, isAuthProviderLDAP } = useMemo(() => {
    return {
      isAuthProviderBasic:
        authConfig?.provider === AuthProvider.Basic ||
        authConfig?.provider === AuthProvider.LDAP,
      isAuthProviderLDAP: authConfig?.provider === AuthProvider.LDAP,
    };
  }, [authConfig]);

  const { handleLogin } = useBasicAuth();

  const handleSignIn = () => {
    onLoginHandler && onLoginHandler();
  };

  const getSignInButton = (): JSX.Element => {
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
          <div>
            {t('message.sso-provider-not-supported', {
              provider: authConfig?.provider,
            })}
          </div>
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
  };

  useEffect(() => {
    // If the user is already logged in or if security is disabled
    // redirect the user to the home page.
    if (isAuthenticated) {
      navigate(ROUTES.HOME);
    }
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return <Loader fullScreen />;
  }

  const handleSubmit = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) => {
    setLoading(true);
    await Promise.resolve(handleLogin(email, password));
    setLoading(false);
  };

  const onClickSignUp = () => {
    navigate(ROUTES.REGISTER);
    resetAlert();
  };

  const onClickForgotPassword = () => {
    navigate(ROUTES.FORGOT_PASSWORD);
    resetAlert();
  };

  return (
    <>
      <DocumentTitle title={t('label.sign-in')} />
      <Row className="h-full" data-testid="signin-page">
        <Col className="bg-white" span={8}>
          <div
            className={classNames('mt-24 text-center flex-center flex-col', {
              'sso-container': !isAuthProviderBasic,
            })}>
            <BrandImage height="auto" width={200} />
            <Typography.Text className="mt-8 w-80 text-xl font-medium text-grey-muted">
              {t('message.om-description')}{' '}
            </Typography.Text>
            {alert && (
              <div className="login-alert">
                <AlertBar
                  defafultExpand
                  message={alert?.message}
                  type={alert?.type}
                />
              </div>
            )}

            {isAuthProviderBasic ? (
              <div className="login-form ">
                <Form
                  className="w-full"
                  form={form}
                  layout="vertical"
                  validateMessages={VALIDATION_MESSAGES}
                  onFinish={handleSubmit}>
                  <Form.Item
                    data-testid="email"
                    label={t('label.email')}
                    name="email"
                    rules={[
                      { required: true },
                      {
                        pattern: EMAIL_REG_EX,
                        type: 'email',
                        message: t('message.field-text-is-invalid', {
                          fieldText: t('label.email'),
                        }),
                      },
                    ]}>
                    <Input autoFocus placeholder={t('label.email')} />
                  </Form.Item>
                  <Form.Item
                    data-testid="password"
                    label={t('label.password')}
                    name="password"
                    rules={[{ required: true }]}>
                    <Input.Password
                      autoComplete="off"
                      placeholder={t('label.password')}
                    />
                  </Form.Item>

                  <Button
                    className="w-full"
                    data-testid="login"
                    disabled={loading}
                    htmlType="submit"
                    loading={loading}
                    type="primary">
                    {t('label.login')}
                  </Button>
                </Form>
                {!isAuthProviderLDAP && (
                  <>
                    <div className="mt-8" onClick={onClickForgotPassword}>
                      <Typography.Link underline data-testid="forgot-password">
                        {t('label.forgot-password')}
                      </Typography.Link>
                    </div>
                    {authConfig?.enableSelfSignup && (
                      <>
                        <Divider className="w-min-0 mt-8 mb-12 justify-center">
                          <Typography.Text className="text-sm" type="secondary">
                            {t('label.or-lowercase')}
                          </Typography.Text>
                        </Divider>

                        <div className="mt-4 d-flex flex-center">
                          <Typography.Text className="mr-4">
                            {t('message.new-to-the-platform')}
                          </Typography.Text>
                          <Button
                            data-testid="signup"
                            type="link"
                            onClick={onClickSignUp}>
                            {t('label.create-entity', {
                              entity: t('label.account'),
                            })}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="">{getSignInButton()}</div>
            )}
          </div>
        </Col>
        <Col className="relative" span={16}>
          <div className="absolute inset-0">
            <img
              alt="Login Background"
              className="w-full h-full"
              data-testid="bg-image"
              src={loginBG}
            />
          </div>

          <LoginCarousel />
        </Col>
      </Row>
    </>
  );
};

export default SignInPage;
