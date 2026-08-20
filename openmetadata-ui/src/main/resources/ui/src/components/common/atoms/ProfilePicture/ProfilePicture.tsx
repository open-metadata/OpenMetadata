/*
 *  Copyright 2024 Collate.
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

import { Avatar, Typography } from '@openmetadata/ui-core-components';
import { ComponentProps, useMemo } from 'react';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { User } from '../../../../generated/entity/teams/user';
import { useUserProfile } from '../../../../hooks/user-profile/useUserProfile';
import {
  getAvatarColorClass,
  getFirstAlphanumeric,
} from '../../../../utils/ColorUtils';
import { userPermissions } from '../../../../utils/PermissionsUtils';
import Loader from '../../Loader/Loader';

type UserData = Pick<User, 'name' | 'displayName'>;
type AvatarSize = NonNullable<ComponentProps<typeof Avatar>['size']>;

interface ProfilePictureProps extends UserData {
  size?: AvatarSize;
  isTeam?: boolean;
  avatarType?: 'solid' | 'outlined';
}

// Typography size per ui-core avatar size (mirrors the library's own
// `initials` sizing — we render a custom-colored initial, so we size it here).
type TypographySize = NonNullable<ComponentProps<typeof Typography>['size']>;

const AVATAR_INITIAL_SIZE: Record<AvatarSize, TypographySize> = {
  xxs: 'text-xs',
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-md',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'display-xs',
};

const SMALL_LOADER_SIZES: AvatarSize[] = ['xxs', 'xs'];

const ProfilePicture = ({
  name,
  displayName,
  size = 'md',
  isTeam = false,
  avatarType = 'outlined',
}: ProfilePictureProps) => {
  const { permissions } = usePermissionProvider();

  const isSolid = avatarType === 'solid';
  const avatarName = displayName ?? name;
  const character = getFirstAlphanumeric(avatarName).toUpperCase();
  const { container, text } = getAvatarColorClass(avatarName, isSolid);

  const viewUserPermission = useMemo(() => {
    return userPermissions.hasViewPermissions(ResourceEntity.USER, permissions);
  }, [permissions]);

  const [profileURL, isPicLoading] = useUserProfile({
    permission: viewUserPermission,
    name,
    isTeam,
  });

  const placeholder =
    !profileURL && isPicLoading ? (
      <Loader
        size={SMALL_LOADER_SIZES.includes(size) ? 'x-small' : 'small'}
        type={isSolid ? 'white' : 'default'}
      />
    ) : (
      <Typography
        as="span"
        className={text}
        size={AVATAR_INITIAL_SIZE[size]}
        weight={isSolid ? 'regular' : 'medium'}>
        {character}
      </Typography>
    );

  return (
    <Avatar
      className={container}
      contrastBorder={false}
      placeholder={placeholder}
      size={size}
      src={profileURL || undefined}
    />
  );
};

export default ProfilePicture;
