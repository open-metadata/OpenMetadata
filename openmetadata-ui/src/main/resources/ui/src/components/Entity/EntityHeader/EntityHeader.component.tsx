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
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import { EntityType } from 'enums/entity.enum';
import React, { ReactNode } from 'react';
import { getEntityLinkFromType } from 'utils/EntityUtils';
import { getEncodedFqn } from 'utils/StringsUtils';
import EntityHeaderTitle from '../EntityHeaderTitle/EntityHeaderTitle.component';

interface Props {
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
        deleted={entityData.deleted}
        displayName={entityData.displayName}
        icon={icon}
        link={
          titleIsLink && entityData.fullyQualifiedName && entityType
            ? getEntityLinkFromType(
                getEncodedFqn(entityData.fullyQualifiedName),
                entityType
              )
            : undefined
        }
        name={entityData.name}
        openEntityInNewPage={openEntityInNewPage}
        serviceName={serviceName}
      />
    </div>
  );
};
