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

import { Avatar, CircularProgress, SxProps, Theme } from '@mui/material';
import { useMemo } from 'react';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { User } from '../../../../generated/entity/teams/user';
import { useUserProfile } from '../../../../hooks/user-profile/useUserProfile';
import { getRandomColor } from '../../../../utils/CommonUtils';
import { userPermissions } from '../../../../utils/PermissionsUtils';

type UserData = Pick<User, 'name' | 'displayName'>;

interface ProfilePictureProps extends UserData {
  size?: number;
  isTeam?: boolean;
  avatarType?: 'solid' | 'outlined';
  sx?: SxProps<Theme>;
}

const ProfilePicture = ({
  name,
  displayName,
  size = 36,
  isTeam = false,
  avatarType = 'outlined',
  sx,
}: ProfilePictureProps) => {
  const { permissions } = usePermissionProvider();
  const { color, character, backgroundColor } = getRandomColor(
    displayName ?? name
  );

  const viewUserPermission = useMemo(() => {
    return userPermissions.hasViewPermissions(ResourceEntity.USER, permissions);
  }, [permissions]);

  const [profileURL, isPicLoading] = useUserProfile({
    permission: viewUserPermission,
    name,
    isTeam,
  });

  const getAvatarStyles = (): SxProps<Theme> => ({
    width: size,
    height: size,
    fontSize: size * 0.55,
    color: avatarType === 'solid' ? '#fff' : color,
    bgcolor: avatarType === 'solid' ? color : backgroundColor,
    fontWeight: avatarType === 'solid' ? 400 : 500,
    border: avatarType === 'solid' ? 'none' : `0.5px solid ${color}`,
    ...sx,
  });

  if (profileURL) {
    return (
      <Avatar
        src={profileURL}
        sx={{
          width: size,
          height: size,
          ...sx,
        }}
      />
    );
  }

  if (isPicLoading) {
    return (
      <Avatar sx={getAvatarStyles()}>
        <CircularProgress
          size={size * 0.6}
          sx={{
            color: avatarType === 'solid' ? '#fff' : color,
          }}
        />
      </Avatar>
    );
  }

  return <Avatar sx={getAvatarStyles()}>{character}</Avatar>;
};

export default ProfilePicture;
