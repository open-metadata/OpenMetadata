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

import { AxiosError } from 'axios';
import Loader from 'components/Loader/Loader';
import UserListV1 from 'components/UserList/UserListV1';
import React, { useEffect, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { getUsers } from 'rest/userAPI';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_MEDIUM,
  pagingObject,
} from '../../constants/constants';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { SearchIndex } from '../../enums/search.enum';
import { User } from '../../generated/entity/teams/user';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { SearchResponse } from '../../interface/search.interface';
import jsonData from '../../jsons/en';
import { formatUsersResponse } from '../../utils/APIUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const teamsAndUsers = [GlobalSettingOptions.USERS, GlobalSettingOptions.ADMINS];

const UserListPageV1 = () => {
  const { tab } = useParams<{ [key: string]: GlobalSettingOptions }>();
  const history = useHistory();
  const location = useLocation();
  const [isAdminPage, setIsAdminPage] = useState<boolean | undefined>(
    tab === GlobalSettingOptions.ADMINS || undefined
  );
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);
  const [showDeletedUser, setShowDeletedUser] = useState<boolean>(false);
  const [userList, setUserList] = useState<User[]>([]);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [searchValue, setSearchValue] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);

  const initialSetup = () => {
    setIsAdminPage(tab === GlobalSettingOptions.ADMINS || undefined);
    setIsPageLoading(true);
    setIsDataLoading(true);
    setShowDeletedUser(false);
    setSearchValue('');
    setCurrentPage(INITIAL_PAGING_VALUE);
  };

  const fetchUsersList = async (
    isAdmin: boolean | undefined = undefined,
    param = {} as Record<string, string>,
    limit = PAGE_SIZE_MEDIUM
  ) => {
    setIsDataLoading(true);
    try {
      const { data, paging } = await getUsers(
        'profile,teams,roles',
        limit,
        param,
        isAdmin,
        false
      );
      if (data) {
        setUserList(data);
        setPaging(paging);
      } else {
        throw jsonData['api-error-messages']['fetch-users-error'];
      }
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-users-error']
      );
    }
    setIsDataLoading(false);
    setIsPageLoading(false);
  };

  const handleFetch = () => {
    fetchUsersList(isAdminPage, {
      include: showDeletedUser ? Include.Deleted : Include.NonDeleted,
    });
  };

  const userQuerySearch = (
    text = WILD_CARD_CHAR,
    currentPage = 1,
    isAdmin = false,
    isDeleted = false
  ) => {
    let filters = 'isBot:false';
    if (isAdmin) {
      filters = 'isAdmin:true isBot:false';
    }

    return new Promise<Array<User>>((resolve) => {
      searchData(
        text,
        currentPage,
        PAGE_SIZE_MEDIUM,
        filters,
        '',
        '',
        SearchIndex.USER,
        isDeleted
      )
        .then((res) => {
          const data = formatUsersResponse(
            (res.data as SearchResponse<SearchIndex.USER>).hits.hits
          );
          setPaging({
            total: res.data.hits.total.value,
          });
          resolve(data);
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-users-error']
          );
          resolve([]);
        });
    });
  };

  const getSearchedUsers = (value: string, pageNumber: number) => {
    setIsDataLoading(true);

    userQuerySearch(value, pageNumber, isAdminPage, showDeletedUser).then(
      (resUsers) => {
        setUserList(resUsers as unknown as User[]);
        setIsDataLoading(false);
      }
    );
  };

  const handlePagingChange = (
    cursorValue: string | number,
    activePage?: number
  ) => {
    if (searchValue) {
      setCurrentPage(cursorValue as number);
      getSearchedUsers(searchValue, cursorValue as number);
    } else {
      setCurrentPage(activePage as number);
      fetchUsersList(isAdminPage, {
        [cursorValue]: paging[cursorValue as keyof Paging] as string,
        include: showDeletedUser ? Include.Deleted : Include.NonDeleted,
      });
    }
  };

  const handleShowDeletedUserChange = (value: boolean) => {
    setCurrentPage(INITIAL_PAGING_VALUE);
    setSearchValue('');
    setShowDeletedUser(value);
    fetchUsersList(isAdminPage, {
      include: value ? Include.Deleted : Include.NonDeleted,
    });
  };

  const handleSearch = (value: string) => {
    setSearchValue(value);
    setCurrentPage(INITIAL_PAGING_VALUE);
    const params = new URLSearchParams({ user: value });
    // This function is called onChange in the search input with debouncing
    // Hence using history.replace instead of history.push to avoid adding multiple routes in history
    history.replace({
      pathname: location.pathname,
      search: value && params.toString(),
    });
    if (value) {
      getSearchedUsers(value, INITIAL_PAGING_VALUE);
    } else {
      handleFetch();
    }
  };

  useEffect(() => {
    initialSetup();
    if (teamsAndUsers.includes(tab)) {
      // Checking if the path has search query present in it
      // if present fetch userlist with the query
      // else get list of all users
      if (location.search) {
        // Converting string to URLSearchParameter
        const searchParameter = new URLSearchParams(location.search);
        // Getting the searched name
        const userSearchTerm = searchParameter.get('user') || '';
        setSearchValue(userSearchTerm);
        getSearchedUsers(userSearchTerm, 1);
        setIsPageLoading(false);
      } else {
        fetchUsersList(tab === GlobalSettingOptions.ADMINS || undefined);
      }
    } else {
      setIsPageLoading(false);
      setIsDataLoading(false);
    }
  }, [tab]);

  if (isPageLoading) {
    return <Loader />;
  }

  return (
    <UserListV1
      afterDeleteAction={handleFetch}
      currentPage={currentPage}
      data={userList}
      isAdminPage={isAdminPage}
      isDataLoading={isDataLoading}
      paging={paging}
      searchTerm={searchValue}
      showDeletedUser={showDeletedUser}
      onPagingChange={handlePagingChange}
      onSearch={handleSearch}
      onShowDeletedUserChange={handleShowDeletedUserChange}
    />
  );
};

export default UserListPageV1;
