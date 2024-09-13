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
import { compare } from 'fast-json-patch';
import { isEqual } from 'lodash';
import { OidcUser } from '../components/Auth/AuthProviders/AuthProvider.interface';
import { WILD_CARD_CHAR } from '../constants/char.constants';
import { SettledStatus } from '../enums/Axios.enum';
import { SearchIndex } from '../enums/search.enum';
import { SearchResponse } from '../interface/search.interface';
import { getSearchedTeams, getSearchedUsers } from '../rest/miscAPI';
import { updateUserDetail } from '../rest/userAPI';
import { User } from './../generated/entity/teams/user';
import { formatTeamsResponse, formatUsersResponse } from './APIUtils';
import { getImages } from './CommonUtils';
import i18n from './i18next/LocalUtil';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from './ProfilerUtils';
import { showErrorToast } from './ToastUtils';
import userClassBase from './UserClassBase';

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
    profile: images ? { ...userData.profile, images } : undefined,
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

export const searchFormattedUsersAndTeams = async (
  searchQuery = WILD_CARD_CHAR,
  from = 1
) => {
  try {
    const promises = [
      getSearchedUsers(searchQuery, from),
      getSearchedTeams(searchQuery, from, 'teamType:Group'),
    ];

    const [resUsers, resTeams] = await Promise.allSettled(promises);

    const users =
      resUsers.status === SettledStatus.FULFILLED
        ? formatUsersResponse(
            (resUsers.value.data as SearchResponse<SearchIndex.USER>).hits.hits
          )
        : [];
    const teams =
      resTeams.status === SettledStatus.FULFILLED
        ? formatTeamsResponse(
            (resTeams.value.data as SearchResponse<SearchIndex.TEAM>).hits.hits
          )
        : [];
    const usersTotal =
      resUsers.status === SettledStatus.FULFILLED
        ? resUsers.value.data.hits.total.value
        : 0;
    const teamsTotal =
      resTeams.status === SettledStatus.FULFILLED
        ? resTeams.value.data.hits.total.value
        : 0;

    return { users, teams, usersTotal, teamsTotal };
  } catch (error) {
    return { users: [], teams: [], usersTotal: 0, teamsTotal: 0 };
  }
};

export const getUserWithImage = (user: User) => {
  const profile =
    getImageWithResolutionAndFallback(
      ImageQuality['6x'],
      user.profile?.images
    ) ?? '';

  if (!profile && user.isBot) {
    user = {
      ...user,
      profile: {
        images: {
          image: userClassBase.getBotLogo(user.name) ?? '',
        },
      },
    };
  }

  return user;
};

export const checkIfUpdateRequired = async (
  existingUserDetails: User,
  newUser: OidcUser
): Promise<User> => {
  const updatedUserData = getUserDataFromOidc(existingUserDetails, newUser);

  if (existingUserDetails.email !== updatedUserData.email) {
    return existingUserDetails;
  } else if (
    existingUserDetails.email === updatedUserData.email &&
    // We only want to update images / profile info not any other information
    updatedUserData.profile?.images &&
    !matchUserDetails(existingUserDetails, updatedUserData, ['profile'])
  ) {
    const finalData = {
      ...existingUserDetails,
      //   We want to override any profile information that is coming from the OIDC provider
      profile: {
        ...existingUserDetails.profile,
        profile: { ...existingUserDetails.profile, ...updatedUserData.profile },
      },
    };
    const jsonPatch = compare(existingUserDetails, finalData);

    try {
      const res = await updateUserDetail(existingUserDetails.id, jsonPatch);

      return res;
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        i18n.t('server.entity-updating-error', {
          entity: i18n.t('label.admin-profile'),
        })
      );
    }
  }

  return existingUserDetails;
};
