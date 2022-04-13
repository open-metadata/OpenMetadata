/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getUserByName } from '../../axiosAPIs/userAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import Loader from '../../components/Loader/Loader';
import Users from '../../components/Users/Users.component';
import { User } from '../../generated/entity/teams/user';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const UserPage = () => {
  const { username } = useParams<{ [key: string]: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<User>({} as User);
  const [isError, setIsError] = useState(false);

  const fetchUserData = () => {
    getUserByName(username, 'profile,roles,teams,follows,owns')
      .then((res: AxiosResponse) => {
        if (res.data) {
          setUserData(res.data);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-user-details-error']
        );
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  };

  const ErrorPlaceholder = () => {
    return (
      <div
        className="tw-flex tw-flex-col tw-items-center tw-place-content-center tw-mt-40 tw-gap-1"
        data-testid="error">
        <p className="tw-text-base" data-testid="error-message">
          No user available with{' '}
          <span className="tw-font-medium" data-testid="username">
            {username}
          </span>{' '}
          username.
        </p>
      </div>
    );
  };

  useEffect(() => {
    fetchUserData();
  }, [username]);

  return (
    <PageContainerV1 className="tw-pt-4">
      {isLoading ? (
        <Loader />
      ) : !isError ? (
        <Users userData={userData} />
      ) : (
        <ErrorPlaceholder />
      )}
    </PageContainerV1>
  );
};

export default UserPage;
