/*
 *  Copyright 2025 Collate.
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

import { Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { OwnerType } from '../../../enums/user.enum';
import { NoOwnerFound } from '../NoOwner/NoOwnerFound';
import { OwnerTeamList } from '../OwnerTeamList/OwnerTeamList.component';
import OwnerUserList from '../OwnerUserList/OwnerUserList.component';
import OwnerUserTeamList from '../OwnerUserTeamList/OwnerUserTeamList.component';
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import './owner-label.less';
import { OwnerLabelProps } from './OwnerLabel.interface';

export const OwnerLabel = ({
  showDashPlaceholder,
  owners = [],
  showLabel = true,
  className,
  onUpdate,
  hasPermission,
  ownerDisplayName,
  placeHolder,
  maxVisibleOwners = 3, // Default to 3 if not provided
  multiple = {
    user: true,
    team: false,
  },
  tooltipText,
  isCompactView = true, // renders owner profile followed by its name
  avatarSize = 24,
  isAssignee = false,
  onEditClick,
  ownerLabelClassName,
  placement,
}: OwnerLabelProps) => {
  const { t } = useTranslation();

  const { isMultipleTeam, isMultipleUser, isMultipleUserAndTeam } =
    useMemo(() => {
      const isMultipleTeam = owners.every(
        (item) => item.type === OwnerType.TEAM
      );
      const isMultipleUser = owners.every(
        (item) => item.type === OwnerType.USER
      );

      return {
        isMultipleTeam,
        isMultipleUser,
        isMultipleUserAndTeam: !isMultipleTeam && !isMultipleUser,
      };
    }, [owners]);

  const ownerElementsNonCompactView = useMemo(() => {
    if (!isCompactView) {
      if (showLabel || onUpdate) {
        return (
          <div className="tw:flex tw:items-center tw:mb-2 tw:gap-2">
            {showLabel && (
              <Typography
                as="span"
                className={classNames(
                  className,
                  'tw:mb-0 tw:font-medium tw:text-brand-700'
                )}>
                {placeHolder ?? t('label.owner-plural')}
              </Typography>
            )}
            {onUpdate && (
              <UserTeamSelectableList
                hasPermission={Boolean(hasPermission)}
                multiple={multiple}
                owner={owners}
                tooltipText={tooltipText}
                onUpdate={onUpdate}
              />
            )}
          </div>
        );
      }
    }

    return null;
  }, [
    isCompactView,
    showLabel,
    onUpdate,
    placeHolder,
    hasPermission,
    multiple,
    owners,
    tooltipText,
    className,
  ]);

  if (isEmpty(owners)) {
    return (
      <NoOwnerFound
        className={className}
        hasPermission={hasPermission}
        isCompactView={isCompactView}
        multiple={multiple}
        owners={owners}
        placeHolder={placeHolder}
        showDashPlaceholder={showDashPlaceholder}
        showLabel={showLabel}
        tooltipText={tooltipText}
        onUpdate={onUpdate}
      />
    );
  }

  return (
    <div
      className={classNames({
        'owner-label-container tw:flex tw:flex-col tw:items-start tw:flex-start':
          !isCompactView,
        'owner-label-heading tw:flex tw:gap-2 tw:items-center': isCompactView,
      })}
      data-testid="owner-label">
      {ownerElementsNonCompactView}
      <div className="tw:flex tw:items-center tw:justify-center tw:max-w-full">
        {isMultipleUserAndTeam && (
          <OwnerUserTeamList
            avatarSize={avatarSize}
            className={className}
            hasPermission={hasPermission}
            isAssignee={isAssignee}
            isCompactView={isCompactView}
            ownerDisplayName={ownerDisplayName}
            owners={owners}
            placement={placement}
            onEditClick={onEditClick}
          />
        )}

        {isMultipleTeam && (
          <OwnerTeamList
            avatarSize={avatarSize}
            ownerDisplayName={ownerDisplayName}
            owners={owners}
          />
        )}

        {isMultipleUser && (
          <OwnerUserList
            avatarSize={avatarSize}
            className={className}
            isCompactView={isCompactView}
            maxVisibleOwners={maxVisibleOwners}
            ownerDisplayName={ownerDisplayName}
            ownerLabelClassName={ownerLabelClassName}
            owners={owners}
          />
        )}
      </div>
      {isCompactView && onUpdate && (
        <UserTeamSelectableList
          hasPermission={Boolean(hasPermission)}
          multiple={multiple}
          owner={owners}
          tooltipText={tooltipText}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
};
