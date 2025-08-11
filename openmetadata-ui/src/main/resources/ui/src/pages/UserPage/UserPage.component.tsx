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
import { isEmpty, isUndefined, omitBy } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import Users from '../../components/Settings/Users/Users.component';
import { ROUTES } from '../../constants/constants';
import { TabSpecificField } from '../../enums/entity.enum';
import { User } from '../../generated/entity/teams/user';
import { Include } from '../../generated/type/include';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { getUserByName, updateUserDetail } from '../../rest/userAPI';
import { Transi18next } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const UserPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { fqn: username } = useFqn();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User>({} as User);
  const [isError, setIsError] = useState(false);
  const { currentUser, updateCurrentUser } = useApplicationStore();

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const res = await getUserByName(username, {
        fields: [
          TabSpecificField.PROFILE,
          TabSpecificField.ROLES,
          TabSpecificField.TEAMS,
          TabSpecificField.PERSONAS,
          TabSpecificField.LAST_ACTIVITY_TIME,
          TabSpecificField.LAST_LOGIN_TIME,
          TabSpecificField.DEFAULT_PERSONA,
          TabSpecificField.DOMAINS,
        ],
        include: Include.All,
      });
      setUserData(res);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.entity-detail-plural', {
            entity: t('label.user'),
          }),
        })
      );
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const myDataQueryFilter = useMemo(() => {
    const teamsIds = (userData.teams ?? []).map((team) => team.id);
    const mergedIds = [
      ...teamsIds.map((id) => `owners.id:${id}`),
      `owners.id:${userData.id}`,
    ].join(' OR ');

    return `(${mergedIds})`;
  }, [userData]);

  const followingQueryFilter = useMemo(
    () => `followers:${userData.id}`,
    [userData.id]
  );

  const handleEntityPaginate = (page: string | number) => {
    navigate({
      search: Qs.stringify({ page }),
    });
  };

  const errorPlaceholder = useMemo(
    () => (
      <div
        className="d-flex items-center justify-center h-full"
        data-testid="error">
        <Typography.Paragraph className="text-base" data-testid="error-message">
          <Transi18next
            i18nKey="message.no-username-available"
            renderElement={<strong data-testid="username" />}
            values={{
              user: username,
            }}
          />
        </Typography.Paragraph>
      </div>
    ),
    [username]
  );

  const updateUserDetails = useCallback(
    async (data: Partial<User>, key: keyof User) => {
      const updatedDetails = { ...userData, ...data };
      const jsonPatch = compare(userData, updatedDetails);

      try {
        const response = await updateUserDetail(userData.id, jsonPatch);
        if (response) {
          let updatedKeyData;

          if (key === 'roles') {
            updatedKeyData = {
              roles: response.roles,
              isAdmin: response.isAdmin,
            };
          } else if (key === 'teams') {
            // Handle teams update - this affects inherited domains
            updatedKeyData = {
              [key]: response[key],
              // Also update domains since they are inherited from teams
              domains: response.domains,
            };
          } else {
            updatedKeyData = { [key]: response[key] };
          }
          const newCurrentUserData = {
            ...currentUser,
            ...updatedKeyData,
          };
          const newUserData: User = { ...userData, ...updatedKeyData };

          if (key === 'defaultPersona') {
            if (isUndefined(response.defaultPersona)) {
              // remove key from object if value is undefined
              delete newCurrentUserData[key];
              delete newUserData[key];
            }
          }
          if (userData.id === currentUser?.id) {
            updateCurrentUser(newCurrentUserData as User);
          }
          // Omit the undefined values from the User object
          setUserData(omitBy(newUserData, isUndefined) as User);
        } else {
          throw t('message.unexpected-error');
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [userData, currentUser, updateCurrentUser]
  );

  const handleToggleDelete = useCallback(() => {
    setUserData((prev) => ({
      ...prev,
      deleted: !prev?.deleted,
    }));
  }, [setUserData]);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) =>
      isSoftDelete ? handleToggleDelete() : navigate(ROUTES.HOME),
    [handleToggleDelete, navigate]
  );

  useEffect(() => {
    fetchUserData();
  }, [username]);

  if (isLoading) {
    return <Loader />;
  }

  if (isError && isEmpty(userData)) {
    return errorPlaceholder;
  }

  if (userData?.name !== username) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.user')}>
      <Users
        afterDeleteAction={afterDeleteAction}
        handlePaginate={handleEntityPaginate}
        queryFilters={{
          myData: myDataQueryFilter,
          following: followingQueryFilter,
        }}
        updateUserDetails={updateUserDetails}
        userData={userData}
      />
    </PageLayoutV1>
  );
};

export default UserPage;
