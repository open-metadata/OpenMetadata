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
import { Button, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from '../../../utils/EntityUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import { Dropdown } from '../AntdCompat';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { OwnerRevealProps } from './OwnerReveal.interface';
;

export const OwnerReveal: React.FC<OwnerRevealProps> = ({
  isCompactView,
  isDropdownOpen,
  owners,
  remainingCount,
  showAllOwners,
  setIsDropdownOpen,
  setShowAllOwners,
  avatarSize = 32,
}) => {
  const { t } = useTranslation();
  const remainingCountLabel = `+${remainingCount}`;

  // Calculate font size based on avatar size
  const fontSize = Math.max(8, Math.floor(avatarSize * 0.4)); // Reduced to 40% of avatar size

  const handleShowMoreToggle = () => {
    if (isCompactView) {
      setShowAllOwners((prev) => !prev);
    }
  };

  if (isCompactView) {
    return (
      <div className="relative">
        <Button
          className={`${
            !showAllOwners ? 'more-owners-button' : ''
          } text-sm font-medium h-auto d-flex items-center flex-center`}
          size="small"
          style={{
            width: `${avatarSize}px`,
            height: `${avatarSize}px`,
            fontSize: `${fontSize}px`,
          }}
          type="link"
          onClick={handleShowMoreToggle}>
          {showAllOwners ? t('label.less') : remainingCountLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Dropdown
        menu={{
          items: owners.map((owner) => ({
            key: owner.id,
            label: (
              <UserPopOverCard userName={owner.name ?? ''}>
                <Link
                  className="d-flex no-underline items-center gap-2 relative"
                  data-testid="owner-link"
                  to={getOwnerPath(owner)}>
                  <ProfilePicture
                    displayName={getEntityName(owner)}
                    key="profile-picture"
                    name={owner.name ?? ''}
                    type="circle"
                    width={avatarSize.toString()}
                  />

                  <Typography.Text
                    className="w-36"
                    ellipsis={{ tooltip: true }}>
                    {getEntityName(owner)}{' '}
                  </Typography.Text>
                </Link>
              </UserPopOverCard>
            ),
          })),
          className: 'owner-dropdown-container',
        }}
        open={isDropdownOpen}
        onOpenChange={setIsDropdownOpen}>
        <Button
          className={`${
            !showAllOwners
              ? 'more-owners-button d-flex items-center flex-center d-flex flex-center'
              : ''
          } text-sm font-medium h-auto`}
          size="small"
          style={{
            width: `${avatarSize}px`,
            height: `${avatarSize}px`,
            fontSize: `${fontSize}px`,
          }}
          type="link"
          onClick={handleShowMoreToggle}>
          {showAllOwners ? t('label.less') : remainingCountLabel}
        </Button>
      </Dropdown>
    </div>
  );
};
