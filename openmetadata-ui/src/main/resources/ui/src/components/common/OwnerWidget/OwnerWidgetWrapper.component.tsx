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

import DropDownList from 'components/dropdown/DropDownList';
import { WILD_CARD_CHAR } from 'constants/char.constants';
import { Table } from 'generated/entity/data/table';
import { EntityReference } from 'generated/type/entityReference';
import { debounce, isEqual, lowerCase } from 'lodash';
import { LoadingState } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getOwnerList, OwnerItem } from 'utils/ManageUtils';
import { searchFormattedUsersAndTeams } from 'utils/UserDataUtils';
import './OwnerWidgetWrapper.style.less';

interface OwnerWidgetWrapperProps {
  currentOwner?: Table['owner'];
  updateUser?: (value: Table['owner']) => void;
  visible: boolean;
  currentUser?: EntityReference;
  allowTeamOwner?: boolean;
  hideWidget: () => void;
  removeOwner?: () => void;
}

const OwnerWidgetWrapper = ({
  visible = false,
  currentOwner,
  updateUser,
  allowTeamOwner = true,
  currentUser,
  hideWidget,
  removeOwner,
}: OwnerWidgetWrapperProps) => {
  const [statusOwner, setStatusOwner] = useState<LoadingState>('initial');

  const [ownersList, setOwnersList] = useState<OwnerItem[]>([]);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true);
  const [owner, setOwner] = useState(currentUser);

  const [searchText, setSearchText] = useState<string>('');

  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [totalTeamsCount, setTotalTeamsCount] = useState<number>(0);

  const getOwnerSearch = useCallback(
    (searchQuery = WILD_CARD_CHAR, from = 1) => {
      setIsUserLoading(true);
      searchFormattedUsersAndTeams(searchQuery, from)
        .then((res) => {
          const { users, teams, teamsTotal, usersTotal } = res;
          setTotalTeamsCount(teamsTotal ?? 0);
          setTotalUsersCount(usersTotal ?? 0);
          setOwnersList(getOwnerList(users, teams, false));
        })
        .catch(() => {
          setOwnersList([]);
        })
        .finally(() => {
          setIsUserLoading(false);
        });
    },
    [setOwnersList, setIsUserLoading]
  );

  const debouncedOnChange = useCallback(
    (text: string): void => {
      getOwnerSearch(text || WILD_CARD_CHAR);
    },
    [getOwnerSearch]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 400), [
    debouncedOnChange,
  ]);

  const prepareOwner = (updatedOwner?: EntityReference) => {
    return !isEqual(updatedOwner, currentUser) ? updatedOwner : undefined;
  };

  const handleOwnerSelection = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value = ''
  ) => {
    const owner = ownersList.find((item) => item.value === value);

    if (owner) {
      const newOwner = prepareOwner({
        type: owner.type,
        id: owner.value as string,
      });
      if (newOwner) {
        const updatedData = {
          ...currentOwner,
          ...newOwner,
        };
        updateUser && updateUser(updatedData);
      }
    }
    hideWidget();
  };

  const setInitialOwnerLoadingState = () => {
    setStatusOwner('initial');
  };

  const handleOwnerSearch = (text: string) => {
    setSearchText(text);
    debounceOnSearch(text);
  };

  /**
   *
   * @param groupName users|teams
   * @returns total count for respective group
   */
  const handleTotalCountForGroup = (groupName: string) => {
    if (lowerCase(groupName) === 'users') {
      return totalUsersCount;
    } else if (lowerCase(groupName) === 'teams') {
      return totalTeamsCount;
    } else {
      return 0;
    }
  };

  useEffect(() => {
    if (visible) {
      handleOwnerSearch(searchText ?? '');
    }
  }, [visible, searchText]);

  const ownerGroupList = useMemo(() => {
    return allowTeamOwner ? ['Teams', 'Users'] : ['Users'];
  }, [allowTeamOwner]);

  const handleSearchOwnerDropdown = (text: string) => {
    setSearchText(text);
    debounceOnSearch(text);
  };

  const handleRemoveOwner = () => {
    if (removeOwner) {
      removeOwner();
      hideWidget();
    }
  };

  useEffect(() => {
    if (statusOwner === 'waiting') {
      setStatusOwner('success');
      setTimeout(() => {
        setInitialOwnerLoadingState();
      }, 300);
    }
    setOwner(currentUser);
  }, [currentUser]);

  return visible ? (
    <DropDownList
      showEmptyList
      showSearchBar
      className="edit-owner-dropdown"
      controlledSearchStr={searchText}
      dropDownList={ownersList}
      getTotalCountForGroup={handleTotalCountForGroup}
      groupType={ownerGroupList.length > 1 ? 'tab' : 'label'}
      isLoading={isUserLoading}
      listGroups={ownerGroupList}
      removeOwner={handleRemoveOwner}
      value={owner?.id || ''}
      onSearchTextChange={handleSearchOwnerDropdown}
      onSelect={handleOwnerSelection}
    />
  ) : null;
};

export default OwnerWidgetWrapper;
