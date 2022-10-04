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

import { AxiosError } from 'axios';
import { isEqual, isUndefined } from 'lodash';
import AppState from '../AppState';
import { OidcUser } from '../authentication/auth-provider/AuthProvider.interface';
import { searchQuery, suggestQuery } from '../axiosAPIs/searchAPI';
import { getUserById, getUserByName, getUsers } from '../axiosAPIs/userAPI';
import { SearchIndex } from '../enums/search.enum';
import { TeamType } from '../generated/entity/teams/team';
import { User } from '../generated/entity/teams/user';
import {
  TeamSearchSource,
  UserSearchSource,
} from '../interface/search.interface';
import { getImages } from './CommonUtils';

// Moving this code here from App.tsx
export const getAllUsersList = (arrQueryFields = ''): void => {
  getUsers(arrQueryFields, 1)
    .then((res) => {
      AppState.updateUsers(res.data);
    })
    .catch(() => {
      AppState.updateUsers([]);
    });
};

export const fetchAllUsers = () => {
  AppState.loadUserProfilePics();
  getAllUsersList('profile,teams,roles');
};

export const getUserDataFromOidc = (
  userData: User,
  oidcUser: OidcUser
): User => {
  const images = oidcUser.profile.picture
    ? getImages(oidcUser.profile.picture)
    : undefined;
  const profileEmail = oidcUser.profile.email;
  const email =
    profileEmail && profileEmail.indexOf('@') !== -1
      ? profileEmail
      : userData.email;

  return {
    ...userData,
    email,
    displayName: oidcUser.profile.name,
    profile: images ? { images } : userData.profile,
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

export const isCurrentUserAdmin = () => {
  return Boolean(AppState.getCurrentUserDetails()?.isAdmin);
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
      const userData = res as User;
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

export const getUserProfilePic = (
  permission: boolean,
  userId?: string,
  username?: string
) => {
  let profile;
  if (userId || username) {
    profile = AppState.getUserProfilePic(userId, username);

    if (
      isUndefined(profile) &&
      !AppState.isProfilePicLoading(userId, username) &&
      permission
    ) {
      fetchUserProfilePic(userId, username);
    }
  }

  return profile;
};

export const searchFormattedUsersAndTeams: (
  q: string,
  f: number
) => Promise<{
  users: UserSearchSource[];
  teams: TeamSearchSource[];
  teamsTotal: number;
  usersTotal: number;
}> = (query, from) =>
  Promise.all([
    searchQuery({
      query,
      searchIndex: [SearchIndex.USER],
      pageNumber: from,
    }),
    searchQuery({
      query,
      searchIndex: [SearchIndex.TEAM],
      pageNumber: from,
      queryFilter: {
        query: {
          term: { teamType: TeamType.Group },
        },
      },
    }),
  ]).then(([resUsers, resTeams]) => {
    const users = resUsers.hits.hits.map(({ _source }) => _source);
    const teams = resTeams.hits.hits.map(({ _source }) => _source);

    return {
      users,
      teams,
      usersTotal: resUsers.hits.total.value,
      teamsTotal: resTeams.hits.total.value,
    };
  });

export const suggestFormattedUsersAndTeams = (
  searchQuery: string
): Promise<{
  users: UserSearchSource[];
  teams: TeamSearchSource[];
}> =>
  suggestQuery({
    query: searchQuery,
    searchIndex: [SearchIndex.TEAM, SearchIndex.USER],
    fetchSource: true,
  }).then((res) => {
    const users = res
      .filter(({ _index }) => _index === SearchIndex.USER)
      .map(({ _source }) => _source) as UserSearchSource[];
    const teams = res
      .filter(({ _index }) => _index === SearchIndex.TEAM)
      .map(({ _source }) => _source) as TeamSearchSource[];

    return {
      users,
      teams,
    };
  });
