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
import { ClientErrors } from '../../enums/Axios.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { User } from '../../generated/entity/teams/user';
import { Include } from '../../generated/type/include';
import {
  getLoggedInUser,
  getUserByName,
  updateUserDetail,
} from '../../rest/userAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const USER_FIELDS = [
  TabSpecificField.PROFILE,
  TabSpecificField.ROLES,
  TabSpecificField.TEAMS,
  TabSpecificField.PERSONAS,
  TabSpecificField.DEFAULT_PERSONA,
  TabSpecificField.DOMAINS,
];

export interface EditableUser {
  userData?: User;
  isLoading: boolean;
  isNotFound: boolean;
  // Re-runs the fetch, e.g. from an error placeholder's Reload action.
  reload: () => Promise<void>;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

/**
 * Loads one user by name with every field the Settings profile/edit rows need,
 * and patches it in place. `seed` (the logged-in user from the store) renders
 * the page chrome before the fetch lands and backfills `isAdmin`, which the
 * fields list does not return.
 *
 * `isSelf` loads through `/users/loggedInUser`: `/users/name/<you>` masks the
 * email for non-admins (server-side PII masking), even on your own profile.
 */
export const useEditableUser = (
  username: string | undefined,
  seed?: User,
  isSelf = false
): EditableUser => {
  const { t } = useTranslation();
  const [userData, setUserData] = useState<User | undefined>(seed);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  // Bumped per fetch so a slower response for a previous username can't
  // overwrite the current one.
  const requestRef = useRef(0);
  // Read through a ref: the store object identity changes between renders and
  // would otherwise re-fire the fetch in a loop.
  const seedRef = useRef(seed);
  seedRef.current = seed;

  const fetchUser = useCallback(async () => {
    if (!username) {
      setIsLoading(false);

      return;
    }
    const reqId = ++requestRef.current;
    setIsLoading(true);
    setIsNotFound(false);
    setUserData(seedRef.current);
    try {
      const res = isSelf
        ? await getLoggedInUser({ fields: USER_FIELDS })
        : await getUserByName(username, {
            fields: USER_FIELDS,
            include: Include.All,
          });
      if (reqId === requestRef.current) {
        setUserData({
          ...res,
          isAdmin: res.isAdmin ?? seedRef.current?.isAdmin,
        });
      }
    } catch (error) {
      if (reqId !== requestRef.current) {
        return;
      }
      // A 404 is an expected miss (a stale or hand-typed hash); anything else is
      // a real failure the user should see.
      if ((error as AxiosError).response?.status === ClientErrors.NOT_FOUND) {
        setIsNotFound(true);
      } else {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (reqId === requestRef.current) {
        setIsLoading(false);
      }
    }
  }, [username, isSelf]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const updateUserDetails = useCallback(
    async (data: Partial<User>, key: keyof User) => {
      if (!userData) {
        return;
      }
      const jsonPatch = compare(userData, { ...userData, ...data });
      // Errors propagate (no toast here) so an inline editor stays open with
      // the user's draft; the caller surfaces the failure.
      const response = await updateUserDetail(userData.id, jsonPatch);
      if (!response) {
        return;
      }
      // Roles also flip isAdmin, and teams can change inherited domains, so
      // those keys pull the related fields back from the response too.
      const nonTeamKeyData =
        key === 'roles'
          ? { roles: response.roles, isAdmin: response.isAdmin }
          : { [key]: response[key] };
      const updatedKeyData =
        key === 'teams'
          ? { teams: response.teams, domains: response.domains }
          : nonTeamKeyData;
      // Merge into the latest state, not the copy this save started from, so
      // two overlapping saves can't overwrite each other's field.
      setUserData(
        (prev) =>
          prev && (omitBy({ ...prev, ...updatedKeyData }, isUndefined) as User)
      );
      showSuccessToast(
        t('server.update-entity-success', { entity: t('label.profile') })
      );
    },
    [userData, t]
  );

  return {
    userData,
    isLoading,
    isNotFound,
    reload: fetchUser,
    updateUserDetails,
  };
};
