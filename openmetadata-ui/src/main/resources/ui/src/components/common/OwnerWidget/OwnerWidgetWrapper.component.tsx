import { AxiosError } from 'axios';
import { debounce, isEqual, lowerCase } from 'lodash';
import { Status } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { default as AppState, default as appState } from '../../../AppState';
import { useAuthContext } from '../../../authentication/auth-provider/AuthProvider';
import { getGroupTypeTeams } from '../../../axiosAPIs/userAPI';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import { useAuth } from '../../../hooks/authHooks';
import { getEntityName } from '../../../utils/CommonUtils';
import { getOwnerList } from '../../../utils/ManageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  isCurrentUserAdmin,
  searchFormattedUsersAndTeams,
} from '../../../utils/UserDataUtils';
import DropDownList from '../../dropdown/DropDownList';
import './OwnerWidgetWrapper.style.less';

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
  visible = false,
  currentOwner,
  updateUser,
  allowTeamOwner = true,
  currentUser,
  hideWidget,
}: OwnerWidgetWrapperProps) => {
  const { isAuthDisabled } = useAuthContext();
  const { isAdminUser } = useAuth();
  const [statusOwner, setStatusOwner] = useState<Status>('initial');

  const [listOwners, setListOwners] = useState<
    {
      name: string;
      value: string | undefined;
      group: string;
      type: string;
    }[]
  >([]);
  const [isUserLoading, setIsUserLoading] = useState<boolean>(true);
  const [owner, setOwner] = useState(currentUser);

  const [searchText, setSearchText] = useState<string>('');
  const userDetails = useMemo(() => {
    const userData = AppState.getCurrentUserDetails();

    return [
      {
        name: getEntityName(userData),
        value: userData?.id,
        group: 'Users',
        type: 'user',
      },
    ];
  }, [appState.users, appState.userDetails]);

  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [totalTeamsCount, setTotalTeamsCount] = useState<number>(0);

  const fetchGroupTypeTeams = async () => {
    try {
      if (listOwners.length === 0) {
        const data = await getGroupTypeTeams();
        const updatedData = data.map((team) => ({
          name: getEntityName(team),
          value: team.id,
          group: 'Teams',
          type: 'team',
        }));
        // set team count for logged in user
        setTotalTeamsCount(data.length);
        setListOwners([...updatedData, ...userDetails]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUserLoading(false);
    }
  };

  const getOwnerSearch = useCallback(
    (searchQuery = WILD_CARD_CHAR, from = 1) => {
      setIsUserLoading(true);
      searchFormattedUsersAndTeams(searchQuery, from)
        .then((res) => {
          const { users, teams, teamsTotal, usersTotal } = res;
          // set team and user count for admin user
          setTotalTeamsCount(teamsTotal ?? 0);
          setTotalUsersCount(usersTotal ?? 0);
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

  /**
   *
   * @param groupName users|teams
   * @returns total count for respective group
   */
  const handleTotalCountForGroup = (groupName: string) => {
    if (lowerCase(groupName) === 'users') {
      // if user is admin return total user count otherwise return 1
      return isAdminUser ? totalUsersCount : 1;
    } else if (lowerCase(groupName) === 'teams') {
      return totalTeamsCount;
    } else {
      return 0;
    }
  };

  useEffect(() => {
    if (visible) {
      if (isAuthDisabled || !isAdminUser) {
        fetchGroupTypeTeams();
      } else {
        handleOwnerSearch('');
      }
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      debounceOnSearch(searchText);
    }
  }, [searchText]);

  const getOwnerGroup = () => {
    return allowTeamOwner ? ['Teams', 'Users'] : ['Users'];
  };

  const handleSearchOwnerDropdown = (text: string) => {
    setSearchText(text);
    debounceOnSearch(text);
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
      className="edit-owner-dropdown"
      controlledSearchStr={searchText}
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
