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

import classNames from 'classnames';
import { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { getEntityLinkFromType } from '../../../utils/EntityUtils';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import EntityHeaderTitle from '../EntityHeaderTitle/EntityHeaderTitle.component';

export interface Props {
  breadcrumb: TitleBreadcrumbProps['titleLinks'];
  entityData: {
    displayName?: string;
    name: string;
    fullyQualifiedName?: string;
    deleted?: boolean;
  };
  entityType?: EntityType;
  icon: ReactNode;
  titleIsLink?: boolean;
  openEntityInNewPage?: boolean;
  gutter?: 'default' | 'large';
  serviceName: string;
  titleColor?: string;
  badge?: React.ReactNode;
  showName?: boolean;
  nameClassName?: string;
  displayNameClassName?: string;
  handleFollowingClick?: () => void;
  isFollowingLoading?: boolean;
  isFollowing?: boolean;
  showOnlyDisplayName?: boolean;
}

export const EntityHeader = ({
  breadcrumb,
  entityData,
  icon,
  titleIsLink = false,
  entityType,
  openEntityInNewPage,
  gutter = 'default',
  serviceName,
  badge,
  titleColor,
  showName = true,
  isFollowingLoading,
  nameClassName = '',
  displayNameClassName = '',
  handleFollowingClick,
  isFollowing,
  showOnlyDisplayName = false,
}: Props) => {
  return (
    <div className="w-full">
      <div
        className={classNames(
          'entity-breadcrumb',
          gutter === 'large' ? 'm-b-sm' : 'm-b-xss'
        )}
        data-testid="category-name">
        <TitleBreadcrumb titleLinks={breadcrumb} />
      </div>

      <EntityHeaderTitle
        badge={badge}
        color={titleColor}
        deleted={entityData.deleted}
        displayName={entityData.displayName}
        displayNameClassName={displayNameClassName}
        handleFollowingClick={handleFollowingClick}
        icon={icon}
        isFollowing={isFollowing}
        isFollowingLoading={isFollowingLoading}
        link={
          titleIsLink && entityData.fullyQualifiedName && entityType
            ? getEntityLinkFromType(entityData.fullyQualifiedName, entityType)
            : undefined
        }
        name={entityData.name}
        nameClassName={nameClassName}
        openEntityInNewPage={openEntityInNewPage}
        serviceName={serviceName}
        showName={showName}
        showOnlyDisplayName={showOnlyDisplayName}
      />
    </div>
  );
};
