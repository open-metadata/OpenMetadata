import React from 'react';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

export const filterList = [
  {
    name: 'All Activity',
    value: 'ALL',
    icon: <SVGIcons alt="hello" icon={Icons.ALL_APPLICATION} width="16px" />,
  },
  {
    name: 'My Data',
    value: 'OWNER',
    icon: <SVGIcons alt="hello" icon={Icons.FOLDER} width="16px" />,
  },
  {
    name: 'Mentions',
    value: 'MENTIONS',
    icon: <SVGIcons alt="hello" icon={Icons.MENTIONS} width="16px" />,
  },
  {
    name: 'Following',
    value: 'FOLLOWS',
    icon: <SVGIcons alt="hello" icon={Icons.STAR} width="16px" />,
  },
];

export const threadFilterList = [
  {
    name: 'All Threads',
    value: 'ALL',
    icon: <SVGIcons alt="hello" icon={Icons.ALL_APPLICATION} width="16px" />,
  },
  {
    name: 'Task',
    value: 'Task',
    icon: <SVGIcons alt="hello" icon={Icons.TASK} width="16px" />,
  },
  {
    name: 'Conversation',
    value: 'Conversation',
    icon: <SVGIcons alt="hello" icon={Icons.COMMENT} width="16px" />,
  },
];

export const filterListTasks = [
  { name: 'All Activity', value: 'ALL' },
  { name: 'Assigned to me', value: 'ASSIGNED_TO' },
  { name: 'Created by me', value: 'ASSIGNED_BY' },
];
