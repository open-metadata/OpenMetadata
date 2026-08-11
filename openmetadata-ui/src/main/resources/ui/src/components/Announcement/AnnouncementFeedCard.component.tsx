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
import { Card, Col, Row } from 'antd';
import AnnouncementBadge from '../ActivityFeed/Shared/AnnouncementBadge';
import { AnnouncementFeedCardProp } from './Announcement.interface';
import './announcement.less';
import AnnouncementFeedCardBody from './AnnouncementFeedCardBody.component';

const AnnouncementFeedCard = ({
  announcement,
  editPermission,
  onConfirmation,
  updateAnnouncementHandler,
}: AnnouncementFeedCardProp) => {
  return (
    <Row>
      <Col span={24}>
        <Card
          className="ant-card-feed announcement-thread-card"
          data-testid="announcement-card">
          <AnnouncementBadge />
          <AnnouncementFeedCardBody
            announcement={announcement}
            editPermission={editPermission}
            updateAnnouncementHandler={updateAnnouncementHandler}
            onConfirmation={onConfirmation}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default AnnouncementFeedCard;
