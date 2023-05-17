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
import { Thread } from 'generated/entity/feed/thread';
import React from 'react';
import './activity-feed-card.style.less';
import FeedCardBodyV1 from './FeedCardBody/FeedCardBodyV1';
import FeedCardHeaderV1 from './FeedCardHeader/FeedCardHeaderV1';

interface ActivityFeedCardV1Props {
  feed: Thread;
  className?: string;
}

const ActivityFeedCardV1 = ({
  feed,
  className = '',
}: ActivityFeedCardV1Props) => (
  <div className={classNames(className, 'activity-feed-card')}>
    <Row>
      <Col span={24}>
        <div className="d-flex flex-col">
          <FeedCardHeaderV1 feed={feed} />
        </div>
      </Col>
    </Row>
    <Row>
      <Col className="p-t-xs" span={24}>
        <div className="d-flex flex-col">
          <FeedCardBodyV1 feed={feed} isEditPost={false} />
        </div>
      </Col>
    </Row>
  </div>
);

export default ActivityFeedCardV1;
