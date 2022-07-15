import { AxiosError } from 'axios';
import { debounce, isEqual, lowerCase } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import appState from '../../../AppState';
import { getTeams } from '../../../axiosAPIs/teamsAPI';
import { getUsers } from '../../../axiosAPIs/userAPI';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import jsonData from '../../../jsons/en';
import { getOwnerList } from '../../../utils/ManageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  isCurrentUserAdmin,
  searchFormattedUsersAndTeams,
  suggestFormattedUsersAndTeams,
} from '../../../utils/UserDataUtils';
import DropDownList from '../../dropdown/DropDownList';
import { Status } from '../../ManageTab/ManageTab.interface';
import './OwnerWidgetWrapper.module.css';

interface OwnerWidgetWrapperProps {
  currentOwner?: Table['owner'];
  updateUser?: (value: Table['owner']) => void;
  isListLoading?: boolean;
  visible: boolean;
  currentUser?: EntityReference;
  allowTeamOwner?: boolean;
  hideWidget: () => void;
}

const OwnerWidgetWrapper = ({
  visible,
  currentOwner,
  updateUser,
  allowTeamOwner = true,
  currentUser,
  hideWidget,
}: OwnerWidgetWrapperProps) => {
  const [statusOwner, setStatusOwner] = useState<Status>('initial');

  const [listOwners, setListOwners] = useState(getOwnerList());
  const [isUserLoading, setIsUserLoading] = useState<boolean>(false);
  const [owner, setOwner] = useState(currentUser);

  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [totalTeamsCount, setTotalTeamsCount] = useState<number>(0);

  const [searchText, setSearchText] = useState<string>('');

  const fetchTeamsAndUsersCount = () => {
    getUsers('', 0)
      .then((res) => {
        if (res.data) {
          setTotalUsersCount(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setTotalTeamsCount(0);
      });

    getTeams('', 0)
      .then((res) => {
        if (res.data) {
          setTotalTeamsCount(res.data.paging.total);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
        setTotalTeamsCount(0);
      });
  };

  useEffect(() => {
    fetchTeamsAndUsersCount();
  }, []);

  const getOwnerSuggestion = useCallback(
    (qSearchText = '') => {
      setIsUserLoading(true);
      suggestFormattedUsersAndTeams(qSearchText)
        .then((res) => {
          const { users, teams } = res;
          setListOwners(getOwnerList(users, teams));
        })
        .catch(() => {
          setListOwners([]);
        })
        .finally(() => {
          setIsUserLoading(false);
        });
    },
    [setListOwners, setIsUserLoading]
  );

  const getOwnerSearch = useCallback(
    (searchQuery = WILD_CARD_CHAR, from = 1) => {
      setIsUserLoading(true);
      searchFormattedUsersAndTeams(searchQuery, from)
        .then((res) => {
          const { users, teams } = res;
          setListOwners(getOwnerList(users, teams));
        })
        .catch(() => {
          setListOwners([]);
        })
        .finally(() => {
          setIsUserLoading(false);
        });
    },
    [setListOwners, setIsUserLoading]
  );

  const debouncedOnChange = useCallback(
    (text: string): void => {
      if (text) {
        getOwnerSuggestion(text);
      } else {
        getOwnerSearch();
      }
    },
    [getOwnerSuggestion, getOwnerSearch]
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
    const owner = listOwners.find((item) => item.value === value);

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

  useEffect(() => {
    if (!visible) {
      handleOwnerSearch('');
    }
  }, [visible]);

  useEffect(() => {
    setOwner(currentUser);
  }, [currentUser]);

  useEffect(() => {
    debounceOnSearch(searchText);
  }, [appState.users, appState.userDetails, appState.userTeams]);

  const getOwnerGroup = () => {
    return allowTeamOwner ? ['Teams', 'Users'] : ['Users'];
  };

  const handleSearchOwnerDropdown = (text: string) => {
    setSearchText(text);
    debounceOnSearch(text);
  };

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
    if (statusOwner === 'waiting') {
      setStatusOwner('success');
      setTimeout(() => {
        setInitialOwnerLoadingState();
      }, 300);
    }
  }, [currentUser]);

  return visible ? (
    <DropDownList
      className="dropdown"
      dropDownList={listOwners}
      getTotalCountForGroup={handleTotalCountForGroup}
      groupType="tab"
      isLoading={isUserLoading}
      listGroups={getOwnerGroup()}
      showSearchBar={isCurrentUserAdmin()}
      value={owner?.id || ''}
      onSearchTextChange={handleSearchOwnerDropdown}
      onSelect={handleOwnerSelection}
    />
  ) : null;
};

export default OwnerWidgetWrapper;
