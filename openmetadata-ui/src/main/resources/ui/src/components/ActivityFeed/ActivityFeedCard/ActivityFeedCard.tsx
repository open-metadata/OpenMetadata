/*
 *  Copyright 2021 Collate
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
import { Post } from 'Models';
import React, { FC, Fragment, HTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../../AppState';
import { getPartialNameFromFQN } from '../../../utils/CommonUtils';
import {
  getEntityField,
  getEntityFQN,
  getEntityType,
} from '../../../utils/FeedUtils';
import { getEntityLink } from '../../../utils/TableUtils';
import { getDayTimeByTimeStamp } from '../../../utils/TimeUtils';
import Avatar from '../../common/avatar/Avatar';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';

interface ActivityFeedCardProp extends HTMLAttributes<HTMLDivElement> {
  feed: Post;
  replies: number;
  repliedUsers: Array<string>;
  entityLink: string;
  isEntityFeed?: boolean;
}
interface FeedHeaderProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<ActivityFeedCardProp, 'isEntityFeed'> {
  createdBy: string;
  timeStamp: number;
  entityType: string;
  entityFQN: string;
  entityField: string;
}
interface FeedBodyProp extends HTMLAttributes<HTMLDivElement> {
  message: string;
}
interface FeedFooterProp
  extends HTMLAttributes<HTMLDivElement>,
    Pick<ActivityFeedCardProp, 'replies' | 'repliedUsers'> {}

const FeedHeader: FC<FeedHeaderProp> = ({
  className,
  createdBy,
  timeStamp,
  entityFQN,
  entityType,
  entityField,
  isEntityFeed,
}) => {
  return (
    <div className={classNames('tw-flex tw-mb-1.5', className)}>
      <Avatar name={createdBy} width="24" />
      <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2">
        {createdBy}
        <span className="tw-pl-1 tw-font-normal">
          posted on{' '}
          {isEntityFeed ? (
            <span className="tw-heading">{entityField}</span>
          ) : (
            <Fragment>
              {entityType}{' '}
              <Link
                to={getEntityLink(entityType as string, entityFQN as string)}>
                <button className="link-text" disabled={AppState.isTourOpen}>
                  {getPartialNameFromFQN(
                    entityFQN as string,
                    entityType === 'table' ? ['table'] : ['database']
                  )}
                </button>
              </Link>
            </Fragment>
          )}
          <span className="tw-text-grey-muted tw-pl-1 tw-text-xs">
            {getDayTimeByTimeStamp(timeStamp)}
          </span>
        </span>
      </h6>
    </div>
  );
};

const FeedBody: FC<FeedBodyProp> = ({ message, className }) => {
  return (
    <div className={className}>
      <RichTextEditorPreviewer
        className="activity-feed-card-text"
        enableSeeMoreVariant={false}
        markdown={message}
      />
    </div>
  );
};

const FeedFooter: FC<FeedFooterProp> = ({
  repliedUsers,
  replies,
  className,
}) => {
  return (
    <div className={className}>
      <div className="tw-flex tw-group">
        {repliedUsers.map((u, i) => (
          <Avatar className="tw-mt-0.5 tw-mx-0.5" key={i} name={u} width="18" />
        ))}
        <p className="tw-ml-1 link-text">
          {replies > 1 ? `${replies} replies` : `${replies} reply`}
        </p>
      </div>
    </div>
  );
};

const ActivityFeedCard: FC<ActivityFeedCardProp> = ({
  feed,
  className,
  replies,
  repliedUsers,
  entityLink,
  isEntityFeed,
}) => {
  const entityType = getEntityType(entityLink);
  const entityFQN = getEntityFQN(entityLink);
  const entityField = getEntityField(entityLink);

  return (
    <div className={classNames(className)}>
      <FeedHeader
        createdBy={feed.from}
        entityFQN={entityFQN as string}
        entityField={entityField as string}
        entityType={entityType as string}
        isEntityFeed={isEntityFeed}
        timeStamp={feed.postTs}
      />
      <FeedBody
        className="tw-mx-7 tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md"
        message={feed.message}
      />
      <FeedFooter
        className="tw-ml-7 tw-mt-2"
        repliedUsers={repliedUsers}
        replies={replies}
      />
    </div>
  );
};

export default ActivityFeedCard;
