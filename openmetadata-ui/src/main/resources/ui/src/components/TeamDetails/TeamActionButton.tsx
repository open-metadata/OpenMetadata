/*
 *  Copyright 2023 Collate.
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

import { Button } from 'antd';
import { Team } from 'generated/entity/teams/team';
import { User } from 'generated/entity/teams/user';
import { isUndefined } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface TeamActionButtonProps {
  currentTeam: Team;
  deleteUserHandler: (id: string, leave?: boolean) => void;
  hasAccess: boolean;
  joinTeam: () => void;
  currentUser?: User;
}

function TeamActionButton({
  currentUser,
  currentTeam,
  deleteUserHandler,
  hasAccess,
  joinTeam,
}: TeamActionButtonProps) {
  const { t } = useTranslation();

  const alreadyJoined = useMemo(
    () =>
      currentUser
        ? currentUser.teams?.find((team) => team.id === currentTeam.id)
        : false,
    [currentUser, currentTeam]
  );

  if (!isUndefined(currentUser)) {
    if (alreadyJoined) {
      return (
        <Button
          ghost
          data-testid="leave-team-button"
          type="primary"
          onClick={() => deleteUserHandler(currentUser.id, true)}>
          {t('label.leave-team')}
        </Button>
      );
    }

    if (currentTeam.isJoinable || hasAccess) {
      return (
        <Button data-testid="join-teams" type="primary" onClick={joinTeam}>
          {t('label.join-team')}
        </Button>
      );
    }
  }

  return null;
}

export default TeamActionButton;
