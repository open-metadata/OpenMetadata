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
import { isUndefined, omitBy, pick } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClientErrors } from '../../../enums/Axios.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import { User } from '../../../generated/entity/teams/user';
import { Include } from '../../../generated/type/include';
import {
  getLoggedInUser,
  getUserByName,
  updateUserDetail,
} from '../../../rest/userAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { getUserFirstName } from '../../../utils/UsersPureUtils';
import { useApplicationStore } from '../../useApplicationStore';

const USER_PROFILE_FIELDS = [
  TabSpecificField.PROFILE,
  TabSpecificField.ROLES,
  TabSpecificField.TEAMS,
  TabSpecificField.PERSONAS,
  TabSpecificField.DEFAULT_PERSONA,
  TabSpecificField.DOMAINS,
  TabSpecificField.EXTENSION,
  TabSpecificField.LAST_ACTIVITY_TIME,
  TabSpecificField.LAST_LOGIN_TIME,
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
  // The seeded currentUser lacks roles/teams/personas/domains/extension; keep
  // the detail cards in a skeleton state until the fetch backfills them.
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  // An unknown username 404s — track it to show an empty placeholder instead of
  // a perpetual loader.
  const [isUserNotFound, setIsUserNotFound] = useState(false);
  // Any other failure. Your own profile then still holds the partial seed copy,
  // and saving a field it lacks (e.g. one custom property) would replace every
  // stored value, so callers render an error with a reload instead.
  const [loadError, setLoadError] = useState(false);
  // Monotonic request id: a target change bumps it so a slower earlier response
  // can't overwrite a faster later one and strand the wrong user's data.
  const requestRef = useRef(0);
  // refresh() keeps its own id so it can never strand a full load: a full load
  // or a successful save bumps it, which drops an older refresh response.
  const refreshRef = useRef(0);
  const isLoadingRef = useRef(false);
  // Latest user state, kept in step with every update, so a save diffs against
  // what the page shows now rather than the render its handler closed over.
  const latestUserRef = useRef(userData);
  latestUserRef.current = userData;

  const fetchUser = useCallback(async () => {
    if (!username) {
      setIsProfileLoading(false);

      return;
    }
    const reqId = ++requestRef.current;
    ++refreshRef.current;
    isLoadingRef.current = true;
    setIsProfileLoading(true);
    setIsUserNotFound(false);
    setLoadError(false);
    // Reset on every target change so a previously-viewed user's data — and
    // their id in updateUserDetails — can't linger.
    setUserData(isSelf ? (currentUserRef.current as User) : undefined);
    try {
      // `/users/name/<you>` masks your own email for non-admins (server-side PII
      // masking); the logged-in user endpoint returns it unmasked.
      const res = isSelf
        ? await getLoggedInUser({ fields: USER_PROFILE_FIELDS })
        : await getUserByName(username, {
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
      if ((error as AxiosError).response?.status === ClientErrors.NOT_FOUND) {
        setIsUserNotFound(true);
      } else {
        setLoadError(true);
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (reqId === requestRef.current) {
        isLoadingRef.current = false;
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
      const base = latestUserRef.current;
      // A failed load leaves only the partial seed copy to diff against.
      if (!base || loadError) {
        return false;
      }
      // Diff only the fields being saved, so a concurrent save of another field
      // can't put stale (index-based array) operations for it in this patch.
      const savedKeys = Object.keys(data) as (keyof User)[];
      const current = pick(base, savedKeys);
      const jsonPatch = compare(current, { ...current, ...data });
      try {
        const response = await updateUserDetail(base.id, jsonPatch);
        if (!response) {
          showErrorToast(
            t('server.entity-updating-error', {
              entity: isSelf ? t('label.profile') : t('label.user'),
            })
          );

          return false;
        }
        // Some saves change other fields server-side: a roles change can flip
        // isAdmin, and a teams change changes the domains inherited from them.
        const nonTeamKeyData =
          key === 'roles'
            ? { roles: response.roles, isAdmin: response.isAdmin }
            : { [key]: response[key] };
        const updatedKeyData =
          key === 'teams'
            ? { teams: response.teams, domains: response.domains }
            : nonTeamKeyData;
        // A refresh read before this save would put the old value back.
        ++refreshRef.current;
        // Merge into the latest state, not the copy this save started from, so
        // two overlapping saves can't overwrite each other's field.
        setUserData((prev) => {
          const next =
            prev &&
            (omitBy({ ...prev, ...updatedKeyData }, isUndefined) as User);
          latestUserRef.current = next;

          return next;
        });
        // The app chrome (avatar menu, greetings) reads the store's copy of you.
        if (isSelf && currentUserRef.current) {
          updateCurrentUser({
            ...currentUserRef.current,
            ...updatedKeyData,
          } as User);
        }
        showSuccessToast(
          t('server.update-entity-success', {
            entity: isSelf ? t('label.profile') : t('label.user'),
          })
        );

        return true;
      } catch (error) {
        showErrorToast(error as AxiosError);

        return false;
      }
    },
    [isSelf, loadError, updateCurrentUser, t]
  );

  // Re-reads the user in place: no skeleton and no reset, so a view coming back
  // into focus picks up edits made elsewhere without flashing. A failure keeps
  // what is on screen; the next full load reports it. While a full load runs
  // there is nothing stale to refresh, and that load owns finishing.
  const refresh = useCallback(async () => {
    if (!username || loadError || isLoadingRef.current) {
      return;
    }
    const reqId = ++refreshRef.current;
    try {
      const res = isSelf
        ? await getLoggedInUser({ fields: USER_PROFILE_FIELDS })
        : await getUserByName(username, {
            fields: USER_PROFILE_FIELDS,
            include: Include.All,
          });
      if (reqId === refreshRef.current) {
        setUserData((prev) => {
          const next = { ...res, isAdmin: res.isAdmin ?? prev?.isAdmin };
          latestUserRef.current = next;

          return next;
        });
      }
    } catch {
      // Keep the values on screen.
    }
  }, [username, isSelf, loadError]);

  return {
    userData,
    isProfileLoading,
    isUserNotFound,
    loadError,
    updateUserDetails,
    refetch: fetchUser,
    refresh,
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
