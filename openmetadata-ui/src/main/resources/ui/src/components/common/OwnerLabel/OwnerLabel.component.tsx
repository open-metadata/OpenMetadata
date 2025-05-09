/*
 *  Copyright 2023 Collate.
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
import classNames from 'classnames';
import { reverse } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/type';
import { NoOwnerFound } from '../NoOwner/NoOwnerFound';
import { OwnerItem } from '../OwnerItem/OwnerItem';
import { OwnerReveal } from '../RemainingOwner/OwnerReveal';
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import './owner-label.less';
import { OwnerLabelProps } from './OwnerLabel.interface';

export const OwnerLabel = ({
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
  avatarSize = 32,
}: OwnerLabelProps) => {
  const { t } = useTranslation();
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const ownerElementsNonCompactView = useMemo(() => {
    if (!isCompactView) {
      if (showLabel || onUpdate) {
        return (
          <div className="d-flex items-center gap-2 m-b-xs">
            {showLabel && (
              <Typography.Text
                className={classNames(
                  'no-owner-heading font-medium text-sm',
                  className
                )}>
                {placeHolder ?? t('label.owner-plural')}
              </Typography.Text>
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

  const ownerElements = useMemo(() => {
    const hasOwners = owners && owners.length > 0;

    // Show all owners when "more" is clicked, regardless of view mode
    const visibleOwners = showAllOwners
      ? owners
      : owners.slice(0, maxVisibleOwners);
    const remainingOwnersCount = owners.length - maxVisibleOwners;
    const showMoreButton = remainingOwnersCount > 0 && !showAllOwners;

    // If no owners, render the empty state
    if (!hasOwners) {
      return (
        <NoOwnerFound
          className={className}
          hasPermission={hasPermission}
          isCompactView={isCompactView}
          multiple={multiple}
          owners={owners}
          placeHolder={placeHolder}
          showLabel={showLabel}
          tooltipText={tooltipText}
          onUpdate={onUpdate}
        />
      );
    }

    return (
      <div
        className={classNames({
          'owner-label-container d-flex flex-col items-start flex-start':
            !isCompactView,
          'd-flex owner-label-heading gap-2 items-center': isCompactView,
        })}
        data-testid="owner-label">
        {ownerElementsNonCompactView}
        <div className="d-flex items-center flex-center">
          <div
            className={classNames(
              'avatar-group w-full  d-flex relative items-center m-l-xss',
              {
                'gap-2 flex-wrap': isCompactView,
                'flex-row-reverse': !isCompactView,
                inherited: Boolean(owners.some((owner) => owner?.inherited)),
              },
              className
            )}>
            {(isCompactView ? visibleOwners : reverse(visibleOwners)).map(
              (owner: EntityReference, index: number) => (
                <div
                  className={classNames({
                    'w-full': owner.type === OwnerType.TEAM,
                  })}
                  key={owner.id}>
                  <OwnerItem
                    avatarSize={avatarSize}
                    className={className}
                    isCompactView={isCompactView}
                    owner={owner}
                    ownerDisplayName={ownerDisplayName?.[index]}
                  />
                </div>
              )
            )}
            {showMoreButton && isCompactView && (
              <OwnerReveal
                avatarSize={isCompactView ? 24 : avatarSize}
                isCompactView={isCompactView}
                isDropdownOpen={isDropdownOpen}
                owners={owners.slice(maxVisibleOwners)}
                remainingCount={remainingOwnersCount}
                setIsDropdownOpen={setIsDropdownOpen}
                setShowAllOwners={setShowAllOwners}
                showAllOwners={showAllOwners}
              />
            )}
          </div>

          {showMoreButton && !isCompactView && (
            <div className="m-l-xs">
              <OwnerReveal
                avatarSize={isCompactView ? 24 : avatarSize}
                isCompactView={isCompactView}
                isDropdownOpen={isDropdownOpen}
                owners={owners.slice(maxVisibleOwners)}
                remainingCount={remainingOwnersCount}
                setIsDropdownOpen={setIsDropdownOpen}
                setShowAllOwners={setShowAllOwners}
                showAllOwners={showAllOwners}
              />
            </div>
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
  }, [
    owners,
    className,
    onUpdate,
    hasPermission,
    showAllOwners,
    maxVisibleOwners,
    placeHolder,
    t,
    ownerDisplayName,
    isCompactView,
    isDropdownOpen,
    tooltipText,
    multiple,
    ownerElementsNonCompactView,
    avatarSize,
  ]);

  return ownerElements;
};
