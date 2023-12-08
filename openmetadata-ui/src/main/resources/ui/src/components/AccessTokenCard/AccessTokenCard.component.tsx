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

import { Card } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { t } from 'i18next';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  PersonalAccessToken,
  TokenType,
} from '../../generated/auth/personalAccessToken';
import {
  AuthenticationMechanism,
  AuthType,
} from '../../generated/entity/teams/user';
import { createBotWithPut } from '../../rest/botsAPI';
import {
  createUserWithPut,
  getAuthMechanismForBotUser,
  getUserAccessToken,
  revokeAccessToken,
  updateUserAccessToken,
} from '../../rest/userAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import AuthMechanism from '../BotDetails/AuthMechanism';
import AuthMechanismForm from '../BotDetails/AuthMechanismForm';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { MockProps } from './AccessTokenCard.interfaces';

const AccessTokenCard: FC<MockProps> = ({
  isBot,
  botData,
  botUserData,
  revokeTokenHandlerBot,
}: MockProps) => {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isAuthMechanismEdit, setIsAuthMechanismEdit] =
    useState<boolean>(false);
  const [authenticationMechanism, setAuthenticationMechanism] =
    useState<PersonalAccessToken>({
      tokenType: TokenType.PersonalAccessToken,
    } as PersonalAccessToken);
  const [authenticationMechanismBot, setAuthenticationMechanismBot] =
    useState<AuthenticationMechanism>({
      authType: AuthType.Jwt,
    } as AuthenticationMechanism);

  const handleAuthMechanismEdit = () => setIsAuthMechanismEdit(true);

  const fetchAuthMechanismForUser = async () => {
    try {
      const response = await getUserAccessToken();
      if (response.length) {
        setAuthenticationMechanism(response[0]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchAuthMechanismForBot = async () => {
    try {
      setIsLoading(true);
      if (botUserData) {
        const response = await getAuthMechanismForBotUser(botUserData.id);
        setAuthenticationMechanismBot(response);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthMechanismUpdateForBot = async (
    updatedAuthMechanism: AuthenticationMechanism
  ) => {
    setIsUpdating(true);
    if (botUserData && botData) {
      try {
        const {
          isAdmin,
          timezone,
          name,
          description,
          displayName,
          profile,
          email,
          isBot,
        } = botUserData;

        const response = await createUserWithPut({
          isAdmin,
          timezone,
          name,
          description,
          displayName,
          profile,
          email,
          isBot,
          authenticationMechanism: {
            ...botUserData.authenticationMechanism,
            authType: updatedAuthMechanism.authType,
            config:
              updatedAuthMechanism.authType === AuthType.Jwt
                ? {
                    JWTTokenExpiry: updatedAuthMechanism.config?.JWTTokenExpiry,
                  }
                : {
                    ssoServiceType: updatedAuthMechanism.config?.ssoServiceType,
                    authConfig: updatedAuthMechanism.config?.authConfig,
                  },
          },
          botName: botData.name,
        });

        if (response) {
          if (botData) {
            await createBotWithPut({
              name: botData.name,
              description: botData.description,
              displayName: botData.displayName,
              botUser: response.name,
            });
            fetchAuthMechanismForBot();
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsUpdating(false);
        setIsAuthMechanismEdit(false);
      }
    }
  };

  const handleAuthMechanismUpdate = async (data: AuthenticationMechanism) => {
    if (data.config) {
      setIsUpdating(true);
      try {
        const response = await updateUserAccessToken({
          JWTTokenExpiry: data.config.JWTTokenExpiry,
          tokenName: 'test',
        });
        if (response) {
          setAuthenticationMechanism(response[0]);
          fetchAuthMechanismForUser();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsUpdating(false);
        setIsAuthMechanismEdit(false);
      }
    }
  };

  const revokeTokenHandler = () => {
    revokeAccessToken('removeAll=true')
      .then(() => setIsModalOpen(false))
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  useEffect(() => {
    fetchAuthMechanismForUser();
  }, [isModalOpen]);

  useEffect(() => {
    if (botUserData && botUserData.id) {
      fetchAuthMechanismForBot();
    }
  }, [botUserData]);

  const authenticationMechanismData = useMemo(() => {
    return isBot ? authenticationMechanismBot : authenticationMechanism;
  }, [isBot, authenticationMechanismBot, authenticationMechanism]);

  const onSave = useMemo(() => {
    return isBot ? handleAuthMechanismUpdateForBot : handleAuthMechanismUpdate;
  }, [isBot, handleAuthMechanismUpdateForBot, handleAuthMechanismUpdateForBot]);

  const tokenRevoke = useCallback(() => {
    return isBot ? revokeTokenHandlerBot?.() : revokeTokenHandler();
  }, [isBot, revokeTokenHandlerBot, revokeTokenHandler]);

  return isLoading ? (
    <Loader />
  ) : (
    <Card
      className={classNames(
        'm-t-md',
        isBot ? 'page-layout-v1-left-panel mt-2 ' : 'p-md m-l-md m-r-lg w-auto'
      )}
      data-testid="center-panel">
      <>
        {isAuthMechanismEdit ? (
          <AuthMechanismForm
            authenticationMechanism={authenticationMechanismData}
            isBot={isBot}
            isUpdating={isUpdating}
            onCancel={() => setIsAuthMechanismEdit(false)}
            onSave={onSave}
          />
        ) : (
          <AuthMechanism
            hasPermission
            authenticationMechanism={authenticationMechanismData}
            isBot={isBot}
            onEdit={handleAuthMechanismEdit}
            onTokenRevoke={() => setIsModalOpen(true)}
          />
        )}
      </>
      <ConfirmationModal
        bodyText={t('message.are-you-sure-to-revoke-access')}
        cancelText={t('label.cancel')}
        confirmText={t('label.confirm')}
        header={t('message.are-you-sure')}
        visible={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onConfirm={() => {
          tokenRevoke();
          handleAuthMechanismEdit();
          setIsModalOpen(false);
        }}
      />
    </Card>
  );
};

export default AccessTokenCard;
