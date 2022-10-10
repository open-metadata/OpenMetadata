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

import { Form, Input, Modal, Space } from 'antd';
import { observer } from 'mobx-react';
import React, { FC, useState } from 'react';
import { AnnouncementDetails } from '../../../generated/entity/feed/thread';
import {
  announcementInvalidStartTime,
  validateMessages,
} from '../../../utils/AnnouncementsUtils';
import {
  getLocaleDateFromTimeStamp,
  getTimeZone,
  getUTCDateTime,
} from '../../../utils/TimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import './AnnouncementModal.less';

interface Props {
  announcement: AnnouncementDetails;
  announcementTitle: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (title: string, announcement: AnnouncementDetails) => void;
}

const EditAnnouncementModal: FC<Props> = ({
  open,
  onCancel,
  onConfirm,
  announcementTitle,
  announcement,
}) => {
  const [title, setTitle] = useState<string>(announcementTitle);
  const [startDate, setStartDate] = useState<string>(
    getLocaleDateFromTimeStamp(announcement.startTime * 1000)
  );
  const [endDate, setEndDate] = useState<string>(
    getLocaleDateFromTimeStamp(announcement.endTime * 1000)
  );
  const [description, setDescription] = useState<string>(
    announcement.description || ''
  );

  const handleConfirm = () => {
    const startTime = Math.floor(getUTCDateTime(startDate) / 1000);
    const endTime = Math.floor(getUTCDateTime(endDate) / 1000);
    if (startTime >= endTime) {
      showErrorToast(announcementInvalidStartTime);
    } else {
      const updatedAnnouncement = {
        ...announcement,
        description,
        startTime,
        endTime,
      };

      onConfirm(title, updatedAnnouncement);
    }
  };

  return (
    <Modal
      centered
      className="announcement-modal"
      data-testid="edit-announcement"
      okButtonProps={{
        form: 'announcement-form',
        type: 'primary',
        htmlType: 'submit',
      }}
      okText="Save"
      title="Edit an announcement"
      visible={open}
      width={620}
      onCancel={onCancel}>
      <Form
        data-testid="announcement-form"
        id="announcement-form"
        initialValues={{ title, startDate, endDate }}
        layout="vertical"
        validateMessages={validateMessages}
        onFinish={handleConfirm}>
        <Form.Item
          label="Title:"
          name="title"
          rules={[
            {
              required: true,
              max: 124,
              min: 5,
            },
          ]}>
          <Input
            placeholder="Announcement title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Form.Item>
        <Space className="announcement-date-space" size={16}>
          <Form.Item
            label={`Start Date: (${getTimeZone()})`}
            name="startDate"
            rules={[
              {
                required: true,
              },
            ]}>
            <Input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Form.Item>
          <Form.Item
            label={`End Date: (${getTimeZone()})`}
            name="endDate"
            rules={[
              {
                required: true,
              },
            ]}>
            <Input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Form.Item>
        </Space>
        <Form.Item label="Description:" name="description">
          <RichTextEditor
            initialValue={description}
            placeHolder="write your announcement"
            onTextChange={(value) => setDescription(value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default observer(EditAnnouncementModal);
