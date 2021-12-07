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

import React, { useState } from 'react';
import UserCard from '../../../pages/teams/UserCard';
import Searchbar from '../searchbar/Searchbar';

type Props = {
  header: string | React.ReactElement;
  list: Array<{ displayName: string; name: string; id: string }>;
  onCancel: () => void;
};

const FollowersModal = ({ header, list, onCancel }: Props) => {
  const [searchText, setSearchText] = useState('');

  const getUserCards = () => {
    return list
      .filter((user) => {
        return (
          user.displayName?.includes(searchText) ||
          user.name.includes(searchText)
        );
      })
      .map((user, index) => {
        const User = {
          description: user.displayName,
          name: user.name,
          id: user.id,
        };

        return <UserCard isIconVisible item={User} key={index} />;
      });
  };

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  return (
    <dialog className="tw-modal " data-testid="modal-container">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-max-h-90vh tw-max-w-3xl">
        <div className="tw-modal-header">
          <p className="tw-modal-title" data-testid="header">
            {header}
          </p>
          <div className="tw-flex">
            <svg
              className="tw-w-6 tw-h-6 tw-ml-1 tw-cursor-pointer"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              onClick={onCancel}>
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>
        <div className="tw-modal-body">
          <Searchbar
            placeholder="Search for followers..."
            searchValue={searchText}
            typingInterval={1500}
            onSearch={handleSearchAction}
          />
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            {getUserCards()}
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default FollowersModal;
