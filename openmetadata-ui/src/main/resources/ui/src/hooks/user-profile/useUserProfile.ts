/*
 *  Copyright 2023 Collate.
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
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import IconTeams from '../../assets/svg/teams-grey.svg';
import { ClientErrors } from '../../enums/Axios.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { User } from '../../generated/entity/teams/user';
import { getUserByName } from '../../rest/userAPI';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from '../../utils/ProfilerUtils';
import { getUserWithImage } from '../../utils/UserDataUtils';
import { useApplicationStore } from '../useApplicationStore';

let userProfilePicsLoading: string[] = [];

export const useUserProfile = ({
  permission,
  name,
  isTeam,
}: {
  permission: boolean;
  name: string;
  isTeam?: boolean;
}): [string | null, boolean, User | undefined] => {
  const cacheKey = name;
  const user = useApplicationStore((state) => state.userProfilePics[cacheKey]);

  const updateUserProfilePics = useApplicationStore(
    (state) => state.updateUserProfilePics
  );

  const [profilePic, setProfilePic] = useState(
    getImageWithResolutionAndFallback(
      ImageQuality['6x'],
      user?.profile?.images
    ) ?? null
  );

  useEffect(() => {
    const profileImagePic =
      getImageWithResolutionAndFallback(
        ImageQuality['6x'],
        user?.profile?.images
      ) ?? '';

    if (user && profilePic !== profileImagePic) {
      setProfilePic(profileImagePic);
    }
  }, [user, profilePic]);

  const fetchProfileIfRequired = useCallback(async () => {
    const currentUserProfilePics =
      useApplicationStore.getState().userProfilePics;

    if (isTeam || currentUserProfilePics[cacheKey]) {
      isTeam && setProfilePic(IconTeams);

      return;
    }

    if (userProfilePicsLoading.includes(cacheKey)) {
      return;
    }

    userProfilePicsLoading = [...userProfilePicsLoading, cacheKey];

    try {
      let user = await getUserByName(name, {
        fields: TabSpecificField.PROFILE,
      });
      user = getUserWithImage(user);

      updateUserProfilePics({
        id: cacheKey,
        user,
      });
    } catch (error) {
      // Profile images are best-effort. Cache a placeholder on any read failure so avatar loaders
      // can settle and we do not keep retrying a denied/missing profile forever.
      if (
        (error as AxiosError)?.response?.status === ClientErrors.NOT_FOUND ||
        (error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN ||
        (error as AxiosError)?.response?.status === ClientErrors.UNAUTHORIZED ||
        (error as AxiosError)?.response?.status === ClientErrors.BAD_REQUEST ||
        (error as AxiosError)?.response?.status === ClientErrors.SERVER_ERROR ||
        (error as AxiosError)?.response?.status === undefined
      ) {
        updateUserProfilePics({
          id: cacheKey,
          user: {
            name,
            id: cacheKey,
            email: '',
          },
        });
      }
    } finally {
      userProfilePicsLoading = userProfilePicsLoading.filter(
        (p) => p !== cacheKey
      );
    }
  }, [cacheKey, name, isTeam, updateUserProfilePics]);

  useEffect(() => {
    if (!permission) {
      return;
    }

    if (!name) {
      return;
    }

    fetchProfileIfRequired();
  }, [name, permission, fetchProfileIfRequired]);

  return [
    profilePic,
    Boolean(
      !isTeam && isUndefined(user) && userProfilePicsLoading.includes(cacheKey)
    ),
    user,
  ];
};
