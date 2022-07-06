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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { isUndefined, lowerCase } from 'lodash';
import React, { Fragment } from 'react';
import { ADMIN_ONLY_ACCESSIBLE_SECTION } from '../../../enums/common.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference } from '../../../generated/type/entityReference';
import { useAuth } from '../../../hooks/authHooks';
import { hasEditAccess } from '../../../utils/CommonUtils';
import { getTitleCase } from '../../../utils/EntityUtils';
import { isCurrentUserAdmin } from '../../../utils/UserDataUtils';
import { Button } from '../../buttons/Button/Button';
import DropDownList from '../../dropdown/DropDownList';
import Loader from '../../Loader/Loader';
import { Status } from '../../ManageTab/ManageTab.interface';
import NonAdminAction from '../non-admin-action/NonAdminAction';
import ToggleSwitchV1 from '../toggle-switch/ToggleSwitchV1';

interface OwnerWidgetProps {
  isJoinableActionAllowed: boolean;
  hasEditAccess: boolean;
  isAuthDisabled: boolean;
  listVisible: boolean;
  teamJoinable?: boolean;
  allowTeamOwner?: boolean;
  ownerName: string;
  entityType?: string;
  manageSectionType?: string;
  statusOwner: Status;
  owner?: EntityReference;
  listOwners: {
    name: string;
    value: string;
    group: string;
    type: string;
  }[];
  isListLoading: boolean;
  ownerSearchText: string;
  handleIsJoinable?: (bool: boolean) => void;
  handleSelectOwnerDropdown: () => void;
  handleOwnerSelection: (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string | undefined
  ) => void;
  handleSearchOwnerDropdown: (text: string) => void;
}

const OwnerWidget = ({
  manageSectionType,
  isJoinableActionAllowed,
  teamJoinable,
  isAuthDisabled,
  ownerName,
  entityType,
  listVisible,
  owner,
  allowTeamOwner,
  statusOwner,
  listOwners,
  isListLoading,
  ownerSearchText,
  handleIsJoinable,
  handleSelectOwnerDropdown,
  handleOwnerSelection,
  handleSearchOwnerDropdown,
}: OwnerWidgetProps) => {
  const { userPermissions, isAdminUser } = useAuth();

  const getOwnerGroup = () => {
    return allowTeamOwner ? ['Teams', 'Users'] : ['Users'];
  };

  const getOwnerUpdateLoader = () => {
    switch (statusOwner) {
      case 'waiting':
        return (
          <Loader
            className="tw-inline-block tw-ml-2"
            size="small"
            style={{ marginBottom: '-4px' }}
            type="default"
          />
        );

      case 'success':
        return <FontAwesomeIcon className="tw-ml-2" icon="check" />;

      default:
        return <></>;
    }
  };

  const isOwnerEditable = () => {
    if (!isAuthDisabled && !isAdminUser) {
      if (ownerName) {
        return hasEditAccess(owner?.type || '', owner?.id || '');
      } else {
        if (
          Object.values(ADMIN_ONLY_ACCESSIBLE_SECTION).find(
            (s) => s === lowerCase(manageSectionType)
          )
        ) {
          return false;
        }

        return userPermissions[Operation.EditOwner];
      }
    }

    return true;
  };

  const ownerDescription =
    entityType === 'team'
      ? 'The owner of the team can manage the team by adding or removing users. Add or update Team ownership here'
      : `Add or update ${getTitleCase(entityType)} ownership here`;

  return (
    <Fragment>
      <div className="tw-mt-1 tw-bg-white">
        <div className="tw-border tw-border-main tw-rounded tw-mt-3 tw-shadow">
          <div className="tw-flex tw-justify-between tw-items-center tw-px-5 tw-py-3">
            <div className="tw-w-10/12">
              <p className="tw-text-sm tw-mb-1 tw-font-medium">Owner</p>
              <p className="tw-text-grey-muted tw-text-xs">
                {ownerDescription}
              </p>
            </div>

            <span className="tw-relative">
              <NonAdminAction
                html={
                  <Fragment>
                    <p>You do not have permissions to update the owner.</p>
                  </Fragment>
                }
                isOwner={isOwnerEditable()}
                position="left">
                <Button
                  className="tw-underline"
                  data-testid="owner-dropdown"
                  disabled={!isOwnerEditable()}
                  size="custom"
                  theme="primary"
                  variant="link"
                  onClick={handleSelectOwnerDropdown}>
                  {ownerName ? (
                    <span
                      className={classNames('tw-truncate', {
                        'tw-w-52': ownerName.length > 32,
                      })}
                      title={ownerName}>
                      {ownerName}
                    </span>
                  ) : (
                    'Add Owner'
                  )}
                  {getOwnerUpdateLoader()}
                </Button>
              </NonAdminAction>
              {listVisible && (
                <DropDownList
                  horzPosRight
                  showEmptyList
                  controlledSearchStr={ownerSearchText}
                  dropDownList={listOwners}
                  groupType="tab"
                  isLoading={isListLoading}
                  listGroups={getOwnerGroup()}
                  showSearchBar={isCurrentUserAdmin()}
                  value={owner?.id || ''}
                  onSearchTextChange={handleSearchOwnerDropdown}
                  onSelect={handleOwnerSelection}
                />
              )}
            </span>
          </div>
          {isJoinableActionAllowed && !isUndefined(teamJoinable) && (
            <div className="tw-flex tw-justify-between tw-px-5 tw-py-3 tw-border-t">
              <div className="tw-w-10/12">
                <p className="tw-text-sm tw-mb-1 tw-font-medium">
                  Open to join
                </p>
                <p className="tw-text-grey-muted tw-text-xs">
                  Turn on toggle to allow any user to join the team. To restrict
                  access, keep the toggle off
                </p>
              </div>
              <div className="tw-flex tw-items-center">
                <ToggleSwitchV1
                  checked={teamJoinable}
                  handleCheck={() => {
                    handleIsJoinable?.(!teamJoinable);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Fragment>
  );
};

export default OwnerWidget;
