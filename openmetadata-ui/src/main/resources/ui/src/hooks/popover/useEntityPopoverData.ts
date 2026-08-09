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

interface PopoverDataResult {
  name: string;
  type: OwnerType;
  data?: Team | User;
}

/**
 * Central entry for the owner popover quick-info. Both user and team owners fetch their
 * details through this single hook. The user branch also mirrors the result into the
 * {@code userProfilePics} store so avatar consumers and the popover's team/role chips read
 * from the existing cache.
 *
 * NOTE: the 1.13 branch has no React Query provider wired into the app tree, so this uses a
 * plain effect-driven fetch instead of {@code useQuery}. The return shape
 * ({@code data}, {@code loading}) is kept stable so popover consumers stay unchanged.
 */
export const useEntityPopoverData = (name: string, type: OwnerType) => {
  const updateUserProfilePics = useApplicationStore(
    (state) => state.updateUserProfilePics
  );

  const [result, setResult] = useState<PopoverDataResult>();

  useEffect(() => {
    if (!name) {
      setResult(undefined);

      return;
    }

    let active = true;
    const isTeam = type === OwnerType.TEAM;

    const fetchPopoverData = async () => {
      let data: Team | User | undefined;

      try {
        if (isTeam) {
          data = await getTeamByName(name, { fields: TEAM_POPOVER_FIELDS });
        } else {
          const user = getUserWithImage(
            await getUserByName(name, { fields: USER_POPOVER_FIELDS })
          );
          updateUserProfilePics({ id: name, user });
          data = user;
        }
      } catch {
        data = undefined;
      }

      if (active) {
        setResult({ name, type, data });
      }
    };

    fetchPopoverData();

    return () => {
      active = false;
    };
  }, [name, type, updateUserProfilePics]);

  const isResultCurrent = result?.name === name && result?.type === type;
  const loading = Boolean(name) && !isResultCurrent;

  return { data: isResultCurrent ? result?.data : undefined, loading };
};
