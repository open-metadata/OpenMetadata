import React from 'react';
import { User } from '../../generated/entity/teams/user';
import { EntityReference } from '../../generated/type/entityReference';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

export const userPageFilterList = [
  {
    name: 'My Data',
    value: 'OWNER',
    icon: (
      <SVGIcons
        alt="My Data"
        className="tw-mr-2"
        icon={Icons.FOLDER}
        width="16px"
      />
    ),
  },
  {
    name: 'Mentions',
    value: 'MENTIONS',
    icon: (
      <SVGIcons
        alt="Mentions"
        className="tw-mr-2"
        icon={Icons.MENTIONS}
        width="16px"
      />
    ),
  },
  {
    name: 'Following',
    value: 'FOLLOWS',
    icon: (
      <SVGIcons
        alt="Following"
        className="tw-mr-2"
        icon={Icons.STAR}
        width="16px"
      />
    ),
  },
];

export const getEntityReferenceFromUser = (user: User): EntityReference => {
  return {
    deleted: user.deleted,
    href: user.href,
    fullyQualifiedName: user.fullyQualifiedName,
    id: user.id,
    type: 'user',
    description: user.description,
    displayName: user.displayName,
    name: user.name,
  };
};

export const getUserFromEntityReference = (entity: EntityReference): User => {
  return {
    deleted: entity.deleted,
    href: entity.href ?? '',
    fullyQualifiedName: entity.fullyQualifiedName,
    id: entity.id,
    description: entity.description,
    displayName: entity.displayName,
    name: entity.name ?? '',
    email: '',
  };
};
