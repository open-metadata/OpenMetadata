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
import React from 'react';
import Avatar from '../common/avatar/Avatar';

type Item = {
  description: string;
  name: string;
  id?: string;
  email: string;
  isActiveUser: boolean;
  profilePhoto: string;
  teamCount: number;
};

type Props = {
  item: Item;
  onClick: (value: string) => void;
};

const UserDataCard = ({ item, onClick }: Props) => {
  return (
    <div
      className="tw-card tw-flex tw-gap-1 tw-py-2 tw-px-3 tw-group"
      data-testid="user-card-container">
      {item.profilePhoto ? (
        <div className="tw-h-9 tw-w-9">
          <img
            alt="profile"
            className="tw-rounded-full tw-w-full"
            src={item.profilePhoto}
          />
        </div>
      ) : (
        <Avatar name={item.description} />
      )}

      <div
        className="tw-flex tw-flex-col tw-flex-1 tw-pl-2"
        data-testid="data-container">
        <div className="tw-flex tw-justify-between">
          <p
            className={classNames('tw-font-normal', {
              'tw-cursor-pointer': Boolean(onClick),
            })}
            onClick={() => {
              onClick(item.id as string);
            }}>
            {item.description}
          </p>
          {!item.isActiveUser && (
            <span className="tw-text-xs tw-bg-badge tw-border tw-px-2 tw-py-0.5 tw-rounded">
              Inactive
            </span>
          )}
        </div>
        <p className="tw-truncate">{item.email}</p>
        <p>Teams: {item.teamCount}</p>
      </div>
    </div>
  );
};

export default UserDataCard;
