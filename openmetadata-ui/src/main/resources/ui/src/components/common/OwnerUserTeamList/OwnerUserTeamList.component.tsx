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
import { Box, ButtonUtility, Divider } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/type';
import { AvatarSize } from '../OwnerLabel/OwnerLabel.interface';
import { OwnerTeamList } from '../OwnerTeamList/OwnerTeamList.component';
import OwnerUserList from '../OwnerUserList/OwnerUserList.component';

interface OwnerUserTeamListProps {
  owners: EntityReference[];
  hasPermission?: boolean;
  isAssignee?: boolean;
  onEditClick?: () => void;
  avatarSize: AvatarSize;
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
  const showMultipleTypeTeam = owners.filter(
    (owner) => owner.type === OwnerType.TEAM
  );
  const showMultipleTypeUser = owners.filter(
    (owner) => owner.type === OwnerType.USER
  );

  return (
    <Box
      align={placement === 'vertical' ? 'start' : 'center'}
      className={`tw:w-full${className ? ` ${className}` : ''}`}
      direction={placement === 'vertical' ? 'col' : 'row'}
      gap={placement === 'vertical' ? 2 : 0}>
      <OwnerUserList
        avatarSize={avatarSize}
        className={className}
        isCompactView={isCompactView}
        maxVisibleOwners={2}
        ownerDisplayName={ownerDisplayName}
        owners={showMultipleTypeUser}
      />

      {placement === 'horizontal' && (
        <Divider className="tw:mx-[10px]" orientation="vertical" />
      )}

      <OwnerTeamList
        avatarSize={avatarSize}
        ownerDisplayName={ownerDisplayName}
        owners={showMultipleTypeTeam}
        placement={placement}
      />

      {hasPermission && isAssignee && (
        <ButtonUtility
          className="tw:p-0 tw:ml-2"
          data-testid="edit-assignees"
          icon={EditIcon}
          size="xs"
          onClick={onEditClick}
        />
      )}
    </Box>
  );
};

export default OwnerUserTeamList;
