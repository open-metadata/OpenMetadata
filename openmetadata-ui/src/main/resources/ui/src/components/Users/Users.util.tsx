import React from 'react';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

export const userPageFilterList = [
  {
    name: 'My Data',
    value: 'OWNER',
    icon: <SVGIcons alt="" icon={Icons.FOLDER} width="16px" />,
  },
  {
    name: 'Mentions',
    value: 'MENTIONS',
    icon: <SVGIcons alt="" icon={Icons.MENTIONS} width="16px" />,
  },
  {
    name: 'Following',
    value: 'FOLLOWS',
    icon: <SVGIcons alt="" icon={Icons.STAR} width="16px" />,
  },
];
