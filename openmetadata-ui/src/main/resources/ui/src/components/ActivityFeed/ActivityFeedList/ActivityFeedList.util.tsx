/*
 *  Copyright 2022 Collate.
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

import { t } from 'i18next';
import React from 'react';
import { ReactComponent as IconAllApplication } from '../../../assets/svg/ic-all-application.svg';
import { ReactComponent as IconFolderPrimary } from '../../../assets/svg/ic-folder-primary.svg';
import { ReactComponent as IconMentionsPrimary } from '../../../assets/svg/ic-mentions-primary.svg';
import { ReactComponent as IconStarPrimary } from '../../../assets/svg/ic-star-primary.svg';

import { ReactComponent as IconAnnouncementsBasicPrimary } from '../../../assets/svg/announcements-basic-primary.svg';
import { ReactComponent as IconAllApplicationPrimary } from '../../../assets/svg/ic-all-application-primary.svg';
import { ReactComponent as IconCommentPrimary } from '../../../assets/svg/ic-comment-grey-primary.svg';
import { ReactComponent as IconTaskPrimary } from '../../../assets/svg/ic-task-primary.svg';

import { ReactComponent as IconFolder } from '../../../assets/svg/ic-folder.svg';
import { ReactComponent as IconMentions } from '../../../assets/svg/ic-mentions.svg';
import { ReactComponent as IconStar } from '../../../assets/svg/ic-star.svg';

import { ReactComponent as IconAnnouncementsBlack } from '../../../assets/svg/announcements-black.svg';
import { ReactComponent as IconCommentGrey } from '../../../assets/svg/ic-comment-grey.svg';
import { ReactComponent as IconTask } from '../../../assets/svg/ic-task.svg';

import { FeedFilter } from '../../../enums/mydata.enum';
import { ThreadType } from '../../../generated/entity/feed/thread';

export const getFeedFilterDropdownIcon = (feedfilter: FeedFilter) => {
  switch (feedfilter) {
    case FeedFilter.OWNER:
      return (
        <IconFolderPrimary
          className="m-r-xss"
          height={16}
          name="My Data"
          width={16}
        />
      );

    case FeedFilter.MENTIONS:
      return (
        <IconMentionsPrimary
          className="m-r-xss"
          height={16}
          name="Mentions"
          width={16}
        />
      );

    case FeedFilter.FOLLOWS:
      return (
        <IconStarPrimary
          className="m-r-xss"
          height={16}
          name="Following"
          width={16}
        />
      );

    case FeedFilter.ALL:
    default:
      return (
        <IconAllApplication
          className="m-r-xss"
          height={16}
          name="All Activity"
          width={16}
        />
      );
  }
};

export const getThreadFilterDropdownIcon = (threadType: ThreadType | 'ALL') => {
  switch (threadType) {
    case ThreadType.Announcement:
      return (
        <IconAnnouncementsBasicPrimary
          className="m-r-xss"
          height={16}
          name="Announcement"
          width={16}
        />
      );

    case ThreadType.Conversation:
      return (
        <IconCommentPrimary
          className="m-r-xss"
          height={16}
          name="Conversation"
          width={16}
        />
      );

    case ThreadType.Task:
      return (
        <IconTaskPrimary
          className="m-r-xss"
          height={16}
          name="Task"
          width={16}
        />
      );

    case 'ALL':
    default:
      return (
        <IconAllApplicationPrimary
          className="m-r-xss"
          height={16}
          name="All Threads"
          width={16}
        />
      );
  }
};

export const filterList = [
  {
    name: t('label.all-activity'),
    value: 'ALL',
    icon: (
      <IconAllApplication
        className="m-r-xs"
        height={16}
        name="All Activity"
        width={16}
      />
    ),
  },
  {
    name: t('label.my-data'),
    value: 'OWNER',
    icon: (
      <IconFolder className="m-r-xs" height={16} name="My Data" width={16} />
    ),
  },
  {
    name: t('label.mention-plural'),
    value: 'MENTIONS',
    icon: (
      <IconMentions className="m-r-xs" height={16} name="Mentions" width={16} />
    ),
  },
  {
    name: t('label.following'),
    value: 'FOLLOWS',
    icon: (
      <IconStar className="m-r-xs" height={16} name="Following" width={16} />
    ),
  },
];

export const threadFilterList = [
  {
    name: t('label.all-threads'),
    value: 'ALL',
    icon: (
      <IconAllApplication
        className="m-r-xs"
        height={16}
        name="All Activity"
        width={16}
      />
    ),
  },
  {
    name: t('label.task'),
    value: 'Task',
    icon: <IconTask className="m-r-xs" height={16} name="Task" width={16} />,
  },
  {
    name: t('label.conversation'),
    value: 'Conversation',
    icon: (
      <IconCommentGrey
        className="m-r-xs"
        height={16}
        name="Conversation"
        width={16}
      />
    ),
  },
  {
    name: t('label.announcement'),
    value: 'Announcement',
    icon: (
      <IconAnnouncementsBlack
        className="m-r-xs"
        height={16}
        name="Announcement"
        width={16}
      />
    ),
  },
];

export const filterListTasks = [
  { name: t('label.all-activity'), value: 'ALL' },
  { name: t('label.assigned-to-me'), value: 'ASSIGNED_TO' },
  { name: t('label.created-by-me'), value: 'ASSIGNED_BY' },
];
