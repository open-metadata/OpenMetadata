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
import Icon from '@ant-design/icons';
import { Button, Dropdown, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import React, { ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
} from '../../../constants/constants';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { UserTeamSelectableList } from '../UserTeamSelectableList/UserTeamSelectableList.component';
import './owner-label.less';

import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';

export const OwnerLabel = ({
  owners = [],
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
  isCompactView = false,
}: {
  owners?: EntityReference[];
  className?: string;
  onUpdate?: (owners?: EntityReference[]) => void;
  hasPermission?: boolean;
  ownerDisplayName?: ReactNode[];
  placeHolder?: string;
  maxVisibleOwners?: number;
  multiple?: {
    user: boolean;
    team: boolean;
  };
  tooltipText?: string;
  isCompactView?: boolean;
}) => {
  const { t } = useTranslation();
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const ownerElements = useMemo(() => {
    const hasOwners = owners && owners.length > 0;
    const visibleOwners = showAllOwners
      ? owners
      : owners.slice(0, maxVisibleOwners);
    const remainingOwnersCount = owners.length - maxVisibleOwners;
    const remainingCountLabel = `+${remainingOwnersCount}`;

    return (
      <div
        className={`d-flex  owner-label-heading gap-2 ${
          isCompactView ? 'items-center' : 'items-center'
        }`}
        data-testid="owner-label">
        {hasOwners ? (
          <div
            className={classNames(
              `d-inline-flex ${isCompactView ? 'flex-col' : 'flex-wrap'} gap-2`,
              { inherited: Boolean(owners.some((owner) => owner?.inherited)) },
              className
            )}>
            {isCompactView && (
              <div className="d-flex items-center gap-2">
                <Typography.Text
                  className={classNames(
                    'no-owner font-medium text-sm',
                    className
                  )}
                  data-testid="owner-link">
                  {placeHolder ?? t('label.owner-plural')}
                </Typography.Text>
                {onUpdate && (
                  <UserTeamSelectableList
                    hasPermission={Boolean(hasPermission)}
                    multiple={multiple}
                    owner={owners}
                    tooltipText={tooltipText}
                    onUpdate={(updatedUsers) => {
                      onUpdate(updatedUsers);
                    }}
                  />
                )}
              </div>
            )}
            <div className={`d-flex items-center ${!isCompactView && 'gap-2'}`}>
              {visibleOwners.map((owner, index) => {
                const displayName = getEntityName(owner);
                const profilePicture =
                  owner.type === OwnerType.TEAM ? (
                    <Icon
                      component={IconTeamsGrey}
                      data-testid="team-owner-icon"
                      style={{ fontSize: '32px' }}
                    />
                  ) : (
                    <div
                      className="owner-avatar-icon"
                      key={owner.id}
                      style={{ flexBasis: '32px' }}>
                      <ProfilePicture
                        displayName={displayName}
                        key="profile-picture"
                        name={owner.name ?? ''}
                        type="circle"
                        width="32"
                      />
                    </div>
                  );

                const ownerLink = (
                  <Link
                    className={classNames(
                      'no-underline font-medium text-xs text-primary',
                      className
                    )}
                    data-testid="owner-link"
                    key={owner.id}
                    to={
                      owner.type === OwnerType.TEAM
                        ? getTeamAndUserDetailsPath(
                            owner.fullyQualifiedName ?? ''
                          )
                        : getUserPath(owner.name ?? '')
                    }>
                    {ownerDisplayName?.[index] ?? displayName}
                  </Link>
                );

                const inheritedIcon = owner?.inherited ? (
                  <Tooltip
                    title={t('label.inherited-entity', {
                      entity: t('label.owner-plural'),
                    })}>
                    <InheritIcon
                      className="inherit-icon cursor-pointer"
                      width={14}
                    />
                  </Tooltip>
                ) : null;

                return (
                  <div
                    className="d-inline-flex items-center owner-avatar-container gap-1"
                    key={owner.id}
                    style={{
                      marginLeft: index === 0 || !isCompactView ? 0 : '-4px',
                    }}>
                    {isCompactView ? (
                      <UserPopOverCard userName={owner.name ?? ''}>
                        <Link
                          className="d-flex"
                          data-testid="owner-link"
                          to={
                            owner.type === OwnerType.TEAM
                              ? getTeamAndUserDetailsPath(
                                  owner.fullyQualifiedName ?? ''
                                )
                              : getUserPath(owner.name ?? '')
                          }>
                          {profilePicture}
                        </Link>
                      </UserPopOverCard>
                    ) : (
                      <>
                        <div className="owner-avatar-icon d-flex">
                          {profilePicture}
                        </div>
                        {ownerLink}
                      </>
                    )}
                    {inheritedIcon && (
                      <div className="d-flex">{inheritedIcon}</div>
                    )}
                  </div>
                );
              })}
              {remainingOwnersCount > 0 && (
                <div className="relative">
                  {!isCompactView ? (
                    <Button
                      className={`${
                        !showAllOwners ? 'more-owners-button' : ''
                      } text-sm font-medium h-auto`}
                      size="small"
                      type="link"
                      onClick={() => {
                        if (!isCompactView) {
                          setShowAllOwners((prev) => !prev);
                        }
                      }}>
                      {showAllOwners ? t('label.less') : remainingCountLabel}
                    </Button>
                  ) : (
                    <Dropdown
                      menu={{
                        items: owners.slice(maxVisibleOwners).map((owner) => ({
                          key: owner.id,
                          label: (
                            <UserPopOverCard userName={owner.name ?? ''}>
                              <div className="flex items-center gap-2">
                                <div className="relative">
                                  <ProfilePicture
                                    displayName={getEntityName(owner)}
                                    key="profile-picture"
                                    name={owner.name ?? ''}
                                    type="circle"
                                    width="32"
                                  />
                                </div>
                                <span>{getEntityName(owner)}</span>
                              </div>
                            </UserPopOverCard>
                          ),
                        })),
                        className: 'owner-dropdown-container',
                      }}
                      open={isDropdownOpen}
                      onOpenChange={setIsDropdownOpen}>
                      <Button
                        className={`${
                          !showAllOwners ? 'more-owners-button' : ''
                        } text-sm font-medium h-auto`}
                        size="small"
                        type="link"
                        onClick={() => {
                          if (!isCompactView) {
                            setShowAllOwners((prev) => !prev);
                          }
                        }}>
                        {showAllOwners ? t('label.less') : remainingCountLabel}
                      </Button>
                    </Dropdown>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="d-flex items-center gap-1">
              {!isCompactView && (
                <div className="owner-avatar-icon d-flex">
                  <Icon
                    component={IconUser}
                    data-testid="no-owner-icon"
                    style={{ fontSize: '18px' }}
                  />
                </div>
              )}
              <Typography.Text
                className={classNames(
                  'no-owner font-medium text-sm',
                  className
                )}
                data-testid="owner-link">
                {placeHolder ??
                  (isCompactView
                    ? t('label.owner-plural')
                    : t('label.no-entity', {
                        entity: t('label.owner-plural'),
                      }))}
              </Typography.Text>
              {isCompactView && !hasOwners && onUpdate && (
                <UserTeamSelectableList
                  hasPermission={Boolean(hasPermission)}
                  multiple={multiple}
                  owner={owners}
                  tooltipText={tooltipText}
                  onUpdate={(updatedUsers) => {
                    onUpdate(updatedUsers);
                  }}
                />
              )}
            </div>

            <div className="no-owner-text text-sm font-medium">
              {isCompactView &&
                t('label.no-entity', { entity: t('label.owner-plural') })}
            </div>
          </div>
        )}

        {!isCompactView && onUpdate && (
          <UserTeamSelectableList
            hasPermission={Boolean(hasPermission)}
            multiple={multiple}
            owner={owners}
            tooltipText={tooltipText}
            onUpdate={(updatedUsers) => {
              onUpdate(updatedUsers);
            }}
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
  ]);

  return ownerElements;
};
