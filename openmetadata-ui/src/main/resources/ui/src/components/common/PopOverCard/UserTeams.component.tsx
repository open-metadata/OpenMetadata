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

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTeams } from '../../../assets/svg/teams-grey.svg';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getNonDeletedTeams } from '../../../utils/TeamUtils';
import { UserTeamsProps } from './UserPopOverCard.interface';

export const UserTeams = React.memo(({ userName }: UserTeamsProps) => {
  const { userProfilePics } = useApplicationStore();
  const userData = userProfilePics[userName];
  const teams = getNonDeletedTeams(userData?.teams ?? []);
  const { t } = useTranslation();

  return teams?.length ? (
    <div className="m-t-xs">
      <p className="d-flex items-center">
        <IconTeams height={16} width={16} />
        <span className="m-r-xs m-l-xss align-middle font-medium">
          {t('label.team-plural')}
        </span>
      </p>

      <p className="d-flex flex-wrap m-t-xss">
        {teams.map((team) => (
          <span
            className="bg-grey rounded-4 p-x-xs text-grey-body text-xs m-b-xss"
            key={team.id}>
            {getEntityName(team)}
          </span>
        ))}
      </p>
    </div>
  ) : null;
});
