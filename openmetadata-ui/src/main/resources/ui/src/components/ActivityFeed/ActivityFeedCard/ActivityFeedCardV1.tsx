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
import { Col, Row } from 'antd';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { noop } from 'lodash';
import React, { useState } from 'react';
import { ReactComponent as ThreadIcon } from '../../../assets/svg/thread.svg';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import Reactions from '../../../components/Reactions/Reactions';
import { ReactionOperation } from '../../../enums/reactions.enum';
import {
  Post,
  ReactionType,
  Thread,
} from '../../../generated/entity/feed/thread';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
import './activity-feed-card.style.less';
import FeedCardBodyV1 from './FeedCardBody/FeedCardBodyV1';
import FeedCardHeaderV1 from './FeedCardHeader/FeedCardHeaderV1';

interface ActivityFeedCardV1Props {
  post: Post;
  feed: Thread;
  className?: string;
  showThread?: boolean;
  isPost: boolean;
  isActive?: boolean;
  hidePopover: boolean;
}

const ActivityFeedCardV1 = ({
  post,
  feed,
  className = '',
  showThread = true,
  isPost = false,
  isActive,
  hidePopover = false,
}: ActivityFeedCardV1Props) => {
  const postLength = feed?.postsCount ?? 0;
  const [isEditPost, setIsEditPost] = useState(false);
  const repliedUsers = [...new Set((feed?.posts ?? []).map((f) => f.from))];
  const repliedUniqueUsersList = repliedUsers.slice(0, postLength >= 3 ? 2 : 1);

  const { showDrawer, updateFeed, updateReactions } = useActivityFeedProvider();

  const showReplies = () => {
    showDrawer?.(feed);
  };

  const onEditPost = () => {
    setIsEditPost(!isEditPost);
  };

  const onUpdate = (message: string) => {
    const updatedPost = { ...feed, message };
    const patch = compare(feed, updatedPost);
    updateFeed(feed.id, post.id, !isPost, patch);
    setIsEditPost(!isEditPost);
  };

  const onReactionUpdate = (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => {
    updateReactions(post, feed.id, !isPost, reaction, operation);
  };

  return (
    <>
      <div
        className={classNames(
          className,
          'activity-feed-card activity-feed-card-v1',
          { active: isActive }
        )}>
        <Row>
          <Col span={24}>
            <FeedCardHeaderV1
              about={!isPost ? feed.about : undefined}
              createdBy={post.from}
              isEntityFeed={isPost}
              timeStamp={post.postTs}
            />
          </Col>
        </Row>
        <Row>
          <Col className="p-t-xs" span={24}>
            <FeedCardBodyV1
              announcement={!isPost ? feed.announcement : undefined}
              isEditPost={isEditPost}
              message={post.message}
              onEditCancel={() => setIsEditPost(false)}
              onUpdate={onUpdate}
            />
          </Col>
        </Row>

        {!showThread && !isPost && (
          <Row>
            <Col className="p-t-xs" span={24}>
              <div className="d-flex items-center gap-2 pl-8">
                {postLength > 0 && (
                  <>
                    <div className="thread-users-profile-pic">
                      {repliedUniqueUsersList.map((user) => (
                        <UserPopOverCard key={user} userName={user}>
                          <span
                            className="profile-image-span cursor-pointer"
                            data-testid="authorAvatar">
                            <ProfilePicture
                              name={user}
                              type="circle"
                              width="22"
                            />
                          </span>
                        </UserPopOverCard>
                      ))}
                    </div>
                    <div
                      className="d-flex items-center thread-count cursor-pointer"
                      data-testid="thread-count"
                      onClick={!hidePopover ? showReplies : noop}>
                      <ThreadIcon width={18} />{' '}
                      <span className="text-xs p-l-xss">{postLength}</span>
                    </div>
                  </>
                )}

                {Boolean(post.reactions?.length) && (
                  <Reactions
                    reactions={post.reactions ?? []}
                    onReactionSelect={onReactionUpdate ?? noop}
                  />
                )}
              </div>
            </Col>
          </Row>
        )}

        {!hidePopover && (
          <ActivityFeedActions
            feed={feed}
            isPost={isPost}
            post={post}
            onEditPost={onEditPost}
          />
        )}
      </div>
    </>
  );
};

export default ActivityFeedCardV1;
