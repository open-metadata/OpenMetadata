/*
 *  Copyright 2025 Collate.
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
import { Box, Divider, IconButton, useTheme } from '@mui/material';
import classNames from 'classnames';
import { ReactNode } from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/type';
import { OwnerTeamList } from '../OwnerTeamList/OwnerTeamList.component';
import OwnerUserList from '../OwnerUserList/OwnerUserList.component';

interface OwnerUserTeamListProps {
  owners: EntityReference[];
  hasPermission?: boolean;
  isAssignee?: boolean;
  onEditClick?: () => void;
  avatarSize: number;
  className?: string;
  isCompactView: boolean;
  ownerDisplayName?: Map<string, ReactNode>;
  placement?: 'vertical' | 'horizontal';
}

const OwnerUserTeamList = ({
  owners,
  hasPermission,
  onEditClick,
  avatarSize,
  className,
  isAssignee,
  isCompactView,
  ownerDisplayName,
  placement = 'horizontal',
}: OwnerUserTeamListProps) => {
  const theme = useTheme();
  const showMultipleTypeTeam = owners.filter(
    (owner) => owner.type === OwnerType.TEAM
  );
  const showMultipleTypeUser = owners.filter(
    (owner) => owner.type === OwnerType.USER
  );

  return (
    <Box
      className={classNames(className)}
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: placement === 'vertical' ? 'flex-start' : 'center',
        flexDirection: placement === 'vertical' ? 'column' : 'row',
        gap: placement === 'vertical' ? '8px' : '0',
      }}>
      <OwnerUserList
        avatarSize={avatarSize}
        className={className}
        isCompactView={isCompactView}
        maxVisibleOwners={2}
        ownerDisplayName={ownerDisplayName}
        owners={showMultipleTypeUser}
      />

      {placement === 'horizontal' && (
        <Divider
          flexItem
          orientation="vertical"
          sx={{
            margin: '0 10px',
            background: theme.palette.allShades.blueGray[100],
          }}
          variant="middle"
        />
      )}

      <OwnerTeamList
        avatarSize={avatarSize}
        ownerDisplayName={ownerDisplayName}
        owners={showMultipleTypeTeam}
        placement={placement}
      />

      {hasPermission && isAssignee && (
        <IconButton
          data-testid="edit-assignees"
          size="small"
          sx={{ padding: 0, marginLeft: '8px' }}
          onClick={onEditClick}>
          <EditIcon style={{ width: '14px', height: '14px' }} />
        </IconButton>
      )}
    </Box>
  );
};

export default OwnerUserTeamList;
