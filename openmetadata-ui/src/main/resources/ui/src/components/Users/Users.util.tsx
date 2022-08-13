import React from 'react';
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
