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
import { Space, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined, toString } from 'lodash';
import React from 'react';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import './user-tag.less';
import { UserTags, UserTagSize } from './UserTag.interface';

export const UserTag = ({
  id,
  name,
  onRemove,
  closable = false,
  bordered,
  size = UserTagSize.default,
  className,
}: UserTags) => {
  if (isUndefined(id) && isUndefined(name)) {
    return null;
  }

  const width = {
    [UserTagSize.small]: 16,
    [UserTagSize.default]: 24,
    [UserTagSize.large]: 32,
  };

  const fontSizes = {
    [UserTagSize.small]: 'text-xs',
    [UserTagSize.default]: 'text-sm',
    [UserTagSize.large]: 'text-base',
  };

  return (
    <Space
      align="center"
      className={classNames(
        {
          bordered: bordered,
        },
        'user-tag',
        UserTagSize[size],
        className
      )}
      data-testid="user-tag"
      size={4}>
      <ProfilePicture id={id} name={name} width={toString(width[size])} />
      <Typography.Text className={fontSizes[size]}>{name}</Typography.Text>
      {closable && <CloseOutlined size={width[size]} onClick={onRemove} />}
    </Space>
  );
};
