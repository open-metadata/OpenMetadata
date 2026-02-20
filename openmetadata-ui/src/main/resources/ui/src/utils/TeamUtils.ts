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

import { ReactComponent as GChatIcon } from '../assets/svg/gchat.svg';
import { ReactComponent as MsTeamsIcon } from '../assets/svg/ms-teams.svg';
import { ReactComponent as SlackIcon } from '../assets/svg/slack.svg';
import { ReactComponent as WebhookIcon } from '../assets/svg/webhook.svg';
import { SUBSCRIPTION_WEBHOOK } from '../constants/Teams.constants';
import { Team, TeamType } from '../generated/entity/teams/team';
import { t } from './i18next/LocalUtil';

export const getDeleteMessagePostFix = (
  teamName: string,
  deleteType: string
) => {
  return t('message.delete-team-message', {
    teamName,
    deleteType,
  });
};

/**
 * To get webhook svg icon
 * @param item webhook key
 * @returns SvgComponent
 */
export const getWebhookIcon = (item: SUBSCRIPTION_WEBHOOK): SvgComponent => {
  switch (item) {
    case SUBSCRIPTION_WEBHOOK.SLACK:
      return SlackIcon;

    case SUBSCRIPTION_WEBHOOK.G_CHAT:
      return GChatIcon;

    case SUBSCRIPTION_WEBHOOK.GENERIC:
      return WebhookIcon;

    default:
      return MsTeamsIcon;
  }
};
export const getTeamOptionsFromType = (parentType: TeamType) => {
  switch (parentType) {
    case TeamType.Organization:
      return [
        TeamType.BusinessUnit,
        TeamType.Division,
        TeamType.Department,
        TeamType.Group,
      ];
    case TeamType.BusinessUnit:
      return [TeamType.Division, TeamType.Department, TeamType.Group];
    case TeamType.Division:
      return [TeamType.Division, TeamType.Department, TeamType.Group];
    case TeamType.Department:
      return [TeamType.Department, TeamType.Group];
    case TeamType.Group:
      return [TeamType.Group];
  }
};

/**
 * Restricting the drop of team based on the team type
 * Group: Can't have any child team
 * Division: Can have only Department and Group
 * Department: Can have only Group
 */

export const flattenTeamTree = (teams: Team[]): Team[] =>
  teams.flatMap((team) => {
    const children = (team.children as unknown as Team[] | undefined) ?? [];

    return [team, ...flattenTeamTree(children)];
  });

export const isDropRestricted = (
  dragTeamType?: TeamType,
  dropTeamType?: TeamType
) =>
  dropTeamType === TeamType.Group ||
  (dropTeamType === TeamType.Division &&
    dragTeamType === TeamType.BusinessUnit) ||
  (dropTeamType === TeamType.Department &&
    dragTeamType === TeamType.BusinessUnit) ||
  (dropTeamType === TeamType.Department && dragTeamType === TeamType.Division);
