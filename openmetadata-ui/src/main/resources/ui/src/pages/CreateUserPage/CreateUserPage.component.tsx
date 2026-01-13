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

import { Card } from 'antd';
import { AxiosError } from 'axios';
import _ from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import CreateUserComponent from '../../components/Settings/Users/CreateUser/CreateUser.component';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { CreateUser } from '../../generated/api/teams/createUser';
import { Role } from '../../generated/entity/teams/role';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { createBot } from '../../rest/botsAPI';
import { getRoles } from '../../rest/rolesAPIV1';
import {
  createUser,
  createUserWithPut,
  getBotByName,
} from '../../rest/userAPI';
import {
  getBotsPagePath,
  getSettingPath,
  getUsersPagePath,
} from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { getUserCreationErrorMessage } from '../../utils/Users.util';

const CreateUserPage = () => {
  const {
    state,
  }: {
    state?: { isAdminPage: boolean };
  } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isAdminPage = Boolean(state?.isAdminPage);
  const { setInlineAlertDetails } = useApplicationStore();
  const { getResourceLimit } = useLimitStore();
  const [roles, setRoles] = useState<Array<Role>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { bot } = useRequiredParams<{ bot: string }>();

  const goToUserListPage = () => {
    if (bot) {
      navigate(getSettingPath(GlobalSettingOptions.BOTS));
    } else {
      navigate(-1);
    }
  };

  const handleCancel = () => {
    goToUserListPage();
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
    setIsLoading(true);
    if (bot) {
      const isBotExists = await checkBotInUse(userData.name);
      if (isBotExists) {
        showErrorToast(
          t('server.email-already-exist', {
            entity: t('label.bot-lowercase'),
            name: userData.name,
          })
        );
      } else {
        try {
          // Create a user with isBot:true
          const userResponse = await createUserWithPut({
            ...userData,
            botName: userData.name,
          });

          // Create a bot entity with botUser data
          await createBot({
            botUser: _.toString(userResponse.fullyQualifiedName),
            name: userResponse.name,
            displayName: userResponse.displayName,
            description: userResponse.description,
          });

          // Update current count when Create / Delete operation performed
          await getResourceLimit('bot', true, true);
          showSuccessToast(
            t('server.create-entity-success', { entity: t('label.bot') })
          );
          goToUserListPage();
        } catch (error) {
          setInlineAlertDetails({
            type: 'error',
            heading: t('label.error'),
            description: getUserCreationErrorMessage({
              error: error as AxiosError,
              entity: t('label.bot'),
              entityLowercase: t('label.bot-lowercase'),
              entityName: userData.name,
            }),
            onClose: () => setInlineAlertDetails(undefined),
          });
        }
      }
    } else {
      try {
        await createUser(userData);
        // Update current count when Create / Delete operation performed
        await getResourceLimit('user', true, true);
        goToUserListPage();
      } catch (error) {
        setInlineAlertDetails({
          type: 'error',
          heading: t('label.error'),
          description: getUserCreationErrorMessage({
            error: error as AxiosError,
            entity: t('label.user'),
            entityLowercase: t('label.user-lowercase'),
            entityName: userData.name,
          }),
          onClose: () => setInlineAlertDetails(undefined),
        });
      }
    }
    setIsLoading(false);
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
        t('server.entity-fetch-error', { entity: t('label.role-plural') })
      );
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const BREADCRUMB_DETAILS = useMemo(() => {
    if (bot) {
      return {
        name: t('label.bot'),
        namePlural: t('label.bot-plural'),
        url: getBotsPagePath(),
      };
    } else if (isAdminPage) {
      return {
        namePlural: t('label.admin-plural'),
        name: t('label.admin'),
        url: getUsersPagePath(true),
      };
    } else {
      return {
        name: t('label.user'),
        namePlural: t('label.user-plural'),
        url: getUsersPagePath(),
      };
    }
  }, [bot, isAdminPage]);

  const slashedBreadcrumbList = useMemo(
    () => [
      {
        name: BREADCRUMB_DETAILS.namePlural,
        url: BREADCRUMB_DETAILS.url,
      },
      {
        name: `${t('label.create')} ${BREADCRUMB_DETAILS.name}`,
        url: '',
        activeTitle: true,
      },
    ],
    [BREADCRUMB_DETAILS]
  );

  return (
    <PageLayoutV1
      center
      pageTitle={t('label.create-entity', { entity: t('label.user') })}>
      <Card className="m-x-auto w-800">
        <TitleBreadcrumb titleLinks={slashedBreadcrumbList} />
        <div className="m-t-md">
          <CreateUserComponent
            forceBot={Boolean(bot)}
            isLoading={isLoading}
            roles={roles}
            onCancel={handleCancel}
            onSave={handleAddUserSave}
          />
        </div>
      </Card>
    </PageLayoutV1>
  );
};

export default CreateUserPage;
