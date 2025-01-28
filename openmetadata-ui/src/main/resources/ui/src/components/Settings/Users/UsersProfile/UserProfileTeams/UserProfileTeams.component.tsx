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

import { Divider, Tooltip, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/edit-new.svg';
import { ReactComponent as IconTeamsGrey } from '../../../../../assets/svg/teams-grey.svg';
import {
  DE_ACTIVE_COLOR,
  ICON_DIMENSION,
} from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { EntityReference } from '../../../../../generated/entity/type';
import { useAuth } from '../../../../../hooks/authHooks';
import { getNonDeletedTeams } from '../../../../../utils/CommonUtils';
import Chip from '../../../../common/Chip/Chip.component';
import InlineEdit from '../../../../common/InlineEdit/InlineEdit.component';
import TeamsSelectable from '../../../Team/TeamsSelectable/TeamsSelectable';
import { UserProfileTeamsProps } from './UserProfileTeams.interface';

const UserProfileTeams = ({
  teams,
  isDeletedUser,
  updateUserDetails,
}: UserProfileTeamsProps) => {
  const { t } = useTranslation();
  const { isAdminUser } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isTeamsEdit, setIsTeamsEdit] = useState(false);
  const [selectedTeams, setSelectedTeams] = useState<EntityReference[]>([]);

  const handleTeamsSave = async () => {
    setIsLoading(true);
    await updateUserDetails(
      {
        teams: selectedTeams.map((teamId) => ({ id: teamId.id, type: 'team' })),
      },
      'teams'
    );

    setIsLoading(false);
    setIsTeamsEdit(false);
  };

  const teamsRenderElement = useMemo(
    () => (
      <Chip
        data={getNonDeletedTeams(teams ?? [])}
        entityType={EntityType.TEAM}
        noDataPlaceholder={t('message.no-team-found')}
      />
    ),
    [teams, getNonDeletedTeams]
  );

  const setUserTeams = useCallback(() => {
    setSelectedTeams(getNonDeletedTeams(teams ?? []));
  }, [teams]);

  const handleCloseEditTeam = useCallback(() => {
    setIsTeamsEdit(false);
    setUserTeams();
  }, [setUserTeams]);

  useEffect(() => {
    setUserTeams();
  }, [setUserTeams]);

  return (
    <div
      className="d-flex p-[20px]  w-full grey-1 gap-2 mb-4"
      data-testid="user-team-card-container"
      key="teams-card"
      style={{ background: '#F5F5F5', padding: '20px', borderRadius: '12px' }}>
      <div>
        <div className="d-flex flex-col h-full flex-center">
          <IconTeamsGrey height={24} width={24} />
          <Divider
            style={{
              height: '100%',
              width: '2px',
              background: '#D9D9D9',
            }}
            type="vertical"
          />
        </div>
      </div>
      <div className="w-full">
        <div className="d-flex justify-between w-full">
          <Typography.Text className="profile-section-card-title">
            {t('label.team-plural')}
          </Typography.Text>
          {!isTeamsEdit && isAdminUser && !isDeletedUser && (
            <Tooltip
              title={t('label.edit-entity', {
                entity: t('label.team-plural'),
              })}>
              <EditIcon
                className="cursor-pointer align-middle"
                color={DE_ACTIVE_COLOR}
                data-testid="edit-teams-button"
                {...ICON_DIMENSION}
                onClick={() => setIsTeamsEdit(true)}
              />
            </Tooltip>
          )}
        </div>
        {isTeamsEdit && isAdminUser ? (
          <InlineEdit
            direction="vertical"
            isLoading={isLoading}
            onCancel={handleCloseEditTeam}
            onSave={handleTeamsSave}>
            <TeamsSelectable
              filterJoinable
              maxValueCount={4}
              selectedTeams={selectedTeams}
              onSelectionChange={setSelectedTeams}
            />
          </InlineEdit>
        ) : (
          teamsRenderElement
        )}
      </div>
    </div>
  );
};

export default UserProfileTeams;
