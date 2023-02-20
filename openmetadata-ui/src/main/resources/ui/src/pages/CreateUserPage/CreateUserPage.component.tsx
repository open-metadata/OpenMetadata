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

import { AxiosError } from 'axios';
import PageContainerV1 from 'components/containers/PageContainerV1';
import CreateUserComponent from 'components/CreateUser/CreateUser.component';
import _ from 'lodash';
import { observer } from 'mobx-react';
import { LoadingState } from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { createBotWithPut } from 'rest/botsAPI';
import { getRoles } from 'rest/rolesAPIV1';
import { createUser, createUserWithPut, getBotByName } from 'rest/userAPI';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { CreateUser } from '../../generated/api/teams/createUser';
import { Role } from '../../generated/entity/teams/role';
import jsonData from '../../jsons/en';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const CreateUserPage = () => {
  const history = useHistory();

  const [roles, setRoles] = useState<Array<Role>>([]);
  const [status, setStatus] = useState<LoadingState>('initial');

  const { bot } = useParams<{ bot: string }>();

  const goToUserListPage = () => {
    if (bot) {
      history.push(
        getSettingPath(
          GlobalSettingsMenuCategory.INTEGRATIONS,
          GlobalSettingOptions.BOTS
        )
      );
    } else {
      history.goBack();
    }
  };

  const handleCancel = () => {
    goToUserListPage();
  };

  /**
   * Handles error if any, while creating new user.
   * @param error AxiosError or error message
   * @param fallbackText fallback error message
   */
  const handleSaveFailure = (
    error: AxiosError | string,
    fallbackText?: string
  ) => {
    showErrorToast(error, fallbackText);
    setStatus('initial');
  };

  const checkBotInUse = async (name: string) => {
    try {
      const response = await getBotByName(name);

      return Boolean(response);
    } catch (_error) {
      return false;
    }
  };

  /**
   * Submit handler for new user form.
   * @param userData Data for creating new user
   */
  const handleAddUserSave = async (userData: CreateUser) => {
    if (bot) {
      const isBotExists = await checkBotInUse(userData.name);
      if (isBotExists) {
        showErrorToast(`${userData.name} bot already exists.`);
      } else {
        try {
          setStatus('waiting');
          // Create a user with isBot:true
          const userResponse = await createUserWithPut({
            ...userData,
            botName: userData.name,
          });

          // Create a bot entity with botUser data
          const botResponse = await createBotWithPut({
            botUser: _.toString(userResponse.fullyQualifiedName),
            name: userResponse.name,
            displayName: userResponse.displayName,
            description: userResponse.description,
          });

          if (botResponse) {
            setStatus('success');
            showSuccessToast(`Bot created successfully`);
            setTimeout(() => {
              setStatus('initial');

              goToUserListPage();
            }, 500);
          } else {
            handleSaveFailure(
              jsonData['api-error-messages']['create-bot-error']
            );
          }
        } catch (error) {
          handleSaveFailure(
            error as AxiosError,
            jsonData['api-error-messages']['create-bot-error']
          );
        }
      }
    } else {
      try {
        setStatus('waiting');

        const response = await createUser(userData);

        if (response) {
          setStatus('success');
          setTimeout(() => {
            setStatus('initial');
            goToUserListPage();
          }, 500);
        } else {
          handleSaveFailure(
            jsonData['api-error-messages']['create-user-error']
          );
        }
      } catch (error) {
        handleSaveFailure(
          error as AxiosError,
          jsonData['api-error-messages']['create-user-error']
        );
      }
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await getRoles(
        '',
        undefined,
        undefined,
        false,
        PAGE_SIZE_LARGE
      );
      setRoles(response.data);
    } catch (err) {
      setRoles([]);
      showErrorToast(
        err as AxiosError,
        jsonData['api-error-messages']['fetch-roles-error']
      );
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  return (
    <PageContainerV1>
      <div className="self-center">
        <CreateUserComponent
          forceBot={Boolean(bot)}
          roles={roles}
          saveState={status}
          onCancel={handleCancel}
          onSave={handleAddUserSave}
        />
      </div>
    </PageContainerV1>
  );
};

export default observer(CreateUserPage);
