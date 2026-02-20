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
import { get, isEqual } from 'lodash';
import { OidcUser } from '../components/Auth/AuthProviders/AuthProvider.interface';
import { updateUserDetail } from '../rest/userAPI';
import { User } from './../generated/entity/teams/user';
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
    // newly added DisplayName field in OIDC profile
    displayName: get(oidcUser, 'profile.displayName', oidcUser.profile.name),
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

  const emailChanged = existingUserDetails.email !== updatedUserData.email;
  if (emailChanged) {
    return existingUserDetails;
  }

  const hasNewProfileImage =
    updatedUserData.profile?.images &&
    !matchUserDetails(existingUserDetails, updatedUserData, ['profile']);

  const hasNewDisplayName =
    !existingUserDetails.displayName && updatedUserData.displayName;

  const shouldUpdateUser = hasNewProfileImage || hasNewDisplayName;

  if (!shouldUpdateUser) {
    return existingUserDetails;
  }

  const finalData: User = {
    ...existingUserDetails,
  };

  if (hasNewDisplayName) {
    finalData.displayName = updatedUserData.displayName;
  }

  if (hasNewProfileImage) {
    finalData.profile = {
      ...existingUserDetails.profile,
      ...updatedUserData.profile,
    };
  }

  const jsonPatch = compare(existingUserDetails, finalData);

  if (jsonPatch.length === 0) {
    return existingUserDetails;
  }

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

    return existingUserDetails;
  }
};
