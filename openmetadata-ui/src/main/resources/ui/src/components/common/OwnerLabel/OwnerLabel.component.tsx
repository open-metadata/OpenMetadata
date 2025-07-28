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

import { Button, Typography } from 'antd';
import classNames from 'classnames';
import { reverse } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
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
  isAssignee = false,
  onEditClick,
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

  const showMultipleTypeTeam = owners.filter(
    (owner) => owner.type === OwnerType.TEAM
  );
  const showMultipleTypeVisibleUser = owners
    .filter((owner) => owner.type === OwnerType.USER)
    .slice(0, maxVisibleOwners)
    .reverse();
  const showMultipleTypeRemainingUser = owners
    .filter((owner) => owner.type === OwnerType.USER)
    .slice(maxVisibleOwners);
  const renderMultipleType = useMemo(() => {
    return (
      <div className="flex-wrap w-max-full d-flex relative items-center">
        <div className="flex w-full gap-2 flex-wrap relative">
          {showMultipleTypeTeam.map((owner, index) => (
            <div className="w-max-full" key={owner.id}>
              <OwnerItem
                avatarSize={avatarSize}
                className={className}
                isAssignee={isAssignee}
                isCompactView={isCompactView}
                owner={owner}
                ownerDisplayName={ownerDisplayName?.[index]}
              />
            </div>
          ))}
          <div className="flex">
            <div className="flex relative m-l-xs justify-end flex-row-reverse">
              {showMultipleTypeVisibleUser.map((owner, index) => (
                <div className="relative" key={owner.id}>
                  <OwnerItem
                    avatarSize={avatarSize}
                    className={className}
                    isAssignee={isAssignee}
                    isCompactView={isCompactView}
                    owner={owner}
                    ownerDisplayName={ownerDisplayName?.[index]}
                  />
                </div>
              ))}
            </div>
            {showMultipleTypeRemainingUser.length > 0 && (
              <div className="m-l-xs">
                <OwnerReveal
                  avatarSize={isCompactView ? 24 : avatarSize}
                  isCompactView={false}
                  isDropdownOpen={isDropdownOpen}
                  owners={showMultipleTypeRemainingUser}
                  remainingCount={showMultipleTypeRemainingUser.length}
                  setIsDropdownOpen={setIsDropdownOpen}
                  setShowAllOwners={setShowAllOwners}
                  showAllOwners={showAllOwners}
                />
              </div>
            )}
            {hasPermission && (
              <Button
                className="p-0 flex-center h-auto"
                data-testid="edit-assignees"
                icon={<EditIcon width="14px" />}
                type="text"
                onClick={onEditClick}
              />
            )}
          </div>
        </div>
      </div>
    );
  }, [
    showMultipleTypeTeam,
    showMultipleTypeVisibleUser,
    showMultipleTypeRemainingUser,
    avatarSize,
    className,
    isCompactView,
    ownerDisplayName,
    hasPermission,
    onEditClick,
    isDropdownOpen,
    owners,
    setIsDropdownOpen,
    setShowAllOwners,
    showAllOwners,
  ]);
  const ownerElements = useMemo(() => {
    const hasOwners = owners && owners.length > 0;
    // Show all owners when "more" is clicked, regardless of view mode
    const visibleOwners = showAllOwners
      ? owners
      : owners.slice(0, maxVisibleOwners);
    const remainingOwnersCount = owners.length - maxVisibleOwners;
    const showMoreButton = remainingOwnersCount > 0 && !showAllOwners;

    const renderVisibleOwners = isCompactView
      ? visibleOwners
      : reverse(visibleOwners);

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

    if (isAssignee) {
      return renderMultipleType;
    }

    return (
      <div
        className={classNames({
          'owner-label-container w-full d-flex flex-col items-start flex-start':
            !isCompactView,
          'd-flex owner-label-heading gap-2 items-center': isCompactView,
        })}
        data-testid="owner-label">
        {ownerElementsNonCompactView}
        <div className="d-flex w-max-full items-center  flex-center">
          <div
            className={classNames(
              'avatar-group w-full d-flex relative items-center m-l-xss',
              {
                'gap-2 flex-wrap': isCompactView,
                'flex-row-reverse': !isCompactView,
                inherited: Boolean(owners.some((owner) => owner?.inherited)),
              },
              className
            )}>
            {renderVisibleOwners.map(
              (owner: EntityReference, index: number) => (
                <div
                  className={classNames({
                    'w-full': owner.type === OwnerType.TEAM,
                    'w-max-full': isCompactView,
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
