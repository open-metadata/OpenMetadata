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

import { AxiosResponse } from 'axios';
import AppState from '../AppState';
import { getTeams } from '../axiosAPIs/teamsAPI';
import { getUsers } from '../axiosAPIs/userAPI';
import { API_RES_MAX_SIZE } from '../constants/constants';

// Moving this code here from App.tsx
const getAllUsersList = (arrQueryFields = ''): void => {
  getUsers(arrQueryFields, API_RES_MAX_SIZE).then((res) => {
    AppState.users = res.data.data;
  });
};

const getAllTeams = (): void => {
  getTeams().then((res: AxiosResponse) => {
    AppState.userTeams = res.data.data;
  });
};

export const fetchAllUsers = () => {
  getAllUsersList('profile,teams,roles');
  getAllTeams();
  // TODO: uncomment below line to update users list in real time.
  // setInterval(getAllUsersList, TIMEOUT.USER_LIST);
};
