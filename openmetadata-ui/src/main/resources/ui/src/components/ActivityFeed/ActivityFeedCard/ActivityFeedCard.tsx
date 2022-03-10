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

import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isUndefined, toLower } from 'lodash';
import { Post } from 'Models';
import React, { FC, Fragment, HTMLAttributes, useState } from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../../AppState';
import { getUserByName } from '../../../axiosAPIs/userAPI';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { User } from '../../../generated/entity/teams/user';
import { getPartialNameFromFQN } from '../../../utils/CommonUtils';
import {
  getEntityField,
  getEntityFQN,
  getEntityType,
  getFrontEndFormat,
  getReplyText,
} from '../../../utils/FeedUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { getEntityLink } from '../../../utils/TableUtils';
import { getDayTimeByTimeStamp } from '../../../utils/TimeUtils';
import Avatar from '../../common/avatar/Avatar';
import PopOver from '../../common/popover/PopOver';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../../Loader/Loader';

interface ActivityFeedCardProp extends HTMLAttributes<HTMLDivElement> {
  feed: Post;
  entityLink?: string;
  repliedUsers?: Array<string>;
  replies?: number;
  isEntityFeed?: boolean;
  threadId?: string;
  lastReplyTimeStamp?: number;
  isFooterVisible?: boolean;
  onThreadSelect?: (id: string) => void;
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
    Pick<
      ActivityFeedCardProp,
      | 'replies'
      | 'repliedUsers'
      | 'threadId'
      | 'onThreadSelect'
      | 'lastReplyTimeStamp'
      | 'isFooterVisible'
    > {}

const FeedHeader: FC<FeedHeaderProp> = ({
  className,
  createdBy,
  timeStamp,
  entityFQN,
  entityType,
  entityField,
  isEntityFeed,
}) => {
  const [userData, setUserData] = useState<User>({} as User);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const onMousEnterHandler = () => {
    getUserByName(createdBy, 'profile,roles,teams,follows,owns')
      .then((res: AxiosResponse) => {
        setUserData(res.data);
      })
      .catch(() => {
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  };

  const getUserData = () => {
    const image = userData.profile?.images?.image512;
    const displayName = userData.displayName ?? '';
    const name = userData.name ?? '';
    const teams = userData.teams;
    const roles = userData.roles;

    return (
      <Fragment>
        {isError ? (
          <p>Error while getting user data.</p>
        ) : (
          <div>
            {isLoading ? (
              <Loader size="small" />
            ) : (
              <div>
                <div className="tw-flex">
                  <div className="tw-mr-2">
                    {image ? (
                      <img src={image} width="30px" />
                    ) : (
                      <Avatar name={createdBy} type="square" width="30" />
                    )}
                  </div>
                  <div className="tw-self-center">
                    <p>
                      <span className="tw-font-medium tw-mr-2">
                        {displayName}
                      </span>
                      <span className="tw-text-grey-muted">{name}</span>
                    </p>
                  </div>
                </div>
                <div className="tw-text-left">
                  {teams?.length || roles?.length ? (
                    <hr className="tw-my-2 tw--mx-3" />
                  ) : null}
                  {teams?.length ? (
                    <p className="tw-mt-2">
                      <SVGIcons
                        alt="icon"
                        className="tw-w-4"
                        icon={Icons.TEAMS_GREY}
                      />
                      <span className="tw-mr-2 tw-ml-1 tw-align-middle tw-font-medium">
                        Teams
                      </span>
                      <span>
                        {teams.map((team, i) => (
                          <span
                            className="tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body tw-m-0.5 tw-text-xs"
                            key={i}>
                            {team?.displayName ?? team?.name}
                          </span>
                        ))}
                      </span>
                    </p>
                  ) : null}
                  {roles?.length ? (
                    <p className="tw-mt-2">
                      <SVGIcons
                        alt="icon"
                        className="tw-w-4"
                        icon={Icons.USERS}
                      />
                      <span className="tw-mr-2 tw-ml-1 tw-align-middle tw-font-medium">
                        Roles
                      </span>
                      <span>
                        {roles.map((role, i) => (
                          <span
                            className="tw-bg-gray-200 tw-rounded tw-px-1 tw-text-grey-body tw-m-0.5 tw-text-xs"
                            key={i}>
                            {role?.displayName ?? role?.name}
                          </span>
                        ))}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </Fragment>
    );
  };

  return (
    <div className={classNames('tw-flex tw-mb-1.5', className)}>
      <PopOver
        hideDelay={500}
        html={getUserData()}
        position="top"
        theme="light"
        trigger="mouseenter">
        <span className="tw-cursor-pointer" onMouseEnter={onMousEnterHandler}>
          <Avatar name={createdBy} type="square" width="30" />
        </span>
      </PopOver>
      <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2">
        {createdBy}
        {entityFQN && entityType ? (
          <span className="tw-pl-1 tw-font-normal">
            posted on{' '}
            {isEntityFeed ? (
              <span className="tw-heading">{entityField}</span>
            ) : (
              <Fragment>
                {entityType}{' '}
                <Link
                  to={`${getEntityLink(
                    entityType as string,
                    entityFQN as string
                  )}${
                    entityType !== EntityType.WEBHOOK
                      ? `/${TabSpecificField.ACTIVITY_FEED}`
                      : ''
                  }`}>
                  <button className="link-text" disabled={AppState.isTourOpen}>
                    {getPartialNameFromFQN(
                      entityFQN as string,
                      entityType === 'table' ? ['table'] : ['database']
                    ) || entityFQN}
                  </button>
                </Link>
              </Fragment>
            )}
          </span>
        ) : null}
        <span className="tw-text-grey-muted tw-pl-2 tw-text-xs">
          {getDayTimeByTimeStamp(timeStamp)}
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
        markdown={getFrontEndFormat(message)}
      />
    </div>
  );
};

export const FeedFooter: FC<FeedFooterProp> = ({
  repliedUsers,
  replies,
  className,
  threadId,
  onThreadSelect,
  lastReplyTimeStamp,
  isFooterVisible,
}) => {
  const repliesCount = isUndefined(replies) ? 0 : replies;

  return (
    <div className={className}>
      {!isUndefined(repliedUsers) &&
      !isUndefined(replies) &&
      isFooterVisible ? (
        <div className="tw-flex tw-group">
          {repliedUsers?.map((u, i) => (
            <Avatar
              className="tw-mt-0.5 tw-mx-0.5"
              key={i}
              name={u}
              type="square"
              width="22"
            />
          ))}
          <p
            className="tw-ml-1 link-text tw-text-xs tw-mt-1.5 tw-underline"
            onClick={() => onThreadSelect?.(threadId as string)}>
            {getReplyText(repliesCount)}
          </p>
          {lastReplyTimeStamp && repliesCount > 0 ? (
            <span className="tw-text-grey-muted tw-pl-2 tw-text-xs tw-font-medium tw-mt-1.5">
              Last reply{' '}
              {toLower(getDayTimeByTimeStamp(lastReplyTimeStamp as number))}
            </span>
          ) : null}
        </div>
      ) : null}
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
  threadId,
  lastReplyTimeStamp,
  onThreadSelect,
  isFooterVisible = false,
}) => {
  const entityType = getEntityType(entityLink as string);
  const entityFQN = getEntityFQN(entityLink as string);
  const entityField = getEntityField(entityLink as string);

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
        className="tw-mx-7 tw-ml-9 tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md tw-break-all"
        message={feed.message}
      />
      <FeedFooter
        className="tw-ml-9 tw-mt-3"
        isFooterVisible={isFooterVisible}
        lastReplyTimeStamp={lastReplyTimeStamp}
        repliedUsers={repliedUsers}
        replies={replies}
        threadId={threadId}
        onThreadSelect={onThreadSelect}
      />
    </div>
  );
};

export default ActivityFeedCard;
