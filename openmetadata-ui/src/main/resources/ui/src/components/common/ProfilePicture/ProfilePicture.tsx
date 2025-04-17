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

import { Avatar } from 'antd';
import classNames from 'classnames';
import { parseInt } from 'lodash';
import { ImageShape } from 'Models';
import { useMemo } from 'react';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { User } from '../../../generated/entity/teams/user';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getRandomColor } from '../../../utils/CommonUtils';
import { userPermissions } from '../../../utils/PermissionsUtils';
import Loader from '../Loader/Loader';

type UserData = Pick<User, 'name' | 'displayName'>;

interface Props extends UserData {
  width?: string;
  type?: ImageShape;
  className?: string;
  height?: string;
  isTeam?: boolean;
  size?: number | 'small' | 'default' | 'large';
  avatarType?: 'solid' | 'outlined';
}

const ProfilePicture = ({
  name,
  displayName,
  className = '',
  type = 'circle',
  width = '36',
  height,
  isTeam = false,
  size,
  avatarType = 'outlined',
}: Props) => {
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

  const getAvatarByName = () => {
    return (
      <Avatar
        className={classNames('flex-center', className)}
        data-testid="profile-avatar"
        icon={character}
        shape={type}
        size={size ?? parseInt(width)}
        style={{
          color: avatarType === 'solid' ? 'default' : color,
          backgroundColor: avatarType === 'solid' ? color : backgroundColor,
          fontWeight: avatarType === 'solid' ? 400 : 500,
          border: `0.5px solid ${avatarType === 'solid' ? 'default' : color}`,
        }}
      />
    );
  };

  const getAvatarElement = () => {
    return isPicLoading ? (
      <div
        className="d-inline-block relative"
        style={{
          height: `${height || width}px`,
          width: `${width}px`,
        }}>
        {getAvatarByName()}
        <div
          className="absolute inset-0 opacity-60 bg-grey-4 rounded-full"
          data-testid="loader-cntnr">
          <Loader
            className="absolute inset-0"
            size="small"
            style={{ height: `${+width - 2}px`, width: `${+width - 2}px` }}
            type="white"
          />
        </div>
      </div>
    ) : (
      getAvatarByName()
    );
  };

  return profileURL ? (
    <Avatar
      className={className}
      data-testid="profile-image"
      shape={type}
      size={size ?? parseInt(width)}
      src={profileURL}
    />
  ) : (
    getAvatarElement()
  );
};

export default ProfilePicture;
