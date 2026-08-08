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

import { useEffect, useState } from 'react';
import { TabSpecificField } from '../../enums/entity.enum';
import { OwnerType } from '../../enums/user.enum';
import { Team } from '../../generated/entity/teams/team';
import { User } from '../../generated/entity/teams/user';
import { getTeamByName } from '../../rest/teamsAPI';
import { getUserByName } from '../../rest/userAPI';
import { getUserWithImage } from '../../utils/UserDataUtils';
import { useApplicationStore } from '../useApplicationStore';

const USER_POPOVER_FIELDS = [
  TabSpecificField.TEAMS,
  TabSpecificField.ROLES,
  TabSpecificField.PROFILE,
];
const TEAM_POPOVER_FIELDS = [
  TabSpecificField.PARENTS,
  TabSpecificField.USER_COUNT,
];

type PopoverEntity = Team | User;

/**
 * De-duplicates concurrent identical fetches, keyed by `${type}:${name}`.
 *
 * The owner popover renders its title and content as two separate antd subtrees, so both
 * call {@link useEntityPopoverData} for the same owner in the same tick. Without sharing, that
 * fires two identical conditional (ETag/304) requests at once, which collide in the browser's
 * HTTP cache (Chrome: {@code ERR_CACHE_OPERATION_NOT_SUPPORTED}); the failed one leaves the
 * component with no data and it falls back to "No data available". Handing both callers the
 * same in-flight promise collapses them into a single request. The entry is dropped once the
 * request settles, so a later hover still re-fetches (no stale-cache concerns).
 */
const inFlightRequests = new Map<string, Promise<PopoverEntity>>();

const fetchPopoverEntity = (
  name: string,
  isTeam: boolean
): Promise<PopoverEntity> => {
  const key = `${isTeam ? OwnerType.TEAM : OwnerType.USER}:${name}`;
  const pending = inFlightRequests.get(key);

  if (pending) {
    return pending;
  }

  const request = (async (): Promise<PopoverEntity> => {
    if (isTeam) {
      return getTeamByName(name, { fields: TEAM_POPOVER_FIELDS });
    }

    return getUserWithImage(
      await getUserByName(name, { fields: USER_POPOVER_FIELDS })
    );
  })().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, request);

  return request;
};

/**
 * Central entry for the owner popover quick-info. Both user and team owners fetch their
 * details through this single hook. The user branch also mirrors the result into the
 * {@code userProfilePics} store so avatar consumers and the popover's team/role chips read
 * from the existing cache.
 *
 * NOTE: the 1.13 branch has no React Query provider wired into the app tree, so this uses a
 * plain effect-driven fetch (with {@link inFlightRequests} de-duplication) instead of
 * {@code useQuery}. The return shape ({@code data}, {@code loading}) is kept stable so popover
 * consumers stay unchanged.
 */
export const useEntityPopoverData = (name: string, type: OwnerType) => {
  const updateUserProfilePics = useApplicationStore(
    (state) => state.updateUserProfilePics
  );

  const [data, setData] = useState<PopoverEntity>();
  const [loading, setLoading] = useState<boolean>(Boolean(name));

  useEffect(() => {
    if (!name) {
      setData(undefined);
      setLoading(false);

      return;
    }

    let active = true;
    const isTeam = type === OwnerType.TEAM;
    setLoading(true);

    fetchPopoverEntity(name, isTeam)
      .then((result) => {
        if (!active) {
          return;
        }

        if (!isTeam) {
          updateUserProfilePics({ id: name, user: result as User });
        }
        setData(result);
      })
      .catch(() => {
        if (active) {
          setData(undefined);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [name, type, updateUserProfilePics]);

  return { data, loading };
};
