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
import { BaseOptionType } from 'antd/lib/select';
import { isEmpty } from 'lodash';
import {
  ChildElement,
  TeamHierarchy,
  TeamType,
} from '../../../../generated/entity/teams/teamHierarchy';
import { getEntityName } from '../../../../utils/EntityNameUtils';

const getTreeNodeData = (
  team: TeamHierarchy | ChildElement,
  filterJoinable?: boolean
): BaseOptionType | null => {
  const children = (team.children ?? [])
    .map((child) => getTreeNodeData(child, filterJoinable))
    .filter((child): child is BaseOptionType => child !== null);

  const isGroupTeam = team.teamType === TeamType.Group;

  // Only Group teams can have direct users; non-Group teams stay visible
  // solely as branches leading to nested Group teams.
  if (!isGroupTeam && isEmpty(children)) {
    return null;
  }

  return {
    title: getEntityName(team),
    value: team.id,
    selectable: isGroupTeam,
    disabled: filterJoinable ? !team.isJoinable : false,
    children: isEmpty(children) ? undefined : children,
  };
};

export const buildTeamsSelectableTree = (
  teams: TeamHierarchy[],
  filterJoinable?: boolean
): BaseOptionType[] =>
  teams
    .map((team) => getTreeNodeData(team, filterJoinable))
    .filter((team): team is BaseOptionType => team !== null);
