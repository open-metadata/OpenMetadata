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

import { useQuery } from '@tanstack/react-query';
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

/**
 * Central react-query entry for the owner popover. Both user and team owners fetch and cache
 * their quick-info through this single hook (shared {@link queryClient}), rather than each type
 * defining its own caching. The user branch also mirrors the result into the {@code userProfilePics}
 * store so avatar consumers and the popover's team/role chips read from the existing cache.
 */
export const useEntityPopoverData = (name: string, type: OwnerType) => {
  const isTeam = type === OwnerType.TEAM;
  const updateUserProfilePics = useApplicationStore(
    (state) => state.updateUserProfilePics
  );

  const { data, isLoading } = useQuery<Team | User>({
    queryKey: ['entity-popover', type, name],
    queryFn: async () => {
      let result: Team | User;

      if (isTeam) {
        result = await getTeamByName(name, { fields: TEAM_POPOVER_FIELDS });
      } else {
        const user = getUserWithImage(
          await getUserByName(name, { fields: USER_POPOVER_FIELDS })
        );
        updateUserProfilePics({ id: name, user });
        result = user;
      }

      return result;
    },
    enabled: Boolean(name),
  });

  return { data, loading: isLoading };
};
