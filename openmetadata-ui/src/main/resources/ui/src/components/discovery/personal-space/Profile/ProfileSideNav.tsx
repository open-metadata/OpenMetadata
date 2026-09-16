/*
 *  Copyright 2026 Collate.
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

import { Box, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ProfileNavId,
  ProfileNavItem,
  PROFILE_NAV_GROUP_LABEL,
  PROFILE_NAV_GROUP_ORDER,
} from './profileNavConfig';

interface ProfileSideNavProps {
  items: ProfileNavItem[];
  selectedId: ProfileNavId;
  onSelect: (id: ProfileNavId) => void;
}

interface NavButtonProps {
  item: ProfileNavItem;
  isActive: boolean;
  onSelect: (id: ProfileNavId) => void;
}

const NavButton: React.FC<NavButtonProps> = ({ item, isActive, onSelect }) => {
  const { t } = useTranslation();
  const Icon = item.icon;
  const handleClick = useCallback(() => onSelect(item.id), [item.id, onSelect]);

  return (
    <button
      aria-current={isActive ? 'page' : undefined}
      className={classNames(
        'ai-profile-page__nav-item tw:mb-1 tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2',
        'tw:rounded-md tw:px-3 tw:py-2 tw:text-left tw:transition tw:duration-100 tw:hover:bg-utility-gray-200',
        {
          'tw:bg-utility-gray-200': isActive,
          'tw:text-text-secondary tw:hover:bg-primary_hover': !isActive,
        }
      )}
      data-testid={`profile-nav-${item.id}`}
      type="button"
      onClick={handleClick}>
      <Icon className="tw:size-4.5 tw:shrink-0" />
      <Typography
        className={classNames({
          'tw:text-text-secondary': !isActive,
        })}
        size="text-sm"
        weight="medium">
        {t(item.label)}
      </Typography>
    </button>
  );
};

/**
 * Left rail of the ProfilePage: nav items grouped under uppercase section
 * headers.
 */
const ProfileSideNav: React.FC<ProfileSideNavProps> = ({
  items,
  selectedId,
  onSelect,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      className="ai-profile-page__sidenav tw:flex tw:h-full tw:shrink-0 tw:flex-col tw:border-r tw:border-secondary tw:bg-utility-gray-50"
      data-testid="profile-side-nav"
      direction="col">
      <Box
        className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-4 tw:pb-4 tw:pt-6"
        direction="col"
        gap={1}>
        {PROFILE_NAV_GROUP_ORDER.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (groupItems.length === 0) {
            return null;
          }

          return (
            <div className="tw:pb-2" key={group}>
              <div className="tw:px-3 tw:pb-1.5 tw:pt-2">
                <Typography
                  className="tw:text-text-secondary tw:uppercase"
                  size="text-xs"
                  weight="semibold">
                  {t(PROFILE_NAV_GROUP_LABEL[group])}
                </Typography>
              </div>
              {groupItems.map((item) => (
                <NavButton
                  isActive={item.id === selectedId}
                  item={item}
                  key={item.id}
                  onSelect={onSelect}
                />
              ))}
            </div>
          );
        })}
      </Box>
    </Box>
  );
};

export default ProfileSideNav;
