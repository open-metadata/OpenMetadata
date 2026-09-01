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

import { Avatar } from '@openmetadata/ui-core-components';
import { ComponentProps } from 'react';
import { parseInt } from 'lodash';
import { ImageShape } from 'Models';
import { useMemo } from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { User } from '../../../generated/entity/teams/user';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getRandomColor } from '../../../utils/ColorUtils';
import { userPermissions } from '../../../utils/PermissionsUtils';
import Loader from '../Loader/Loader';

type UserData = Pick<User, 'name' | 'displayName'>;

type CoreAvatarSize = NonNullable<ComponentProps<typeof Avatar>['size']>;

// Maps numeric pixel width to the closest core-components Avatar size.
const WIDTH_TO_SIZE: Partial<Record<number, CoreAvatarSize>> = {
  16: 'xxs',
  18: 'xxs',
  20: 'xs',
  24: 'xs',
  28: 'xs',
  32: 'sm',
  36: 'sm',
  40: 'md',
  48: 'lg',
  56: 'xl',
  64: '2xl',
};

// Font size for initials — Avatar renders `placeholder` raw without sizing it,
// so we must size the text explicitly to match the circle.
const INITIALS_FONT_SIZE: Partial<Record<number, number>> = {
  16: 8,
  18: 8,
  20: 10,
  24: 10,
  28: 11,
  32: 12,
  36: 13,
  40: 14,
  48: 16,
  56: 18,
  64: 22,
};

interface Props extends UserData {
  width?: string;
  type?: ImageShape;
  className?: string;
  height?: string;
  isTeam?: boolean;
  avatarType?: 'solid' | 'outlined';
}

const ProfilePicture = ({
  name,
  displayName,
  className = '',
  width = '36',
  isTeam = false,
  avatarType = 'outlined',
}: Props) => {
  const { permissions } = usePermissionProvider();
  const avatarName = displayName ?? name ?? '';
  const numericWidth = parseInt(width) || 36;
  const avatarSize: CoreAvatarSize = WIDTH_TO_SIZE[numericWidth] ?? 'sm';
  const { color, character, backgroundColor } = getRandomColor(avatarName);
  const isSolid = avatarType === 'solid';
  const initialsSize =
    INITIALS_FONT_SIZE[numericWidth] ?? Math.round(numericWidth * 0.38);

  const viewUserPermission = useMemo(() => {
    return userPermissions.hasViewPermissions(ResourceEntity.USER, permissions);
  }, [permissions]);

  const [profileURL, isPicLoading] = useUserProfile({
    permission: viewUserPermission,
    name,
    isTeam,
  });

  const placeholder = isPicLoading && !profileURL ? (
    <Loader
      size={numericWidth <= 24 ? 'x-small' : 'small'}
      type={isSolid ? 'white' : 'default'}
    />
  ) : (
    <span
      style={{
        color: isSolid ? '#fff' : color,
        fontSize: initialsSize,
        fontWeight: isSolid ? 400 : 500,
      }}>
      {character}
    </span>
  );

  return (
    <Avatar
      className={className}
      contrastBorder={!isSolid}
      data-testid="profile-avatar"
      placeholder={placeholder}
      size={avatarSize}
      src={profileURL || undefined}
      style={{
        backgroundColor: isSolid ? color : backgroundColor,
      }}
    />
  );
};

export default ProfilePicture;
