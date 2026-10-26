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

import {
  Box,
  Button,
  Divider,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClosePopoverIcon } from '../../../../../assets/svg/ic-popover-close.svg';
import { ReactComponent as SavePopoverIcon } from '../../../../../assets/svg/ic-popover-save.svg';
import { ReactComponent as IconTeamsGrey } from '../../../../../assets/svg/teams-grey.svg';
import { EntityType } from '../../../../../enums/entity.enum';
import { EntityReference } from '../../../../../generated/entity/type';
import { useAuth } from '../../../../../hooks/authHooks';
import { getNonDeletedTeams } from '../../../../../utils/TeamUtils';
import Chip from '../../../../common/Chip/Chip.component';
import { WidgetEditButton } from '../../../../common/WidgetActionButton/WidgetActionButton';
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
    [teams, t]
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

  useEffect(() => {
    setIsDropdownOpen(isTeamsEdit);
  }, [isTeamsEdit]);

  const handleDropdownChange = (visible: boolean) => {
    setIsDropdownOpen(visible);
  };

  return (
    <div
      className="tw:flex tw:w-full tw:flex-col tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:px-5 tw:pt-5 tw:pb-2.5 tw:mb-5"
      data-testid="user-profile-teams">
      <div className="tw:mb-2 tw:flex tw:w-full tw:items-center tw:justify-start tw:gap-2">
        <div className="tw:m-0.5 tw:flex tw:size-4 tw:items-center tw:justify-center">
          <IconTeamsGrey height={18} width={18} />
        </div>

        <div className="d-flex justify-between w-full">
          <Typography className="text-sm font-medium">
            {t('label.team-plural')}
          </Typography>

          {isAdminUser && !isDeletedUser && (
            <PopoverTrigger isOpen={isTeamsEdit} onOpenChange={setIsTeamsEdit}>
              <WidgetEditButton
                data-testid="edit-teams-button"
                title={t('label.edit-entity', {
                  entity: t('label.team-plural'),
                })}
              />
              <Popover
                className="profile-edit-popover-card"
                containerClassName="tw:w-95 tw:p-5"
                placement="top end">
                {/* The team tree opens in its own overlay, so the card keeps a fixed height. */}
                <Box
                  className="tw:h-39"
                  data-testid="profile-teams-edit-popover"
                  direction="col"
                  gap={3}>
                  <Box align="center" gap={2}>
                    <IconTeamsGrey height={16} />
                    <Typography size="text-sm" weight="semibold">
                      {t('label.team-plural')}
                    </Typography>
                  </Box>

                  <div
                    className="border p-2 bg-gray-100 rounded-md"
                    style={{
                      borderRadius: '5px',
                    }}>
                    <TeamsSelectableNew
                      handleDropdownChange={handleDropdownChange}
                      maxValueCount={3}
                      open={isDropdownOpen}
                      ref={teamsSelectableRef}
                      selectedTeams={selectedTeams}
                      onSelectionChange={setSelectedTeams}
                    />
                  </div>

                  <Box className="tw:mt-auto" gap={2} justify="end">
                    <Button
                      aria-label={t('label.cancel')}
                      color="primary"
                      data-testid="teams-edit-close-btn"
                      iconLeading={<ClosePopoverIcon height={24} />}
                      size="xs"
                      onClick={handleCloseEditTeam}
                    />
                    <Button
                      aria-label={t('label.save')}
                      color="primary"
                      data-testid="teams-edit-save-btn"
                      iconLeading={<SavePopoverIcon height={24} />}
                      isLoading={isLoading}
                      size="xs"
                      onClick={handleTeamsSave}
                    />
                  </Box>
                </Box>
              </Popover>
            </PopoverTrigger>
          )}
        </div>
      </div>
      <div className="tw:mb-2.5 tw:flex tw:justify-start tw:gap-2">
        <div className="tw:m-0.5 tw:flex tw:items-center tw:justify-center">
          <Divider className="tw:mx-2 tw:h-full" orientation="vertical" />
        </div>
        {teamsRenderElement}
      </div>
    </div>
  );
};

export default UserProfileTeams;
