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

import { Button, Divider, Popover, Tooltip, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EditIcon from '../../../../../assets/svg/edit-new.svg?react';
import ClosePopoverIcon from '../../../../../assets/svg/ic-popover-close.svg?react';
import SavePopoverIcon from '../../../../../assets/svg/ic-popover-save.svg?react';
import IconTeamsGrey from '../../../../../assets/svg/teams-grey.svg?react';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [popoverHeight, setPopoverHeight] = useState<number>(156);
  const teamsSelectableRef = useRef<HTMLDivElement | null>(null);

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
    setIsDropdownOpen(visible);
  };

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dropdown = document.querySelector(
        '.teams-custom-dropdown-class'
      ) as HTMLElement;

      if (dropdown) {
        setPopoverHeight(dropdown.scrollHeight + 156);
      }
    });

    const dropdown = document.querySelector('.teams-custom-dropdown-class');
    if (dropdown) {
      observer.observe(dropdown, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }

    return () => observer.disconnect();
  }, [isDropdownOpen]);

  return (
    <div
      className="d-flex flex-col w-full  p-[20px] user-profile-card"
      data-testid="user-profile-teams">
      <div className="user-profile-card-header d-flex items-center justify-start gap-2 w-full">
        <div>
          <IconTeamsGrey height={16} />
        </div>

        <div className="d-flex justify-between w-full">
          <Typography.Text className="text-sm font-medium p-l-xss">
            {t('label.team-plural')}
          </Typography.Text>

          <Popover
            content={
              <div
                className="user-profile-edit-popover-card relative"
                data-testid="profile-teams-edit-popover"
                style={{
                  height: `${popoverHeight}px`,
                }}>
                <div className="d-flex justify-start items-center gap-2 m-b-sm">
                  <div className="d-flex flex-start items-center">
                    <IconTeamsGrey height={16} />
                  </div>

                  <Typography.Text className="user-profile-edit-popover-card-title">
                    {t('label.team-plural')}
                  </Typography.Text>
                </div>

                <div
                  className="border p-2 bg-gray-100 rounded-md"
                  style={{
                    borderRadius: '5px',
                  }}>
                  <TeamsSelectableNew
                    handleDropdownChange={handleDropdownChange}
                    maxValueCount={3}
                    ref={teamsSelectableRef}
                    selectedTeams={selectedTeams}
                    onSelectionChange={setSelectedTeams}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    className="profile-edit-save"
                    data-testid="teams-edit-close-btn"
                    icon={<ClosePopoverIcon height={24} />}
                    size="small"
                    style={{
                      width: '30px',
                      height: '30px',
                      background: '#0950C5',
                      position: 'absolute',
                      bottom: '0px',
                      right: '38px',
                    }}
                    type="primary"
                    onClick={handleCloseEditTeam}
                  />
                  <Button
                    className="profile-edit-cancel"
                    data-testid="teams-edit-save-btn"
                    icon={<SavePopoverIcon height={24} />}
                    loading={isLoading}
                    size="small"
                    style={{
                      width: '30px',
                      height: '30px',
                      background: '#0950C5',
                      position: 'absolute',
                      bottom: '0px',
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
            {isAdminUser && !isDeletedUser && (
              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.team-plural'),
                })}>
                <EditIcon
                  className="cursor-pointer"
                  data-testid="edit-teams-button"
                  height={16}
                  onClick={() => setIsTeamsEdit(true)}
                />
              </Tooltip>
            )}
          </Popover>
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
        {teamsRenderElement}
      </div>
    </div>
  );
};

export default UserProfileTeams;
