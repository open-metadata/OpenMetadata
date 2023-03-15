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

import { CloseOutlined } from '@ant-design/icons';
import { Space } from 'antd';
import classNames from 'classnames';
import { isUndefined, toString } from 'lodash';
import React from 'react';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import './user-tag.less';
import { UserTags, UserTagSize } from './UserTag.interface';

export const UserTag = ({
  id,
  name,
  onClose,
  closable = false,
  bordered,
  size = UserTagSize.default,
}: UserTags) => {
  if (isUndefined(id) && isUndefined(name)) {
    return null;
  }

  let width = 24;
  if (size === UserTagSize.small) {
    width = 16;
  } else if (size === UserTagSize.large) {
    width = 32;
  }

  return (
    <Space
      align="center"
      className={classNames(
        {
          bordered: bordered,
        },
        'user-tag',
        UserTagSize[size]
      )}
      data-testid="user-tag"
      size={4}>
      <ProfilePicture id={id} name={name} width={toString(width)} />
      <span>{name}</span>
      {closable && <CloseOutlined size={width} onClick={onClose} />}
    </Space>
  );
};
