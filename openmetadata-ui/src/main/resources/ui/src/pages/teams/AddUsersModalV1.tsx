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

import { Typography } from 'antd';
import { AxiosError } from 'axios';
import { toLower } from 'lodash';
import React, { useEffect, useState } from 'react';
import { getUsers } from '../../axiosAPIs/userAPI';
import { Button } from '../../components/buttons/Button/Button';
import Searchbar from '../../components/common/searchbar/Searchbar';
import Loader from '../../components/Loader/Loader';
import { API_RES_MAX_SIZE } from '../../constants/constants';
import { OwnerType } from '../../enums/user.enum';
import { EntityReference as UserTeams } from '../../generated/entity/teams/user';
import jsonData from '../../jsons/en';
import { getEntityName } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import UserCard from './UserCard';

type Props = {
  searchPlaceHolder?: string;
  header: string;
  list: Array<UserTeams>;
  onCancel: () => void;
  onSave: (data: Array<UserTeams>) => void;
};

const AddUsersModalV1 = ({
  header,
  list,
  onCancel,
  onSave,
  searchPlaceHolder,
}: Props) => {
  const [allUsers, setAllUsers] = useState<UserTeams[]>([]);
  const [uniqueUser, setUniqueUser] = useState<UserTeams[]>([]);
  const [selectedUsers, setSelectedusers] = useState<Array<string>>([]);
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Filter out the already added user and return unique user list
   * @returns - unique user list
   */
  const getUniqueUserList = () => {
    setIsLoading(true);
    const uniqueList = allUsers.filter((user) => {
      const teamUser = list.some((teamUser) => user.id === teamUser.id);

      return !teamUser && user;
    });

    setUniqueUser(uniqueList);
    setIsLoading(false);
  };

  const fetchAllUsers = async () => {
    setIsLoading(true);
    const { data } = await getUsers('', API_RES_MAX_SIZE);

    try {
      if (data) {
        // TODO: fix type issue
        setAllUsers(data as unknown as UserTeams[]);
      } else {
        throw jsonData['api-error-messages']['fetch-users-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-users-error']
      );
    }
    setIsLoading(false);
  };

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
    return uniqueUser
      .filter((user) => {
        return (
          toLower(user.description)?.includes(toLower(searchText)) ||
          toLower(user.displayName)?.includes(toLower(searchText)) ||
          toLower(user?.name)?.includes(toLower(searchText))
        );
      })
      .map((user, index) => {
        const User = {
          displayName: getEntityName(user),
          fqn: user.fullyQualifiedName || '',
          id: user.id,
          type: user.type,
          name: user.name,
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
    onSave(
      selectedUsers.map((id) => {
        return {
          id,
          type: OwnerType.USER,
        };
      })
    );
  };

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  useEffect(() => {
    if (allUsers.length > 0) {
      getUniqueUserList();
    }
  }, [allUsers]);

  useEffect(() => {
    fetchAllUsers();
  }, []);

  return (
    <dialog className="tw-modal " data-testid="modal-container">
      <div className="tw-modal-backdrop" />
      <div className="tw-modal-container tw-max-h-90vh tw-max-w-3xl">
        <div className="tw-modal-header" data-testid="header">
          <Typography.Text
            className="ant-typography-ellipsis-custom tw-modal-title"
            ellipsis={{ tooltip: true }}>
            {header}
          </Typography.Text>
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
          {isLoading ? (
            <Loader />
          ) : (
            <div className="tw-grid tw-grid-cols-3 tw-gap-4">
              {getUserCards()}
            </div>
          )}
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
            Cancel
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

export default AddUsersModalV1;
