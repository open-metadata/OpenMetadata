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

import { Button, Card, Form, FormProps, Input, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { CookieStorage } from 'cookie-storage';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../../components/Auth/AuthProviders/AuthProvider.interface';
import TeamsSelectable from '../../components/Settings/Team/TeamsSelectable/TeamsSelectable';
import {
  REDIRECT_PATHNAME,
  ROUTES,
  VALIDATION_MESSAGES,
} from '../../constants/constants';
import { ClientType } from '../../generated/configuration/authenticationConfiguration';
import { EntityReference } from '../../generated/entity/type';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { createUser } from '../../rest/userAPI';
import {
  getNameFromUserData,
  setUrlPathnameExpiryAfterRoute,
} from '../../utils/AuthProvider.util';
import brandClassBase from '../../utils/BrandData/BrandClassBase';
import { getImages, Transi18next } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const cookieStorage = new CookieStorage();

const SignUp = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    setIsSigningUp,
    jwtPrincipalClaims = [],
    jwtPrincipalClaimsMapping = [],
    authorizerConfig,
    updateCurrentUser,
    newUser,
    authConfig,
  } = useApplicationStore();

  const [loading, setLoading] = useState<boolean>(false);
  const OMDLogo = useMemo(() => brandClassBase.getMonogram().svg, []);

  const handleCreateNewUser: FormProps['onFinish'] = async (data) => {
    setLoading(true);

    try {
      const res = await createUser({
        ...data,
        teams: (data.teams as EntityReference[])?.map((t) => t.id),
        profile: {
          images: getImages(data.picture ?? ''),
        },
      });
      updateCurrentUser(res);
      const urlPathname = cookieStorage.getItem(REDIRECT_PATHNAME);
      if (urlPathname) {
        setUrlPathnameExpiryAfterRoute(urlPathname);
      }
      setIsSigningUp(false);
      navigate(ROUTES.HOME);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.create-entity-error', {
          entity: t('label.user'),
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const clientType = authConfig?.clientType ?? ClientType.Public;

  const initialValues = useMemo(
    () => ({
      displayName: newUser?.name ?? '',
      ...(clientType === ClientType.Public
        ? getNameFromUserData(
            newUser as UserProfile,
            jwtPrincipalClaims,
            authorizerConfig?.principalDomain,
            jwtPrincipalClaimsMapping
          )
        : {
            name: newUser?.name ?? '',
            email: newUser?.email ?? '',
          }),
    }),
    [
      clientType,
      authorizerConfig?.principalDomain,
      jwtPrincipalClaims,
      jwtPrincipalClaimsMapping,
      newUser,
    ]
  );

  return (
    <div className="flex-center w-full h-full">
      <Card className="p-x-md p-y-md w-500">
        <Space
          align="center"
          className="w-full m-b-lg"
          direction="vertical"
          size="middle">
          <OMDLogo
            data-testid="om-logo"
            height={50}
            name={t('label.open-metadata-logo')}
            width={50}
          />
          <Typography.Title
            className="text-center"
            data-testid="om-heading"
            level={3}>
            <Transi18next
              i18nKey="label.join-entity"
              renderElement={<span className="text-primary" />}
              values={{
                entity: t('label.open-metadata'),
              }}
            />
          </Typography.Title>
        </Space>

        <Form
          data-testid="create-user-form"
          initialValues={initialValues}
          layout="vertical"
          validateMessages={VALIDATION_MESSAGES}
          onFinish={handleCreateNewUser}>
          <Form.Item
            data-testid="full-name-label"
            label={t('label.full-name')}
            name="displayName"
            rules={[
              {
                required: true,
              },
            ]}>
            <Input
              autoFocus
              data-testid="full-name-input"
              placeholder={t('label.your-entity', {
                entity: t('label.full-name'),
              })}
            />
          </Form.Item>

          <Form.Item
            hidden
            data-testid="username-label"
            label={t('label.username')}
            name="name"
            rules={[
              {
                required: true,
              },
            ]}>
            <Input
              disabled
              data-testid="username-input"
              placeholder={t('label.username')}
            />
          </Form.Item>

          <Form.Item
            data-testid="email-label"
            label={t('label.email')}
            name="email"
            rules={[
              {
                required: true,
              },
            ]}>
            <Input
              disabled
              data-testid="email-input"
              placeholder={t('label.your-entity', {
                entity: `${t('label.email')} ${t('label.address')}`,
              })}
              type="email"
            />
          </Form.Item>

          <Form.Item
            data-testid="select-team-label"
            label={t('label.select-field', {
              field: t('label.team-plural-lowercase'),
            })}
            name="teams"
            trigger="onSelectionChange">
            <TeamsSelectable filterJoinable showTeamsAlert />
          </Form.Item>

          <Space align="center" className="w-full justify-end d-flex">
            <Button
              data-testid="create-button"
              htmlType="submit"
              loading={loading}
              type="primary">
              {t('label.create')}
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default SignUp;
