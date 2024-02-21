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

import { Typography } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import BotDetails from '../../components/Settings/Bot/BotDetails/BotDetails.component';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { Bot } from '../../generated/entity/bot';
import { User } from '../../generated/entity/teams/user';
import { Include } from '../../generated/type/include';
import { useAuth } from '../../hooks/authHooks';
import { useFqn } from '../../hooks/useFqn';
import {
  getBotByName,
  getUserByName,
  revokeUserToken,
  updateBotDetail,
  updateUserDetail,
} from '../../rest/userAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const BotDetailsPage = () => {
  const { t } = useTranslation();
  const { fqn: botsName } = useFqn();
  const { isAdminUser } = useAuth();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [botUserData, setBotUserData] = useState<User>({} as User);
  const [botData, setBotData] = useState<Bot>({} as Bot);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [botPermission, setBotPermission] = useState<OperationPermission>(
    DEFAULT_ENTITY_PERMISSION
  );

  const fetchBotPermission = async (entityFqn: string) => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        ResourceEntity.BOT,
        entityFqn
      );
      setBotPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBotsData = async () => {
    try {
      setIsLoading(true);
      const botResponse = await getBotByName(botsName, {
        include: Include.All,
      });

      const botUserResponse = await getUserByName(
        botResponse.botUser.fullyQualifiedName || '',
        { fields: 'roles,profile', include: Include.All }
      );
      setBotUserData(botUserResponse);
      setBotData(botResponse);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBotsDetails = async (data: Partial<User>) => {
    const updatedDetails = { ...botData, ...data };
    const jsonPatch = compare(botData, updatedDetails);

    try {
      const response = await updateBotDetail(botData.id, jsonPatch);
      if (response) {
        setBotData((prevData) => ({
          ...prevData,
          ...response,
        }));
      } else {
        throw t('message.unexpected-error');
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const updateUserDetails = async (data: Partial<User>) => {
    const updatedDetails = { ...botUserData, ...data };
    const jsonPatch = compare(botUserData, updatedDetails);

    try {
      const response = await updateUserDetail(botUserData.id, jsonPatch);
      if (response) {
        setBotUserData((prevData) => ({ ...prevData, ...response }));
      } else {
        throw t('message.unexpected-error');
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const revokeBotsToken = async () => {
    try {
      const response = await revokeUserToken(botUserData.id);
      setBotUserData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (botPermission.ViewAll || botPermission.ViewBasic) {
      fetchBotsData();
    }
  }, [botPermission, botsName]);

  useEffect(() => {
    fetchBotPermission(botsName);
  }, [botsName]);

  if (isLoading) {
    return <Loader />;
  }

  if (isError) {
    return (
      <ErrorPlaceHolder>
        <Typography.Paragraph className="text-base" data-testid="error-message">
          {t('message.no-entity-available-with-name', {
            entity: t('label.bot-plural'),
          })}{' '}
          <span className="font-medium" data-testid="username">
            {botsName}
          </span>{' '}
        </Typography.Paragraph>
      </ErrorPlaceHolder>
    );
  }

  if (!isAdminUser) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <BotDetails
      botData={botData}
      botPermission={botPermission}
      botUserData={botUserData}
      revokeTokenHandler={revokeBotsToken}
      updateBotsDetails={updateBotsDetails}
      updateUserDetails={updateUserDetails}
    />
  );
};

export default BotDetailsPage;
