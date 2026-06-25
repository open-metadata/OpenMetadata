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

import { Avatar } from '@openmetadata/ui-core-components';
import { CSSProperties, useMemo } from 'react';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { User } from '../../../../generated/entity/teams/user';
import { useUserProfile } from '../../../../hooks/user-profile/useUserProfile';
import { getRandomColor } from '../../../../utils/ColorUtils';
import { userPermissions } from '../../../../utils/PermissionsUtils';
import Loader from '../../Loader/Loader';

type UserData = Pick<User, 'name' | 'displayName'>;

interface ProfilePictureProps extends UserData {
  size?: number;
  isTeam?: boolean;
  avatarType?: 'solid' | 'outlined';
  style?: CSSProperties;
}

const ProfilePicture = ({
  name,
  displayName,
  size = 36,
  isTeam = false,
  avatarType = 'outlined',
  style,
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

  const isSolid = avatarType === 'solid';

  const rootStyle: CSSProperties = {
    width: size,
    height: size,
    color: isSolid ? '#fff' : color,
    backgroundColor: isSolid ? color : backgroundColor,
    fontWeight: isSolid ? 400 : 500,
    border: isSolid ? 'none' : `0.5px solid ${color}`,
    ...style,
  };

  if (profileURL) {
    return (
      <Avatar
        contrastBorder={false}
        placeholder={<span style={{ fontSize: size * 0.55 }}>{character}</span>}
        size="md"
        src={profileURL}
        style={rootStyle}
      />
    );
  }

  if (isPicLoading) {
    return (
      <Avatar
        contrastBorder={false}
        placeholder={
          <Loader
            size={size >= 24 ? 'small' : 'x-small'}
            type={isSolid ? 'white' : 'default'}
          />
        }
        size="md"
        style={rootStyle}
      />
    );
  }

  return (
    <Avatar
      contrastBorder={false}
      placeholder={<span style={{ fontSize: size * 0.55 }}>{character}</span>}
      size="md"
      style={rootStyle}
    />
  );
};

export default ProfilePicture;
