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
