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

import { toLower } from 'lodash';
import React, { useState } from 'react';
import { Button } from '../../components/buttons/Button/Button';
import Searchbar from '../../components/common/searchbar/Searchbar';
import { EntityReference as UserTeams } from '../../generated/entity/teams/user';
import UserCard from './UserCard';

type Props = {
  searchPlaceHolder?: string;
  header: string;
  list: Array<UserTeams>;
  onCancel: () => void;
  onSave: (data: Array<UserTeams>) => void;
};

const AddUsersModal = ({
  header,
  list,
  onCancel,
  onSave,
  searchPlaceHolder,
}: Props) => {
  const [selectedUsers, setSelectedusers] = useState<Array<string>>([]);
  const [searchText, setSearchText] = useState('');

  const selectionHandler = (id: string) => {
    setSelectedusers((prevState) => {
      if (prevState.includes(id)) {
        const userArr = [...prevState];
        const index = userArr.indexOf(id);
        userArr.splice(index, 1);

        return userArr;
      } else {
        return [...prevState, id];
      }
    });
  };
  const getUserCards = () => {
    return list
      .filter((user) => {
        return (
          toLower(user.description)?.includes(toLower(searchText)) ||
          toLower(user.displayName)?.includes(toLower(searchText)) ||
          toLower(user?.name)?.includes(toLower(searchText))
        );
      })
      .map((user, index) => {
        const User = {
          description: user.displayName || user.description || '',
          name: user.name || '',
          id: user.id,
        };

        return (
          <UserCard
            isActionVisible
            isCheckBoxes
            isIconVisible
            item={User}
            key={index}
            onSelect={selectionHandler}
          />
        );
      });
  };

  const handleSave = () => {
    const users = list.filter((user) => {
      return selectedUsers.includes(user.id);
    });
    onSave(users);
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
        </div>
        <div className="tw-modal-body">
          <Searchbar
            placeholder={
              searchPlaceHolder ? searchPlaceHolder : 'Search for a user...'
            }
            searchValue={searchText}
            typingInterval={500}
            onSearch={handleSearchAction}
          />
          <div className="tw-grid tw-grid-cols-3 tw-gap-4">
            {getUserCards()}
          </div>
        </div>
        <div
          className="tw-modal-footer tw-justify-end"
          data-testid="cta-container">
          <Button
            className="tw-mr-2"
            size="regular"
            theme="primary"
            variant="text"
            onClick={onCancel}>
            Discard
          </Button>
          <Button
            data-testid="AddUserSave"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default AddUsersModal;
