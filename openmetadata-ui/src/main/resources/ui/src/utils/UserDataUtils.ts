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
import { isEmpty, isEqual, isUndefined } from 'lodash';
import AppState from '../AppState';
import { OidcUser } from '../authentication/auth-provider/AuthProvider.interface';
import { getRoles } from '../axiosAPIs/rolesAPI';
import { getTeams } from '../axiosAPIs/teamsAPI';
import { getUserById, getUserByName, getUsers } from '../axiosAPIs/userAPI';
import { API_RES_MAX_SIZE } from '../constants/constants';
import { User } from '../generated/entity/teams/user';
import { getImages } from './CommonUtils';

// Moving this code here from App.tsx
const getAllUsersList = (arrQueryFields = ''): void => {
  getUsers(arrQueryFields, API_RES_MAX_SIZE)
    .then((res) => {
      AppState.updateUsers(res.data.data);
    })
    .catch(() => {
      AppState.updateUsers([]);
    });
};

const getAllTeams = (): void => {
  getTeams('defaultRoles')
    .then((res: AxiosResponse) => {
      AppState.updateUserTeam(res.data.data);
    })
    .catch(() => {
      AppState.updateUserTeam([]);
    });
};

const getAllRoles = (): void => {
  getRoles()
    .then((res: AxiosResponse) => {
      AppState.updateUserRole(res.data.data);
    })
    .catch(() => {
      AppState.updateUserRole([]);
    });
};

export const fetchAllUsers = () => {
  AppState.loadUserProfilePics();
  getAllUsersList('profile,teams,roles');
  getAllTeams();
  getAllRoles();
};

export const getUserDataFromOidc = (
  userData: User,
  oidcUser: OidcUser
): User => {
  const images = oidcUser.profile.picture
    ? getImages(oidcUser.profile.picture)
    : undefined;

  return {
    ...userData,
    displayName: oidcUser.profile.name,
    profile: !isEmpty(images) ? { images } : userData.profile,
  };
};

export const matchUserDetails = (
  userData: User,
  newUser: User,
  mapFields: Array<keyof User>
) => {
  let isMatch = true;
  for (const field of mapFields) {
    if (!isEqual(userData[field], newUser[field])) {
      isMatch = false;

      break;
    }
  }

  return isMatch;
};

export const fetchUserProfilePic = (userId?: string, username?: string) => {
  let promise;

  if (userId) {
    promise = getUserById(userId, 'profile');
  } else if (username) {
    promise = getUserByName(username, 'profile');
  } else {
    return;
  }

  AppState.updateProfilePicsLoading(userId, username);

  promise
    .then((res) => {
      const userData = res.data as User;
      const profile = userData.profile?.images?.image512 || '';

      AppState.updateUserProfilePic(userData.id, userData.name, profile);
    })
    .catch((err: AxiosError) => {
      // ignore exception
      AppState.updateUserProfilePic(
        userId,
        username,
        err.response?.status === 404 ? '' : undefined
      );
    })
    .finally(() => {
      AppState.removeProfilePicsLoading(userId, username);
    });
};

export const getUserProfilePic = (userId?: string, username?: string) => {
  if (userId || username) {
    const profile = AppState.getUserProfilePic(userId, username);

    if (!isUndefined(profile)) {
      return profile;
    } else {
      if (!AppState.isProfilePicLoading(userId, username)) {
        fetchUserProfilePic(userId, username);
      }
    }
  }

  return;
};
