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
import { useAuthContext } from 'components/authentication/auth-provider/AuthProvider';
import Loader from 'components/Loader/Loader';
import Users from 'components/Users/Users.component';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import { AssetsDataType } from 'Models';
import React, { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { getUserByName, updateUserDetail } from 'rest/userAPI';
import AppState from '../../AppState';
import { PAGE_SIZE } from '../../constants/constants';
import { myDataSearchIndex } from '../../constants/Mydata.constants';
import { UserProfileTab } from '../../enums/user.enum';
import { User } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import { SearchEntityHits } from '../../utils/APIUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const UserPage = () => {
  const { t } = useTranslation();
  const { username, tab = UserProfileTab.ACTIVITY } =
    useParams<{ [key: string]: string }>();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User>({} as User);
  const [currentLoggedInUser, setCurrentLoggedInUser] = useState<User>();
  const [isError, setIsError] = useState(false);
  const [isUserEntitiesLoading, setIsUserEntitiesLoading] =
    useState<boolean>(false);

  const [followingEntities, setFollowingEntities] = useState<AssetsDataType>({
    data: [],
    total: 0,
    currPage: 1,
  });
  const [ownedEntities, setOwnedEntities] = useState<AssetsDataType>({
    data: [],
    total: 0,
    currPage: 1,
  });

  const fetchUserData = () => {
    setUserData({} as User);
    getUserByName(username, 'profile,roles,teams')
      .then((res) => {
        if (res) {
          setUserData(res);
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: 'User Details',
          })
        );
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  };

  const getQueryFilters = (fetchOwnedEntities: boolean) => {
    if (fetchOwnedEntities) {
      const teamsIds = (userData.teams ?? []).map((team) => team.id);
      const mergedIds = [
        ...teamsIds.map((id) => `owner.id:${id}`),
        `owner.id:${userData.id}`,
      ].join(' OR ');

      return `(${mergedIds})`;
    } else {
      return `followers:${userData.id}`;
    }
  };

  const fetchEntities = async (
    fetchOwnedEntities = false,
    handleEntity: Dispatch<SetStateAction<AssetsDataType>>
  ) => {
    const entity = fetchOwnedEntities ? ownedEntities : followingEntities;

    if (userData.id) {
      setIsUserEntitiesLoading(true);
      try {
        const response = await searchData(
          '',
          entity.currPage,
          PAGE_SIZE,
          getQueryFilters(fetchOwnedEntities),
          '',
          '',
          myDataSearchIndex
        );
        const hits = response.data.hits.hits as SearchEntityHits;

        if (hits?.length > 0) {
          const total = response.data.hits.total.value;
          handleEntity({
            data: hits,
            total,
            currPage: entity.currPage,
          });
        } else {
          const total = 0;
          handleEntity({
            data: [],
            total,
            currPage: entity.currPage,
          });
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: `${fetchOwnedEntities ? 'Owned' : 'Follwing'} Entities`,
          })
        );
      } finally {
        setIsUserEntitiesLoading(false);
      }
    }
  };

  const handleFollowingEntityPaginate = (page: string | number) => {
    setFollowingEntities((pre) => ({ ...pre, currPage: page as number }));
  };

  const handleOwnedEntityPaginate = (page: string | number) => {
    setOwnedEntities((pre) => ({ ...pre, currPage: page as number }));
  };

  const ErrorPlaceholder = () => {
    return (
      <div
        className="d-flex flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1"
        data-testid="error">
        <p className="tw-text-base" data-testid="error-message">
          {t('message.no-username-available')}
          <span className="tw-font-medium" data-testid="username">
            {username}
          </span>
        </p>
      </div>
    );
  };

  const updateUserDetails = async (data: Partial<User>) => {
    const updatedDetails = { ...userData, ...data };
    const jsonPatch = compare(userData, updatedDetails);

    try {
      const response = await updateUserDetail(userData.id, jsonPatch);
      if (response) {
        setUserData((prevData) => ({ ...prevData, ...response }));
      } else {
        throw t('message.unexpected-error');
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const isLoggedinUser = (userName: string) => {
    return userName === currentLoggedInUser?.name;
  };

  const getUserComponent = () => {
    if (!isError && !isEmpty(userData)) {
      return (
        <Users
          followingEntities={followingEntities}
          isAdminUser={Boolean(isAdminUser)}
          isAuthDisabled={Boolean(isAuthDisabled)}
          isLoggedinUser={isLoggedinUser(username)}
          isUserEntitiesLoading={isUserEntitiesLoading}
          ownedEntities={ownedEntities}
          updateUserDetails={updateUserDetails}
          userData={userData}
          username={username}
          onFollowingEntityPaginate={handleFollowingEntityPaginate}
          onOwnedEntityPaginate={handleOwnedEntityPaginate}
        />
      );
    } else {
      return <ErrorPlaceholder />;
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [username]);

  useEffect(() => {
    if (tab === UserProfileTab.FOLLOWING) {
      fetchEntities(false, setFollowingEntities);
    }
  }, [followingEntities.currPage, tab, userData]);

  useEffect(() => {
    if (tab === UserProfileTab.MY_DATA) {
      fetchEntities(true, setOwnedEntities);
    }
  }, [ownedEntities.currPage, tab, userData]);

  useEffect(() => {
    setCurrentLoggedInUser(AppState.getCurrentUserDetails());
  }, [AppState.nonSecureUserDetails, AppState.userDetails]);

  return <>{isLoading ? <Loader /> : getUserComponent()}</>;
};

export default observer(UserPage);
