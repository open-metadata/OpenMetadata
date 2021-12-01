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

import appState from '../AppState';
import { getUserDetails, getUsers } from '../axiosAPIs/userAPI';

const fetchUserDetails = async (userId) => {
  const promiseArr = [];
  if (userId) {
    promiseArr.push(getUserDetails(userId));
  } else {
    if (appState.users.users?.length) {
      appState.users.map((user) => {
        user.instance?.id && promiseArr.push(getUserDetails(user.instance.id));

        return user;
      });
    } else {
      await getUsers().then((res) => {
        appState.users = res.data.data;
        appState.users.map((user) => {
          user.instance?.id &&
            promiseArr.push(getUserDetails(user.instance.id));

          return user;
        });
      });
    }
  }

  return Promise.all(promiseArr).then((results) => {
    const userList = [];
    results.map((result) => {
      const userDetails = { role: [], team: [] };
      userDetails.name = result.data.displayName;
      userDetails.timezone = result.data.timezone;
      userDetails.id = result.data.instance?.id;
      result.data.roles.map((role) => {
        userDetails.role.push({ name: role.name, id: role.id });

        return role.name;
      });
      result.data.teams.map((team) => {
        userDetails.team.push({ name: team.name, id: team.id });

        return team.name;
      });
      userList.push(userDetails);

      return userDetails;
    });

    return userList;
  });
};

export default fetchUserDetails;
