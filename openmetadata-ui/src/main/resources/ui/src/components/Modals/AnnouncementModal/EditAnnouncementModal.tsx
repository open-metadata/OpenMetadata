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

import { Form, Input, Modal, Space } from 'antd';
import { observer } from 'mobx-react';
import React, { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnnouncementDetails } from '../../../generated/entity/feed/thread';
import { validateMessages } from '../../../utils/AnnouncementsUtils';
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
  const { t } = useTranslation();

  const handleConfirm = () => {
    const startTime = Math.floor(getUTCDateTime(startDate) / 1000);
    const endTime = Math.floor(getUTCDateTime(endDate) / 1000);
    if (startTime >= endTime) {
      showErrorToast(t('message.announcement-invalid-start-time'));
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
      closable={false}
      data-testid="edit-announcement"
      maskClosable={false}
      okButtonProps={{
        form: 'announcement-form',
        type: 'primary',
        htmlType: 'submit',
      }}
      okText={t('label.save')}
      open={open}
      title={t('label.edit-an-announcement')}
      width={720}
      onCancel={onCancel}>
      <Form
        data-testid="announcement-form"
        id="announcement-form"
        initialValues={{ title, startDate, endDate }}
        layout="vertical"
        validateMessages={validateMessages}
        onFinish={handleConfirm}>
        <Form.Item
          label={`${t('label.title')}:`}
          messageVariables={{ fieldName: 'title' }}
          name="title"
          rules={[
            {
              required: true,
              max: 124,
              min: 5,
            },
          ]}>
          <Input
            placeholder={t('label.announcement-title')}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Form.Item>
        <Space className="announcement-date-space" size={16}>
          <Form.Item
            label={t('label.start-date-time-zone', {
              timeZone: getTimeZone(),
            })}
            messageVariables={{ fieldName: 'startDate' }}
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
            label={t('label.end-date-time-zone', {
              timeZone: getTimeZone(),
            })}
            messageVariables={{ fieldName: 'endDate' }}
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
        <Form.Item label={`${t('label.description')}:`} name="description">
          <RichTextEditor
            initialValue={description}
            placeHolder={t('message.write-your-announcement-lowercase')}
            onTextChange={(value) => setDescription(value)}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default observer(EditAnnouncementModal);
