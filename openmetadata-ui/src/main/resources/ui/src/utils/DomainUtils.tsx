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
import { Divider, Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { Fragment, ReactNode } from 'react';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { DOMAIN_TYPE_DATA } from '../constants/Domain.constants';
import { EntityField } from '../constants/Feeds.constants';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { Domain } from '../generated/entity/domains/domain';
import { ChangeDescription, EntityReference } from '../generated/entity/type';
import { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import { getEntityName } from './EntityUtils';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
  getDiffValue,
} from './EntityVersionUtils';

export const getOwner = (
  hasPermission: boolean,
  ownerDisplayName: ReactNode,
  owner?: EntityReference
) => {
  if (owner) {
    return <OwnerLabel owner={owner} ownerDisplayName={ownerDisplayName} />;
  }
  if (!hasPermission) {
    return <div>{NO_DATA_PLACEHOLDER}</div>;
  }

  return null;
};

export const getUserNames = (
  entity: Domain | DataProduct,
  hasPermission: boolean,
  isVersionsView = false
) => {
  if (isVersionsView) {
    const ownerDiff = getDiffByFieldName(
      EntityField.OWNER,
      entity.changeDescription as ChangeDescription
    );

    const oldOwner = JSON.parse(getChangedEntityOldValue(ownerDiff) ?? '{}');
    const newOwner = JSON.parse(getChangedEntityNewValue(ownerDiff) ?? '{}');

    const shouldShowDiff =
      !isEmpty(ownerDiff.added) ||
      !isEmpty(ownerDiff.deleted) ||
      !isEmpty(ownerDiff.updated);

    if (shouldShowDiff) {
      if (!isEmpty(ownerDiff.added)) {
        const ownerName = getDiffValue('', getEntityName(newOwner));

        return getOwner(hasPermission, ownerName, newOwner);
      }

      if (!isEmpty(ownerDiff.deleted)) {
        const ownerName = getDiffValue(getEntityName(oldOwner), '');

        return getOwner(hasPermission, ownerName, oldOwner);
      }

      if (!isEmpty(ownerDiff.updated)) {
        const ownerName = getDiffValue(
          getEntityName(oldOwner),
          getEntityName(newOwner)
        );

        return getOwner(hasPermission, ownerName, newOwner);
      }
    }
  }

  return getOwner(hasPermission, getEntityName(entity.owner), entity.owner);
};

export const getQueryFilterToIncludeDomain = (
  domainFqn: string,
  dataProductFqn: string
) => ({
  query: {
    bool: {
      must: [
        {
          term: {
            'domain.fullyQualifiedName': domainFqn,
          },
        },
        {
          bool: {
            must_not: [
              {
                term: {
                  'dataProducts.fullyQualifiedName': dataProductFqn,
                },
              },
            ],
          },
        },
        {
          bool: {
            must_not: [
              {
                term: {
                  entityType: 'dataProduct',
                },
              },
            ],
          },
        },
      ],
    },
  },
});

export const getQueryFilterToExcludeDomainTerms = (
  fqn: string
): QueryFilterInterface => ({
  query: {
    bool: {
      must: [
        {
          bool: {
            must_not: [
              {
                term: {
                  'domain.fullyQualifiedName': fqn,
                },
              },
            ],
          },
        },
      ],
    },
  },
});

// Domain type description which will be shown in tooltip
export const domainTypeTooltipDataRender = () => (
  <Space direction="vertical" size="middle">
    {DOMAIN_TYPE_DATA.map(({ type, description }, index) => (
      <Fragment key={type}>
        <Space direction="vertical" size={0}>
          <Typography.Text>{`${type} :`}</Typography.Text>
          <Typography.Paragraph className="m-0 text-grey-muted">
            {description}
          </Typography.Paragraph>
        </Space>

        {index !== 2 && <Divider className="m-0" />}
      </Fragment>
    ))}
  </Space>
);
