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
import { LeftOutlined } from '@ant-design/icons';
import { Button, Col, Row } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import classNames from 'classnames';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import { Thread } from 'generated/entity/feed/thread';
import { noop } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import './activity-feed-card.style.less';
import FeedCardBodyV1 from './FeedCardBody/FeedCardBodyV1';
import FeedCardHeaderV1 from './FeedCardHeader/FeedCardHeaderV1';
import { ReactComponent as DeleteIcon } from '/assets/svg/ic-delete.svg';
import { ReactComponent as ThreadIcon } from '/assets/svg/thread.svg';

interface ActivityFeedCardV1Props {
  feed: Thread;
  className?: string;
  showThread?: boolean;
}

const ActivityFeedCardV1 = ({
  feed,
  className = '',
  showThread = true,
}: ActivityFeedCardV1Props) => {
  const { t } = useTranslation();
  const postLength = feed?.posts?.length || 0;
  const repliedUsers = [...new Set((feed?.posts || []).map((f) => f.from))];
  const repliedUniqueUsersList = repliedUsers.slice(0, postLength >= 3 ? 2 : 1);

  return (
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
      {showThread && postLength > 0 && (
        <Row>
          <Col className="p-t-sm" span={24}>
            <div className="d-flex items-center">
              <div className="d-flex items-center thread-count">
                <ThreadIcon width={18} />{' '}
                <span className="text-xs p-l-xss">{postLength}</span>
              </div>
              <div className="p-l-md thread-users-profile-pic">
                {repliedUniqueUsersList.map((user) => (
                  <ProfilePicture
                    className=""
                    id=""
                    key={user}
                    name={user}
                    type="circle"
                    width="24"
                  />
                ))}
              </div>
            </div>
          </Col>
        </Row>
      )}

      <div className="feed-actions">
        <Button
          className="expand-button"
          icon={<LeftOutlined />}
          size="small"
        />

        <div className="action-buttons">
          <Button
            className="toolbar-button"
            data-testid="add-reactions"
            size="small"
            type="text"
            onClick={(e) => e.stopPropagation()}>
            <SVGIcons
              alt="add-reaction"
              icon={Icons.REACTION}
              title={t('label.add-entity', {
                entity: t('label.reaction-lowercase-plural'),
              })}
              width="20px"
            />
          </Button>

          <Button
            className="toolbar-button"
            data-testid="add-reply"
            size="small"
            type="text"
            onClick={noop}>
            <SVGIcons
              alt="add-reply"
              icon={Icons.ADD_REPLY}
              title={t('label.reply')}
              width="20px"
            />
          </Button>

          <Button
            className="toolbar-button"
            data-testid="edit-message"
            icon={<EditIcon width={18} />}
            size="small"
            type="text"
            onClick={noop}
          />

          <Button
            className="toolbar-button"
            data-testid="delete-message"
            icon={<DeleteIcon width={18} />}
            size="small"
            type="text"
            onClick={noop}
          />
        </div>
      </div>
    </div>
  );
};

export default ActivityFeedCardV1;
