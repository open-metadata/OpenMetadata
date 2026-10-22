/*
 *  Copyright 2026 Collate.
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
import { isUndefined, omitBy } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { User } from '../../../../generated/entity/teams/user';
import { Include } from '../../../../generated/type/include';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { getUserByName, updateUserDetail } from '../../../../rest/userAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { getUserFirstName } from './ProfileDetailsPanel.utils';

const USER_PROFILE_FIELDS = [
  TabSpecificField.PROFILE,
  TabSpecificField.ROLES,
  TabSpecificField.TEAMS,
  TabSpecificField.PERSONAS,
  TabSpecificField.DEFAULT_PERSONA,
  TabSpecificField.DOMAINS,
  TabSpecificField.EXTENSION,
];

/**
 * Loads a user (including soft-deleted ones) for the profile views and exposes
 * a JSON-patch updater. Shared by the own-profile page and the Members user
 * detail so both apply the same stale-response and 404 handling.
 */
export const useUserProfile = (username: string | undefined) => {
  const { t } = useTranslation();
  const { currentUser, updateCurrentUser } = useApplicationStore();
  // Read the latest currentUser inside fetchUser without listing it as a dep —
  // the store object identity can change between renders and would otherwise
  // re-fire the fetch effect in a loop.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const isSelf = Boolean(username && username === currentUser?.name);

  // Seed your own profile from the application store so the page chrome renders
  // immediately; the fetch below refreshes fields in the background.
  const [userData, setUserData] = useState<User | undefined>(
    isSelf ? (currentUser as User) : undefined
  );
  // The seeded currentUser lacks roles/teams/personas/domains; keep the detail
  // cards in a skeleton state until the fetch backfills them.
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  // An unknown username 404s — track it to show an empty placeholder instead of
  // a perpetual loader.
  const [isUserNotFound, setIsUserNotFound] = useState(false);
  // Monotonic request id: a target change bumps it so a slower earlier response
  // can't overwrite a faster later one and strand the wrong user's data.
  const requestRef = useRef(0);

  const fetchUser = useCallback(async () => {
    if (!username) {
      setIsProfileLoading(false);

      return;
    }
    const reqId = ++requestRef.current;
    setIsProfileLoading(true);
    setIsUserNotFound(false);
    // Reset on every target change so a previously-viewed user's data — and
    // their id in updateUserDetails — can't linger.
    setUserData(isSelf ? (currentUserRef.current as User) : undefined);
    try {
      const res = await getUserByName(username, {
        fields: USER_PROFILE_FIELDS,
        include: Include.All,
      });
      if (reqId === requestRef.current) {
        // isAdmin is not in the fields list but is used by contributed-tab
        // conditions. Fall back to the logged-in user's flag only for your own
        // profile so another user's isAdmin is never overwritten with ours.
        setUserData({
          ...res,
          isAdmin:
            res.isAdmin ??
            (isSelf ? currentUserRef.current?.isAdmin : undefined),
        });
      }
    } catch (error) {
      if (reqId !== requestRef.current) {
        return;
      }
      // A 404 is an expected miss (e.g. a hand-typed hash); surface everything
      // else as a toast rather than masquerading as "user not found".
      if ((error as AxiosError).response?.status === 404) {
        setIsUserNotFound(true);
      } else {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (reqId === requestRef.current) {
        setIsProfileLoading(false);
      }
    }
  }, [username, isSelf]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const updateUserDetails = useCallback(
    // Resolves to whether the save landed, so an editor closes only on success.
    async (data: Partial<User>, key: keyof User): Promise<boolean> => {
      if (!userData) {
        return false;
      }
      const updatedDetails: User = { ...userData, ...data };
      const jsonPatch = compare(userData, updatedDetails);
      try {
        const response = await updateUserDetail(userData.id, jsonPatch);
        if (!response) {
          return false;
        }
        const nonTeamKeyData =
          key === 'roles'
            ? { roles: response.roles, isAdmin: response.isAdmin }
            : { [key]: response[key] };
        const updatedKeyData =
          key === 'teams'
            ? { teams: response.teams, domains: response.domains }
            : nonTeamKeyData;
        setUserData(
          omitBy(
            { ...userData, ...updatedKeyData },
            isUndefined
          ) as unknown as User
        );
        // The app chrome (avatar menu, greetings) reads the store's copy of you.
        if (isSelf && currentUserRef.current) {
          updateCurrentUser({
            ...currentUserRef.current,
            ...updatedKeyData,
          } as User);
        }
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.profile') })
        );

        return true;
      } catch (error) {
        showErrorToast(error as AxiosError);

        return false;
      }
    },
    [userData, isSelf, updateCurrentUser, t]
  );

  return {
    userData,
    isProfileLoading,
    isUserNotFound,
    updateUserDetails,
    refetch: fetchUser,
  };
};

/**
 * Picks row copy for the viewed user: "your" wording on your own profile, the
 * user's first name (e.g. "Teams Alice is a member of.") on anyone else's.
 */
export const useProfileCopy = (userData: User) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const isSelf = userData.name === currentUser?.name;

  return useCallback(
    (selfKey: string, otherKey: string) =>
      isSelf ? t(selfKey) : t(otherKey, { name: getUserFirstName(userData) }),
    [isSelf, t, userData]
  );
};
