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
import { Avatar, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import { EntityReference } from '../../../generated/entity/data/table';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import './owner-label.less';

export const OwnerLabelNew = ({
  owners = [],
  className,
  onUpdate,
  hasPermission,
  ownerDisplayName,
  placeHolder,
  maxVisibleOwners = 3,
  avatarSize = 24,
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
  avatarSize?: number;
}) => {
  const { t } = useTranslation();

  const ownerElements = useMemo(() => {
    const visibleOwners = owners.slice(0, maxVisibleOwners);
    const remainingOwnersCount = owners.length - maxVisibleOwners;

    return (
      <div className="d-flex items-center gap-1" data-testid="owner-label">
        <div
          className={classNames(
            'd-inline-flex items-center flex-wrap gap-2',
            { inherited: Boolean(owners.some((owner) => owner?.inherited)) },
            className
          )}>
          <Avatar.Group>
            {visibleOwners.map((owner) => (
              <ProfilePicture
                avatarType="outlined"
                key={owner.id}
                name={owner.name ?? ''}
                size={avatarSize}
              />
            ))}
            {remainingOwnersCount > 0 && (
              <Avatar
                size={avatarSize}
                style={{
                  background: '#f9f5ff',
                  color: '#7f56d9',
                  border: '1px solid #7f56d9',
                }}>
                {t('label.plus-symbol')}
                {remainingOwnersCount}
              </Avatar>
            )}
          </Avatar.Group>
        </div>

        {isEmpty(owners) && (
          <div className="d-inline-flex items-center gap-1">
            <div className="owner-avatar-icon d-flex">
              <Icon
                component={IconUser}
                data-testid="no-owner-icon"
                style={{ fontSize: '18px' }}
              />
            </div>
            <Typography.Text
              className={classNames('no-owner font-medium text-xs', className)}
              data-testid="owner-link">
              {placeHolder ??
                t('label.no-entity', { entity: t('label.owner-plural') })}
            </Typography.Text>
          </div>
        )}
      </div>
    );
  }, [
    owners,
    className,
    onUpdate,
    hasPermission,
    maxVisibleOwners,
    placeHolder,
    t,
    ownerDisplayName,
  ]);

  return ownerElements;
};
