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

import classNames from 'classnames';
import { observer } from 'mobx-react';
import { ImageShape } from 'Models';
import React, { useMemo } from 'react';
import { EntityReference, User } from '../../../generated/entity/teams/user';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { getEntityName } from '../../../utils/EntityUtils';
import { userPermissions } from '../../../utils/PermissionsUtils';
import Loader from '../../Loader/Loader';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../PermissionProvider/PermissionProvider.interface';
import Avatar from '../avatar/Avatar';

type UserData = Pick<User, 'name' | 'displayName'>;

interface Props extends UserData {
  width?: string;
  type?: ImageShape;
  textClass?: string;
  className?: string;
  height?: string;
  profileImgClasses?: string;
}

const ProfilePicture = ({
  name,
  displayName,
  className = '',
  textClass = '',
  type = 'circle',
  width = '36',
  height,
  profileImgClasses,
}: Props) => {
  const { permissions } = usePermissionProvider();

  const viewUserPermission = useMemo(() => {
    return userPermissions.hasViewPermissions(ResourceEntity.USER, permissions);
  }, [permissions]);

  const [profileURL, isPicLoading] = useUserProfile({
    permission: viewUserPermission,
    name,
  });

  const getAvatarByName = () => {
    return (
      <Avatar
        className={className}
        height={height}
        name={getEntityName({ name, displayName } as EntityReference)}
        textClass={textClass}
        type={type}
        width={width}
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
    <div
      className={classNames('profile-image', type, className)}
      style={{ height: `${height || width}px`, width: `${width}px` }}>
      <img
        alt="user"
        className={profileImgClasses}
        data-testid="profile-image"
        referrerPolicy="no-referrer"
        src={profileURL}
      />
    </div>
  ) : (
    getAvatarElement()
  );
};

export default observer(ProfilePicture);
