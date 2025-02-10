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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Divider, Popover, Typography } from 'antd';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTeamsGrey } from '../../../../../assets/svg/teams-grey.svg';
import { ReactComponent as EditIcon } from '../../../../../assets/svg/user-profile-edit.svg';
import { ICON_DIMENSION_USER_PAGE } from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { EntityReference } from '../../../../../generated/entity/type';
import { useAuth } from '../../../../../hooks/authHooks';
import { getNonDeletedTeams } from '../../../../../utils/CommonUtils';
import Chip from '../../../../common/Chip/Chip.component';
import TeamsSelectableNew from '../../../Team/TeamsSelectable/TeamsSelectableNew';
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
  const [isSelectOpen, setIsSelectOpen] = useState<boolean>(false);

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

  const handleDropdownChange = (visible: boolean) => {
    setIsSelectOpen(visible);
  };

  return (
    <div className="d-flex flex-col w-full h-full p-[20px] user-profile-card">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <div>
          <IconTeamsGrey {...ICON_DIMENSION_USER_PAGE} />
        </div>

        <div className="d-flex justify-between w-full">
          <Typography.Text className="user-profile-card-title">
            {t('label.team-plural')}
          </Typography.Text>
          {isAdminUser && !isDeletedUser && (
            <Popover
              content={
                <div className="user-profile-edit-popover-card">
                  <div className="d-flex justify-start items-center gap-2 m-b-xss">
                    <div className="user-page-icon d-flex-center">
                      <IconTeamsGrey className="m-b-0" height={16} />
                    </div>

                    <Typography.Text className="user-profile-edit-popover-card-title">
                      {t('label.team-plural')}
                    </Typography.Text>
                  </div>

                  <div
                    className="border p-2 bg-gray-100 rounded-md"
                    style={{
                      borderRadius: '5px',
                      // overflowY: 'auto',
                      // height: isSelectOpen ? '300px' : 'auto',
                    }}>
                    <TeamsSelectableNew
                      filterJoinable
                      handleDropdownChange={handleDropdownChange}
                      maxValueCount={4}
                      selectedTeams={selectedTeams}
                      onSelectionChange={setSelectedTeams}
                    />
                  </div>

                  <div className="flex justify-end gap-2 mt-4">
                    <Button
                      data-testid="inline-cancel-btn"
                      icon={<CloseOutlined />}
                      size="small"
                      style={{
                        width: '30px',
                        height: '30px',
                        background: '#0950C5',
                      }}
                      type="primary"
                      onClick={handleCloseEditTeam}
                    />
                    <Button
                      data-testid="inline-save-btn"
                      icon={<CheckOutlined />}
                      loading={isLoading}
                      size="small"
                      style={{
                        width: '30px',
                        height: '30px',
                        background: '#0950C5',
                      }}
                      type="primary"
                      onClick={handleTeamsSave}
                    />
                  </div>
                </div>
              }
              open={isTeamsEdit}
              overlayClassName="profile-edit-popover-card"
              placement="topRight"
              trigger="click"
              onOpenChange={setIsTeamsEdit}>
              <EditIcon
                className="cursor-pointer"
                data-testid="edit-teams-button"
                height={16}
                onClick={() => setIsTeamsEdit(true)}
              />
            </Popover>
          )}
        </div>
      </div>
      <div className="user-profile-card-body d-flex justify-start gap-2">
        <div className="user-page-icon d-flex-center">
          <Divider
            style={{
              height: '100%',
              width: '1px',
              background: '#D9D9D9',
            }}
            type="vertical"
          />
        </div>
        {isAdminUser && teamsRenderElement}
      </div>
    </div>
  );
};

export default UserProfileTeams;
