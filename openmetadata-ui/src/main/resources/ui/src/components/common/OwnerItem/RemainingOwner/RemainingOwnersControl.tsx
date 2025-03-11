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
import { Button, Dropdown } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';

interface RemainingOwnersControlProps {
  isCompactView: boolean;
  isDropdownOpen: boolean;
  owners: EntityReference[];
  remainingCount: number;
  showAllOwners: boolean;
  setIsDropdownOpen: (isOpen: boolean) => void;
  setShowAllOwners: React.Dispatch<React.SetStateAction<boolean>>;
}

export const RemainingOwnersControl: React.FC<RemainingOwnersControlProps> = ({
  isCompactView,
  isDropdownOpen,
  owners,
  remainingCount,
  showAllOwners,
  setIsDropdownOpen,
  setShowAllOwners,
}) => {
  const { t } = useTranslation();
  const remainingCountLabel = `+${remainingCount}`;

  const handleShowMoreToggle = () => {
    if (!isCompactView) {
      setShowAllOwners((prev) => !prev);
    }
  };

  if (!isCompactView) {
    return (
      <div className="relative">
        <Button
          className={`${
            !showAllOwners ? 'more-owners-button' : ''
          } text-sm font-medium h-auto`}
          size="small"
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
          onClick={handleShowMoreToggle}>
          {showAllOwners ? t('label.less') : remainingCountLabel}
        </Button>
      </Dropdown>
    </div>
  );
};
