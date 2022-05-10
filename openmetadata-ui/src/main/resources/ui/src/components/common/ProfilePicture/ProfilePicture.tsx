/*
 *  Copyright 2021 Collate
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
import AppState from '../../../AppState';
import { EntityReference, User } from '../../../generated/entity/teams/user';
import { getEntityName } from '../../../utils/CommonUtils';
import { getUserProfilePic } from '../../../utils/UserDataUtils';
import Loader from '../../Loader/Loader';
import Avatar from '../avatar/Avatar';

type UserData = Pick<User, 'id' | 'name' | 'displayName'>;

interface Props extends UserData {
  width?: string;
  type?: ImageShape;
  textClass?: string;
  className?: string;
}

const ProfilePicture = ({
  id,
  name,
  displayName,
  className = '',
  textClass = '',
  type = 'square',
  width = '36',
}: Props) => {
  const profilePic = useMemo(() => {
    return getUserProfilePic(id, name);
  }, [id, name, AppState.userProfilePics]);

  const isPicLoading = useMemo(() => {
    return AppState.isProfilePicLoading(id, name);
  }, [id, name, AppState.userProfilePicsLoading]);

  const getAvatarByName = () => {
    return (
      <Avatar
        className={className}
        name={getEntityName({ name, displayName } as EntityReference)}
        textClass={textClass}
        type={type}
        width={width}
      />
    );
  };

  return profilePic ? (
    <div
      className={classNames('profile-image', type)}
      style={{ height: `${width}px`, width: `${width}px` }}>
      <img alt="user" referrerPolicy="no-referrer" src={profilePic} />
    </div>
  ) : isPicLoading ? (
    <div
      className="tw-inline-block tw-relative"
      style={{ height: `${width}px`, width: `${width}px` }}>
      {getAvatarByName()}
      <div className="tw-absolute tw-inset-0 tw-opacity-60 tw-bg-grey-backdrop tw-rounded">
        <Loader
          className="tw-absolute tw-inset-0"
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

export default observer(ProfilePicture);
