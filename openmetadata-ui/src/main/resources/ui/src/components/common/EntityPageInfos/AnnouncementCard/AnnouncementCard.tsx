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

import { RichTextEditorPreviewerV1 } from '@openmetadata/common-ui';
import { Card, Space, Typography } from 'antd';
import { FC, useMemo } from 'react';
import { ReactComponent as AnnouncementIcon } from '../../../../assets/svg/announcements-v1.svg';
import { Thread } from '../../../../generated/entity/feed/thread';
import './AnnouncementCard.less';

interface Props {
  onClick: () => void;
  announcement: Thread;
}

const AnnouncementCard: FC<Props> = ({ onClick, announcement }) => {
  const { title, message } = useMemo(
    () => ({
      title: announcement.message,
      message: announcement?.announcement?.description,
    }),
    [announcement]
  );

  return (
    <Card
      className="announcement-card"
      data-testid="announcement-card"
      onClick={onClick}>
      <Space align="start" className="m-0" size={4}>
        <AnnouncementIcon
          className="announcement-icon"
          height={20}
          width={20}
        />
        <Typography.Paragraph
          ellipsis
          className="announcement-title"
          data-testid="announcement-title">
          {title}
        </Typography.Paragraph>
      </Space>
      {message && (
        <RichTextEditorPreviewerV1
          className="text-grey-muted m-0 text-xss"
          data-testid="announcement-message"
          markdown={message}
          reducePreviewLineClass="max-one-line"
          showReadMoreBtn={false}
        />
      )}
    </Card>
  );
};

export default AnnouncementCard;
