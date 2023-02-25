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

import { List, Modal } from 'antd';
import { AxiosError } from 'axios';
import Searchbar from 'components/common/searchbar/Searchbar';
import { isUndefined } from 'lodash';
import VirtualList from 'rc-virtual-list';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { searchData } from 'rest/miscAPI';
import { getUsers } from 'rest/userAPI';
import {
  ADD_USER_CONTAINER_HEIGHT,
  PAGE_SIZE_MEDIUM,
  pagingObject,
} from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { OwnerType } from '../../enums/user.enum';
import {
  EntityReference as UserTeams,
  User,
} from '../../generated/entity/teams/user';
import { Paging } from '../../generated/type/paging';
import { SearchResponse } from '../../interface/search.interface';
import { formatUsersResponse } from '../../utils/APIUtils';
import { getEntityName } from '../../utils/CommonUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './AddUsersModal.less';
import UserCard from './UserCard';

type Props = {
  isVisible: boolean;
  searchPlaceHolder?: string;
  header: string;
  list: Array<UserTeams>;
  onCancel: () => void;
  onSave: (data: Array<UserTeams>) => void;
};
type UserData = {
  fqn: string;
  type: string;
  displayName: string;
  id?: string;
  name?: string;
};

const AddUsersModalV1 = ({
  isVisible,
  header,
  list,
  onCancel,
  onSave,
  searchPlaceHolder,
}: Props) => {
  const { t } = useTranslation();
  const [uniqueUser, setUniqueUser] = useState<UserData[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Array<string>>([]);
  const [searchText, setSearchText] = useState('');
  const [userPaging, setUserPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalESCount, setTotalESCount] = useState(0);

  const getFilterUserData = (data: User[]) => {
    return data
      .filter((user) => {
        const teamUser = list.some((teamUser) => user.id === teamUser.id);

        return !teamUser && user;
      })
      .map((user) => {
        return {
          displayName: getEntityName(user),
          fqn: user.fullyQualifiedName || '',
          id: user.id,
          type: OwnerType.USER,
          name: user.name,
        };
      });
  };

  const searchUsers = (text: string, page = 1) => {
    searchData(text, page, PAGE_SIZE_MEDIUM, '', '', '', SearchIndex.USER)
      .then((res) => {
        const data = getFilterUserData(
          formatUsersResponse(
            (res.data as SearchResponse<SearchIndex.USER>).hits.hits
          )
        );
        setTotalESCount(res.data.hits.total.value);
        setCurrentPage((pre) => pre + 1);
        setUniqueUser((pre) => [...pre, ...data]);
      })
      .catch(() => {
        setUniqueUser([]);
      });
  };

  const fetchAllUsers = async (param?: { after: string }) => {
    try {
      const { data, paging } = await getUsers('', PAGE_SIZE_MEDIUM, param);
      const filterData = getFilterUserData(data);
      setUniqueUser((pre) => [...pre, ...filterData]);
      setUserPaging(paging);
    } catch (error) {
      setUniqueUser([]);
      showErrorToast(
        error as AxiosError,
        t('Server.entity-fetch-error', { entity: t('label.user') })
      );
    }
  };

  const selectionHandler = (id: string) => {
    setSelectedUsers((prevState) => {
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
    setUniqueUser([]);
    setCurrentPage(1);
    setSearchText(searchValue);
    if (searchValue) {
      searchUsers(searchValue);
    } else {
      fetchAllUsers();
    }
  };
  const onScroll = (e: React.UIEvent<HTMLElement, UIEvent>) => {
    if (
      e.currentTarget.scrollHeight - e.currentTarget.scrollTop ===
      ADD_USER_CONTAINER_HEIGHT
    ) {
      if (searchText) {
        // make API call only when current page size is less then total count
        PAGE_SIZE_MEDIUM * currentPage < totalESCount &&
          searchUsers(searchText, currentPage);
      } else {
        !isUndefined(userPaging.after) &&
          fetchAllUsers({ after: userPaging.after });
      }
    }
  };

  useEffect(() => {
    fetchAllUsers();
  }, []);

  return (
    <Modal
      data-testid="modal-container"
      okButtonProps={{
        id: 'save-button',
      }}
      okText="Save"
      open={isVisible}
      title={header}
      width={750}
      onCancel={onCancel}
      onOk={handleSave}>
      <Searchbar
        placeholder={
          searchPlaceHolder
            ? searchPlaceHolder
            : t('label.search-for-type', { type: t('label.user') })
        }
        searchValue={searchText}
        typingInterval={500}
        onSearch={handleSearchAction}
      />

      <List>
        <VirtualList
          className="user-list"
          data={uniqueUser}
          height={ADD_USER_CONTAINER_HEIGHT}
          itemKey="id"
          onScroll={onScroll}>
          {(user) => (
            <UserCard
              isActionVisible
              isCheckBoxes
              isIconVisible
              item={user}
              key={user.id}
              onSelect={selectionHandler}
            />
          )}
        </VirtualList>
      </List>
    </Modal>
  );
};

export default AddUsersModalV1;
