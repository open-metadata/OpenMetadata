/*
 *  Copyright 2022 Collate.
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

import { t } from 'i18next';
import { cloneDeep, isNil, isUndefined, omit } from 'lodash';
import { CreateTeam } from '../generated/api/teams/createTeam';
import {
  EntityReference,
  Team,
  TeamType,
} from '../generated/entity/teams/team';
import { getEntityIdArray } from './CommonUtils';

/**
 * To get filtered list of non-deleted(active) users
 * @param users List of users
 * @returns List of non-deleted(active) users
 */
export const getActiveUsers = (users?: Array<EntityReference>) => {
  return !isNil(users) ? users.filter((item) => !item.deleted) : [];
};

export const filterChildTeams = (
  teamsList: Team[],
  showDeletedTeams: boolean
) => teamsList.filter((d) => d.deleted === showDeletedTeams);

export const getDeleteMessagePostFix = (
  teamName: string,
  deleteType: string
) => {
  return t('message.delete-team-message', {
    teamName,
    deleteType,
  });
};

const getEntityValue = (value: EntityReference[] | undefined) => {
  if (!isUndefined(value)) {
    return getEntityIdArray(value);
  }

  return undefined;
};

export const getMovedTeamData = (team: Team, parents: string[]): CreateTeam => {
  const userDetails = omit(cloneDeep(team), [
    'id',
    'fullyQualifiedName',
    'href',
    'version',
    'updatedAt',
    'updatedBy',
    'userCount',
    'childrenCount',
    'owns',
    'changeDescription',
    'deleted',
    'inheritedRoles',
    'key',
  ]) as Team;

  const { policies, users, defaultRoles, children } = userDetails;

  return {
    ...userDetails,
    teamType: userDetails.teamType as TeamType,
    defaultRoles: getEntityValue(defaultRoles),
    children:
      userDetails.teamType === TeamType.Group
        ? undefined
        : getEntityValue(children),
    parents: parents,
    policies: getEntityValue(policies),
    users: getEntityValue(users),
  };
};
