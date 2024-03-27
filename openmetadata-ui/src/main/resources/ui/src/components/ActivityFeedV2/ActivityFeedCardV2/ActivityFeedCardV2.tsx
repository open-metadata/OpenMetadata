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

import { Avatar, Col, Divider, Row } from 'antd';
import classNames from 'classnames';
import React, { useMemo } from 'react';
import { getRandomColor } from '../../../utils/CommonUtils';
import FeedCardBodyV1 from '../../ActivityFeed/ActivityFeedCard/FeedCardBody/FeedCardBodyV1';
import './activity-feed-card-v2.less';
import { ActivityFeedCardV2Props } from './ActivityFeedCardV2.interface';
import FeedCardFooter from './FeedCardFooter/FeedCardFooter';
import FeedCardHeaderV2 from './FeedCardHeader/FeedCardHeaderV2';

const ActivityFeedCardV2 = ({
  post,
  feed,
  isPost = false,
  isActive = false,
  showThread = false,
  componentsVisibility = {
    showThreadIcon: true,
    showRepliesContainer: true,
  },
}: Readonly<ActivityFeedCardV2Props>) => {
  const { color, character, backgroundColor } = useMemo(
    () => getRandomColor(post.from),
    [post.from]
  );

  const postLength = useMemo(
    () => feed?.posts?.length ?? 0,
    [feed?.posts?.length]
  );

  return (
    <div
      className={classNames('feed-card-v2', {
        active: isActive,
        'feed-reply-card-v2': isPost,
      })}>
      <div
        className={classNames('feed-card-v2-sidebar', {
          'feed-card-v2-post-sidebar': isPost,
        })}>
        <Avatar
          icon={character}
          size={isPost ? 28 : 30}
          style={{
            color,
            backgroundColor,
            fontWeight: 500,
            border: `0.5px solid ${color}`,
          }}
        />
        {!isPost && <Divider className="flex-1" type="vertical" />}
      </div>
      <Row>
        <Col span={24}>
          <FeedCardHeaderV2
            about={!isPost ? feed.about : undefined}
            createdBy={post.from}
            isEntityFeed={isPost}
            timeStamp={post.postTs}
          />
        </Col>
        <Col span={24}>
          <FeedCardBodyV1
            announcement={!isPost ? feed.announcement : undefined}
            isEditPost={false}
            message={post.message}
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
        {showThread && postLength > 0 && (
          <div data-testid="feed-replies">
            {feed?.posts?.map((reply) => (
              <ActivityFeedCardV2
                isPost
                componentsVisibility={componentsVisibility}
                feed={feed}
                key={reply.id}
                post={reply}
              />
            ))}
          </div>
        )}
      </Row>
    </div>
  );
};

export default ActivityFeedCardV2;
