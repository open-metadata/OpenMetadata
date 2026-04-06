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
import {
  Avatar,
  Button,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from '../../../utils/EntityUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import {
  AVATAR_FONT_SIZE_MAP,
  AVATAR_SIZE_NAME_MAP,
} from '../OwnerUserTeamList/OwnerUserTeamList.constants';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { OwnerRevealProps } from './OwnerReveal.interface';

export const OwnerReveal: React.FC<OwnerRevealProps> = ({
  isCompactView,
  owners,
  remainingCount,
  showAllOwners,
  setShowAllOwners,
  avatarSize = 32,
}) => {
  const { t } = useTranslation();
  const remainingCountLabel = `+${remainingCount}`;
  const fontSizeClass = AVATAR_FONT_SIZE_MAP[avatarSize];

  if (isCompactView) {
    return (
      <Button
        className={classNames(fontSizeClass, { 'tw:-ml-1': !showAllOwners })}
        color="link-color"
        onPress={() => setShowAllOwners((prev) => !prev)}>
        {showAllOwners ? (
          t('label.less')
        ) : (
          <Avatar
            className="tw:bg-brand-50 tw:ring-1 tw:ring-brand-600"
            placeholder={remainingCountLabel}
            size={AVATAR_SIZE_NAME_MAP[avatarSize]}
          />
        )}
      </Button>
    );
  }

  return (
    <div className="tw:relative">
      <Dropdown.Root>
        <Button className="tw:outline-none tw:-ml-1" color="link-color">
          <Avatar
            className={classNames(
              'tw:bg-brand-50 tw:ring-1 tw:ring-brand-600',
              fontSizeClass
            )}
            placeholder={remainingCountLabel}
            size={AVATAR_SIZE_NAME_MAP[avatarSize]}
          />
        </Button>
        <Dropdown.Popover className="tw:z-999!" placement="bottom start">
          <Dropdown.Menu aria-label="remaining owners">
            {owners.map((owner) => {
              const name = getEntityName(owner);

              return (
                <Dropdown.Item key={owner.id} textValue={name}>
                  <UserPopOverCard userName={owner.name ?? ''}>
                    <Link data-testid="owner-link" to={getOwnerPath(owner)}>
                      <div className="tw:flex tw:items-center tw:gap-2">
                        <ProfilePicture
                          displayName={name}
                          name={owner.name ?? ''}
                          type="circle"
                          width={avatarSize.toString()}
                        />
                        <div className="tw:max-w-46">
                          <Typography ellipsis as="p" data-testid={name}>
                            {name}
                          </Typography>
                        </div>
                      </div>
                    </Link>
                  </UserPopOverCard>
                </Dropdown.Item>
              );
            })}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
};
