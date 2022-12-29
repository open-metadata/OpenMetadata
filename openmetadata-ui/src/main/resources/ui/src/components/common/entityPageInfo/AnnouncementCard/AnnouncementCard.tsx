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

import { Button, Card, Space, Typography } from 'antd';
import React, { FC } from 'react';
import { Thread } from '../../../../generated/entity/feed/thread';
import SVGIcons, { Icons } from '../../../../utils/SvgUtils';
import './AnnouncementCard.less';

interface Props {
  onClick: () => void;
  announcement: Thread;
}

const AnnouncementCard: FC<Props> = ({ onClick, announcement }) => {
  const viewCap = 64;
  const title = announcement.message;
  const hasMore = title.length > viewCap;

  return (
    <Card
      className="announcement-card"
      data-testid="announcement-card"
      onClick={onClick}>
      <Space align="start" size={12}>
        <SVGIcons
          alt="announcement"
          icon={Icons.ANNOUNCEMENT_YELLOW}
          width="24px"
        />
        <div>
          <Typography.Text>
            {title.slice(0, viewCap)}
            {hasMore ? '...' : ''}
          </Typography.Text>
          <Button
            data-testid="read-more"
            size="small"
            type="link"
            onClick={onClick}>
            Read more
          </Button>
        </div>
      </Space>
    </Card>
  );
};

export default AnnouncementCard;
