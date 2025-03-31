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
import { Tooltip } from 'antd';
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { EntityReference } from '../../../generated/entity/data/table';
import { getEntityName } from '../../../utils/EntityUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import { OwnerAvatar } from '../OwnerAvtar/OwnerAvatar';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
interface OwnerItemProps {
  owner: EntityReference;
  index: number;
  isCompactView: boolean;
  className?: string;
  ownerDisplayName?: ReactNode;
}

export const OwnerItem: React.FC<OwnerItemProps> = ({
  owner,
  index,
  isCompactView,
  className,
  ownerDisplayName,
}) => {
  const { t } = useTranslation();
  const displayName = getEntityName(owner);
  const ownerPath = getOwnerPath(owner);

  const inheritedIcon = owner?.inherited ? (
    <Tooltip
      title={t('label.inherited-entity', {
        entity: t('label.owner-plural'),
      })}>
      <InheritIcon className="inherit-icon cursor-pointer" width={10} />
    </Tooltip>
  ) : null;

  return (
    <div
      className="d-inline-flex items-center owner-avatar-container gap-1"
      style={{
        marginLeft: index === 0 || isCompactView ? 0 : '-4px',
      }}>
      {!isCompactView ? (
        <>
          <UserPopOverCard userName={owner.name ?? ''}>
            <Link className="d-flex" data-testid="owner-link" to={ownerPath}>
              <OwnerAvatar
                inheritedIcon={inheritedIcon}
                isCompactView={isCompactView}
                owner={owner}
              />
            </Link>
          </UserPopOverCard>
        </>
      ) : (
        <>
          <div className="owner-avatar-icon d-flex">
            <OwnerAvatar isCompactView={isCompactView} owner={owner} />
          </div>
          <Link
            className={classNames(
              'no-underline font-medium text-xs text-primary',
              className
            )}
            data-testid="owner-link"
            to={ownerPath}>
            <span data-testid={getEntityName(owner)}>
              {ownerDisplayName ?? displayName}
            </span>
          </Link>
          {inheritedIcon && <div className="d-flex">{inheritedIcon}</div>}
        </>
      )}
    </div>
  );
};
