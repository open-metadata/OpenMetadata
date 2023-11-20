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
import { useCallback, useEffect, useState } from 'react';
import { useApplicationConfigContext } from '../../components/ApplicationConfigProvider/ApplicationConfigProvider';
import { User } from '../../generated/entity/teams/user';
import { getUserByName } from '../../rest/userAPI';

export const useUserProfile = ({
  permission,
  name,
}: {
  permission: boolean;
  name: string;
}): [string, boolean, User | undefined] => {
  const { userProfilePics, updateUserProfilePics, userProfilePicsLoading } =
    useApplicationConfigContext();

  const user = userProfilePics[name];
  const [profielPic, setProfilePic] = useState(
    (user?.profile?.images?.image512 || '') ?? ''
  );

  const fetchProfileIfRequired = useCallback(() => {
    !userProfilePicsLoading.current.includes(name)
      ? (userProfilePicsLoading.current = [
          ...userProfilePicsLoading.current,
          name,
        ])
      : null;
    getUserByName(name, 'profile')
      .then((user) => {
        const profile = user.profile?.images?.image512 || '';

        updateUserProfilePics({
          id: user.name,
          user,
        });

        setProfilePic(profile);
      })
      .catch(() => {
        // Error
      })
      .finally(() => {
        if (userProfilePicsLoading.current.includes(name)) {
          userProfilePicsLoading.current =
            userProfilePicsLoading.current.filter((p) => p !== name);
        }
      });
  }, []);

  useEffect(() => {
    if (!permission) {
      return;
    }

    if (!name) {
      return;
    }

    if (
      !userProfilePicsLoading.current.includes(name) &&
      !userProfilePics[name]
    ) {
      fetchProfileIfRequired();
    }
  }, [permission, name, userProfilePicsLoading, userProfilePics]);

  return [profielPic, userProfilePicsLoading.current.includes(name), user];
};
