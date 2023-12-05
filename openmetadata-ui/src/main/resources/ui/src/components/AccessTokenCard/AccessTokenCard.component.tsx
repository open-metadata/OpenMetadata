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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Card } from 'antd';
import { AxiosError } from 'axios';
import { t } from 'i18next';
import React, { FC, useEffect, useState } from 'react';
import { PersonalAccessToken } from '../../generated/auth/personalAccessToken';
import { AuthenticationMechanism } from '../../generated/entity/teams/user';
import {
  createUserAccessTokenWithPut,
  getUserAccessToken,
  revokeAccessTokenWithPut,
} from '../../rest/userAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import AuthMechanism from '../BotDetails/AuthMechanism';
import AuthMechanismForm from '../BotDetails/AuthMechanismForm';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';
import { MockProps } from './AccessTokenCard.interfaces';

const AccessTokenCard: FC<MockProps> = ({ isBot }) => {
  const [isAuthMechanismEdit, setIsAuthMechanismEdit] =
    useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [authenticationMechanism, setAuthenticationMechanism] =
    useState<PersonalAccessToken>();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const handleAuthMechanismEdit = () => setIsAuthMechanismEdit(true);

  const fetchAuthMechanismForUser = async () => {
    try {
      const response = await getUserAccessToken();
      setAuthenticationMechanism(response[0]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const handleAuthMechanismUpdate = async (data: any) => {
    setIsUpdating(true);
    try {
      const response = await createUserAccessTokenWithPut({
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
  };

  useEffect(() => {
    fetchAuthMechanismForUser();
  }, [isModalOpen]);

  const revokeTokenHandler = () => {
    revokeAccessTokenWithPut('removeAll=true')
      .then(() => setIsModalOpen(false))
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  return (
    <Card
      className="p-md m-l-md m-r-lg w-auto m-t-md"
      data-testid="center-panel">
      {authenticationMechanism ? (
        <>
          {isAuthMechanismEdit ? (
            <AuthMechanismForm
              authenticationMechanism={authenticationMechanism}
              isBot={isBot}
              isUpdating={isUpdating}
              onCancel={() => setIsAuthMechanismEdit(false)}
              onSave={handleAuthMechanismUpdate}
            />
          ) : (
            <AuthMechanism
              hasPermission
              authenticationMechanism={authenticationMechanism}
              isBot={isBot}
              onEdit={handleAuthMechanismEdit}
              onTokenRevoke={() => setIsModalOpen(true)}
            />
          )}
        </>
      ) : (
        <AuthMechanismForm
          authenticationMechanism={{} as AuthenticationMechanism}
          isBot={isBot}
          isUpdating={isUpdating}
          onCancel={() => setIsAuthMechanismEdit(false)}
          onSave={handleAuthMechanismUpdate}
        />
      )}
      <ConfirmationModal
        bodyText={t('message.are-you-sure-to-revoke-access')}
        cancelText={t('label.cancel')}
        confirmText={t('label.confirm')}
        header={t('message.are-you-sure')}
        visible={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onConfirm={() => {
          revokeTokenHandler();
          setIsModalOpen(false);
          handleAuthMechanismEdit();
        }}
      />
    </Card>
  );
};

export default AccessTokenCard;
