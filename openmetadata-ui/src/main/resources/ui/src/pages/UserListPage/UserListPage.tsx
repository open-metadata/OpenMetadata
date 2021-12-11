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
import { Operation } from 'fast-json-patch';
import { observer } from 'mobx-react';
import React, { useEffect, useState } from 'react';
import AppState from '../../AppState';
import { getTeams } from '../../axiosAPIs/teamsAPI';
import { updateUserDetail } from '../../axiosAPIs/userAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import UserList from '../../components/UserList/UserList';
import { Team } from '../../generated/entity/teams/team';
import { User } from '../../generated/entity/teams/user';
import useToastContext from '../../hooks/useToastContext';

const UserListPage = () => {
  const showToast = useToastContext();

  const [teams, setTeams] = useState<Array<Team>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allUsers, setAllUsers] = useState<Array<User>>([]);

  const fetchTeams = () => {
    setIsLoading(true);
    getTeams(['users'])
      .then((res: AxiosResponse) => {
        setTeams(res.data.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'No teams available!',
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const updateUser = (id: string, data: Operation[], updatedUser: User) => {
    setIsLoading(true);
    updateUserDetail(id, data)
      .then(() => {
        setAllUsers(
          allUsers.map((user) => {
            if (user.id === id) {
              return updatedUser;
            }

            return user;
          })
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    setAllUsers(AppState.users);
  }, [AppState.users]);

  useEffect(() => {
    fetchTeams();
  }, []);

  return (
    <PageContainerV1>
      <UserList
        allUsers={allUsers}
        isLoading={isLoading}
        teams={teams}
        updateUser={updateUser}
      />
    </PageContainerV1>
  );
};

export default observer(UserListPage);
