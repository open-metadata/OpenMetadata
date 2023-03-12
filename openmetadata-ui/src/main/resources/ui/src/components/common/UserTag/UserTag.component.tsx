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

import { Space } from 'antd';
import { isUndefined } from 'lodash';
import React from 'react';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { UserTags } from './UserTag.interface';

export const UserTag = ({ id, name }: UserTags) => {
  if (isUndefined(id) && isUndefined(name)) {
    return null;
  }

  return (
    <Space data-testid="user-tag">
      <ProfilePicture id={id} name={name} width="22" />
      <span>{name}</span>
    </Space>
  );
};
