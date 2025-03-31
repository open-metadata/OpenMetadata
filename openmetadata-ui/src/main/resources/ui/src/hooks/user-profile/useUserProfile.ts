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
import { useCurrentUserStore } from '../../store/useCurrentUser.store';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from '../../utils/ProfilerUtils';
import { getUserWithImage } from '../../utils/UserDataUtils';

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
  const { userProfilePics, updateUserProfilePics } = useCurrentUserStore();

  const user = userProfilePics[name];
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
    if (isTeam || userProfilePics[name]) {
      isTeam && setProfilePic(IconTeams);

      return;
    }

    if (userProfilePicsLoading.includes(name)) {
      return;
    }

    userProfilePicsLoading = [...userProfilePicsLoading, name];

    try {
      let user = await getUserByName(name, {
        fields: TabSpecificField.PROFILE,
      });
      user = getUserWithImage(user);

      updateUserProfilePics({
        id: user.name,
        user,
      });

      userProfilePicsLoading = userProfilePicsLoading.filter((p) => p !== name);
    } catch (error) {
      if ((error as AxiosError)?.response?.status === ClientErrors.NOT_FOUND) {
        // If user not found, add empty user to prevent further requests and infinite loading
        updateUserProfilePics({
          id: name,
          user: {
            name,
            id: name,
            email: '',
          },
        });
      }

      userProfilePicsLoading = userProfilePicsLoading.filter((p) => p !== name);
    }
  }, [
    updateUserProfilePics,
    userProfilePics,
    name,
    isTeam,
    userProfilePicsLoading,
  ]);

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
      !isTeam && isUndefined(user) && userProfilePicsLoading.includes(name)
    ),
    user,
  ];
};
