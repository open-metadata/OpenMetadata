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
import { isUndefined } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useApplicationConfigContext } from '../../components/ApplicationConfigProvider/ApplicationConfigProvider';
import { User } from '../../generated/entity/teams/user';
import { getUserByName } from '../../rest/userAPI';
import {
  getImageWithResolutionAndFallback,
  ImageQuality,
} from '../../utils/ProfilerUtils';

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
  const { userProfilePics, updateUserProfilePics } =
    useApplicationConfigContext();

  const user = userProfilePics[name];
  const [profilePic, setProfilePic] = useState(
    getImageWithResolutionAndFallback(
      ImageQuality['6x'],
      user?.profile?.images
    ) ?? null
  );

  useEffect(() => {
    if (user && !profilePic) {
      setProfilePic(
        getImageWithResolutionAndFallback(
          ImageQuality['6x'],
          user?.profile?.images
        ) ?? ''
      );
    }
  }, [user, profilePic]);

  const fetchProfileIfRequired = useCallback(() => {
    if (isTeam || userProfilePics[name]) {
      return;
    }

    if (userProfilePicsLoading.includes(name)) {
      return;
    }

    userProfilePicsLoading = [...userProfilePicsLoading, name];

    getUserByName(name, 'profile')
      .then((user) => {
        const profile =
          getImageWithResolutionAndFallback(
            ImageQuality['6x'],
            user.profile?.images
          ) ?? '';

        updateUserProfilePics({
          id: user.name,
          user,
        });
        userProfilePicsLoading = userProfilePicsLoading.filter(
          (p) => p !== name
        );

        setProfilePic(profile);
      })
      .catch(() => {
        // Error
        userProfilePicsLoading = userProfilePicsLoading.filter(
          (p) => p !== name
        );
      });
  }, [updateUserProfilePics, userProfilePics, name, isTeam]);

  useEffect(() => {
    if (!permission) {
      return;
    }

    if (!name) {
      return;
    }

    fetchProfileIfRequired();
  }, [name, permission, fetchProfileIfRequired]);

  return [profilePic, isUndefined(user), user];
};
