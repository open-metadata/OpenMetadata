/*
 *  Copyright 2024 Collate.
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
import { useMemo, useState } from 'react';
import { EntityField } from '../../../constants/Feeds.constants';
import { GeneratedBy } from '../../../generated/entity/feed/thread';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import FeedCardBodyV1 from '../ActivityFeedCard/FeedCardBody/FeedCardBodyV1';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
import './activity-feed-card-v2.less';
import { ActivityFeedCardV2Props } from './ActivityFeedCardV2.interface';
import FeedCardFooter from './FeedCardFooter/FeedCardFooter';
import FeedCardHeaderV2 from './FeedCardHeader/FeedCardHeaderV2';

const ActivityFeedCardV2 = ({
  post,
  feed,
  className = '',
  isPost = false,
  isActive = false,
  showThread = false,
  isOpenInDrawer = false,
  componentsVisibility = {
    showThreadIcon: true,
    showRepliesContainer: true,
  },
}: Readonly<ActivityFeedCardV2Props>) => {
  const [isEditPost, setIsEditPost] = useState<boolean>(false);
  const [showActions, setShowActions] = useState(false);
  const { updateFeed } = useActivityFeedProvider();

  const postLength = useMemo(
    () => feed?.posts?.length ?? 0,
    [feed?.posts?.length]
  );

  const onEditPost = () => {
    setIsEditPost(!isEditPost);
  };

  const handleMouseEnter = () => {
    setShowActions(true);
  };

  const handleMouseLeave = () => {
    setShowActions(false);
  };

  const onUpdate = (message: string) => {
    const updatedPost = { ...feed, message };
    const patch = compare(feed, updatedPost);
    updateFeed(feed.id, post.id, !isPost, patch);
    setIsEditPost(!isEditPost);
  };

  return (
    <div
      className={classNames(
        'feed-card-v2-container p-sm',
        {
          active: isActive,
        },
        className
      )}>
      <div
        className={classNames('feed-card-v2-sidebar', {
          'feed-card-v2-post-sidebar': isPost,
        })}>
        <ProfilePicture
          avatarType="outlined"
          name={post.from}
          size={isPost ? 28 : 30}
          width={isPost ? '28' : '30'}
        />
      </div>
      <Row className="w-full" gutter={[0, 10]}>
        <Col
          className={classNames('feed-card-v2', {
            'feed-reply-card-v2': isPost,
            'drawer-feed-card-v2': isOpenInDrawer,
          })}
          span={24}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}>
          <Row className="w-full">
            <Col span={24}>
              <FeedCardHeaderV2
                about={!isPost ? feed.about : undefined}
                cardStyle={feed.cardStyle}
                createdBy={post.from}
                feed={feed}
                fieldName={feed.feedInfo?.fieldName as EntityField}
                fieldOperation={feed.fieldOperation}
                isEntityFeed={isPost}
                timeStamp={post.postTs}
              />
            </Col>
            <Col span={24}>
              <FeedCardBodyV1
                announcement={!isPost ? feed.announcement : undefined}
                feed={feed}
                isEditPost={isEditPost}
                isPost={isPost}
                message={post.message}
                onEditCancel={() => setIsEditPost(false)}
                onUpdate={onUpdate}
              />
            </Col>
            <Col span={24}>
              <FeedCardFooter
                componentsVisibility={componentsVisibility}
                feed={feed}
                isPost={isPost}
                post={post}
              />
            </Col>
          </Row>
          {showActions &&
            (feed.generatedBy !== GeneratedBy.System || isPost) && (
              <ActivityFeedActions
                feed={feed}
                isPost={isPost}
                post={post}
                onEditPost={onEditPost}
              />
            )}
        </Col>
        {showThread && postLength > 0 && (
          <Col className="feed-replies" data-testid="feed-replies" span={24}>
            {feed?.posts?.map((reply) => (
              <ActivityFeedCardV2
                isPost
                componentsVisibility={componentsVisibility}
                feed={feed}
                isOpenInDrawer={isOpenInDrawer}
                key={reply.id}
                post={reply}
              />
            ))}
          </Col>
        )}
      </Row>
    </div>
  );
};

export default ActivityFeedCardV2;
