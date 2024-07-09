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
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import classNames from 'classnames';
import { t } from 'i18next';
import { isEmpty, isUndefined } from 'lodash';
import React, { Fragment, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OwnerLabel } from '../components/common/OwnerLabel/OwnerLabel.component';
import {
  DEFAULT_DOMAIN_VALUE,
  NO_DATA_PLACEHOLDER,
} from '../constants/constants';
import { DOMAIN_TYPE_DATA } from '../constants/Domain.constants';
import { EntityField } from '../constants/Feeds.constants';
import { EntityType } from '../enums/entity.enum';
import { DataProduct } from '../generated/entity/domains/dataProduct';
import { Domain } from '../generated/entity/domains/domain';
import { ChangeDescription, EntityReference } from '../generated/entity/type';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { getEntityName, getEntityReferenceFromEntity } from './EntityUtils';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
  getDiffValue,
} from './EntityVersionUtils';
import { getDomainPath } from './RouterUtils';

export const getOwner = (
  hasPermission: boolean,
  ownerDisplayName: ReactNode,
  owner?: EntityReference
) => {
  if (owner) {
    return (
      <OwnerLabel pills owner={owner} ownerDisplayName={ownerDisplayName} />
    );
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
  fqn: string,
  parentFqn?: string
): QueryFilterInterface => {
  const mustTerm: QueryFieldInterface[] = parentFqn
    ? [
        {
          term: {
            'domain.fullyQualifiedName': parentFqn,
          },
        },
      ]
    : [];

  return {
    query: {
      bool: {
        must: mustTerm.concat([
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
        ]),
      },
    },
  };
};

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

export const getDomainOptions = (domains: Domain[] | EntityReference[]) => {
  const domainOptions: ItemType[] = [
    {
      label: t('label.all-domain-plural'),
      key: DEFAULT_DOMAIN_VALUE,
    },
  ];
  domains.forEach((domain) => {
    domainOptions.push({
      label: getEntityName(domain),
      key: domain.fullyQualifiedName ?? '',
    });
  });

  return domainOptions;
};

export const renderDomainLink = (
  domain: EntityReference,
  domainDisplayName: ReactNode,
  showDomainHeading: boolean,
  textClassName?: string
) => (
  <Link
    className={classNames(
      'text-primary no-underline domain-link',
      { 'font-medium text-xs': !showDomainHeading },
      textClassName
    )}
    data-testid="domain-link"
    to={getDomainPath(domain?.fullyQualifiedName)}>
    {isUndefined(domainDisplayName) ? getEntityName(domain) : domainDisplayName}
  </Link>
);

export const initializeDomainEntityRef = (
  domains: Domain[],
  activeDomainKey: string
) => {
  const domain = domains.find(
    (item) => item.fullyQualifiedName === activeDomainKey
  );
  if (domain) {
    return getEntityReferenceFromEntity(domain, EntityType.DOMAIN);
  }

  return undefined;
};
