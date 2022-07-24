import { debounce, isEqual } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import appState from '../../../AppState';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import { getOwnerList } from '../../../utils/ManageUtils';
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
  visible = false,
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

  const [searchText, setSearchText] = useState<string>('');

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
    if (visible) {
      handleOwnerSearch('');
    }
  }, [visible]);

  useEffect(() => {
    setOwner(currentUser);
  }, [currentUser]);

  useEffect(() => {
    visible ? debounceOnSearch(searchText) : null;
  }, [appState.users, appState.userDetails, appState.userTeams]);

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
  }, [currentUser]);

  return visible ? (
    <DropDownList
      className="dropdown"
      dropDownList={listOwners}
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
