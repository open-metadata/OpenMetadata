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

const pendingProfileFetches = new Map<string, Promise<void>>();

const isCacheableErrorStatus = (status?: number): boolean =>
  status === ClientErrors.NOT_FOUND ||
  status === ClientErrors.FORBIDDEN ||
  status === ClientErrors.UNAUTHORIZED ||
  status === ClientErrors.BAD_REQUEST;

const shouldCachePlaceholderOnError = (status?: number): boolean =>
  isCacheableErrorStatus(status) || status === 500 || status === undefined;

// Profile images are best-effort. Cache a placeholder on any read failure so avatar loaders
// can settle and we do not keep retrying a denied/missing profile forever.
const handleProfileFetchError = (
  error: unknown,
  cacheKey: string,
  name: string,
  updateUserProfilePics: (payload: { id: string; user: User }) => void
): void => {
  const errorStatus = (error as AxiosError)?.response?.status;
  if (!shouldCachePlaceholderOnError(errorStatus)) {
    return;
  }

  updateUserProfilePics({
    id: cacheKey,
    user: {
      name,
      id: cacheKey,
      email: '',
    } as User,
  });
};

const loadUserProfilePic = async (name: string) => {
  const { updateUserProfilePics } = useApplicationStore.getState();
  try {
    const user = await getUserByName(name, {
      fields: TabSpecificField.PROFILE,
    });

    updateUserProfilePics({ id: name, user: getUserWithImage(user) });
  } catch (error) {
    handleProfileFetchError(error, name, name, updateUserProfilePics);
  } finally {
    pendingProfileFetches.delete(name);
  }
};

/**
 * Loads a user's profile into the shared `userProfilePics` cache. A cached name costs no
 * request and a name already being fetched reuses that request, so callers can ask for the
 * same users repeatedly (e.g. on every keystroke of a mention search).
 */
export const fetchUserProfilePic = (name: string): Promise<void> => {
  if (useApplicationStore.getState().userProfilePics[name]) {
    return Promise.resolve();
  }

  let pending = pendingProfileFetches.get(name);
  if (!pending) {
    pending = loadUserProfilePic(name);
    pendingProfileFetches.set(name, pending);
  }

  return pending;
};

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
    if (isTeam) {
      setProfilePic(IconTeams);

      return;
    }

    await fetchUserProfilePic(name);
  }, [name, isTeam]);

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
      !isTeam && isUndefined(user) && pendingProfileFetches.has(cacheKey)
    ),
    user,
  ];
};
