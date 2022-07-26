import { AxiosError } from 'axios';
import { lowerCase } from 'lodash';
import React, { useEffect, useState } from 'react';
import { getTeams } from '../../../axiosAPIs/teamsAPI';
import { getUsers } from '../../../axiosAPIs/userAPI';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import jsonData from '../../../jsons/en';
import { showErrorToast } from '../../../utils/ToastUtils';
import { isCurrentUserAdmin } from '../../../utils/UserDataUtils';
import DropDownList from '../../dropdown/DropDownList';
import { Status } from '../../ManageTab/ManageTab.interface';
import './OwnerWidgetWrapper.module.css';

interface OwnerWidgetWrapperProps {
  currentOwner?: Table['owner'];
  isListLoading?: boolean;
  visible: boolean;
  currentUser?: EntityReference;
  allowTeamOwner?: boolean;
  ownerSearchText: string;
  handleSearchOwnerDropdown: (text: string) => void;
  handleSelectOwnerDropdown: () => void;
  handleOwnerSelection: (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string | undefined
  ) => void;
  listOwners: {
    name: string;
    value: string;
    group: string;
    type: string;
  }[];
  owner?: EntityReference;
  ownerName: string;
  statusOwner: Status;
  teamJoinable?: boolean;
  isJoinableActionAllowed: boolean;
  hideWidget: () => void;
  updateUser?: (value: Table['owner']) => void;
}

const OwnerWidgetWrapper = ({
  visible = false,
  allowTeamOwner = true,
  ownerSearchText,
  isListLoading,
  handleSearchOwnerDropdown,
  handleOwnerSelection,
  listOwners,
  owner,
}: OwnerWidgetWrapperProps) => {
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [totalTeamsCount, setTotalTeamsCount] = useState<number>(0);

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

  const getOwnerGroup = () => {
    return allowTeamOwner ? ['Teams', 'Users'] : ['Users'];
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

  return visible ? (
    <DropDownList
      showEmptyList
      className="dropdown"
      controlledSearchStr={ownerSearchText}
      dropDownList={listOwners}
      getTotalCountForGroup={handleTotalCountForGroup}
      groupType="tab"
      isLoading={isListLoading}
      listGroups={getOwnerGroup()}
      showSearchBar={isCurrentUserAdmin()}
      value={owner?.id || ''}
      onSearchTextChange={handleSearchOwnerDropdown}
      onSelect={handleOwnerSelection}
    />
  ) : null;
};

export default OwnerWidgetWrapper;
