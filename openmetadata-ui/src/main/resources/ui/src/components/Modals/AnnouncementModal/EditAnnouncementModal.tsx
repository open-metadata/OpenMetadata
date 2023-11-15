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

import { DatePicker, Form, Input, Modal, Space } from 'antd';
import { observer } from 'mobx-react';
import moment from 'moment';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { AnnouncementDetails } from '../../../generated/entity/feed/thread';
import { getTimeZone } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import { CreateAnnouncement } from './AddAnnouncementModal';
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
  const { t } = useTranslation();

  const handleConfirm = ({
    title,
    description,
    startTime,
    endTime,
  }: CreateAnnouncement) => {
    const startTimeMs = startTime.unix();
    const endTimeMs = endTime.unix();

    if (startTimeMs >= endTimeMs) {
      showErrorToast(t('message.announcement-invalid-start-time'));
    } else {
      const updatedAnnouncement = {
        ...announcement,
        description,
        startTime: startTimeMs,
        endTime: endTimeMs,
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
        initialValues={{
          title: announcementTitle,
          description: announcement.description,
          startTime: moment.unix(announcement.startTime),
          endTime: moment.unix(announcement.endTime),
        }}
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
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
          <Input placeholder={t('label.announcement-title')} type="text" />
        </Form.Item>
        <Space className="announcement-date-space" size={16}>
          <Form.Item
            label={t('label.start-date-time-zone', {
              timeZone: getTimeZone(),
            })}
            messageVariables={{ fieldName: 'startTime' }}
            name="startTime"
            rules={[
              {
                required: true,
              },
            ]}>
            <DatePicker className="w-full" />
          </Form.Item>
          <Form.Item
            label={t('label.end-date-time-zone', {
              timeZone: getTimeZone(),
            })}
            messageVariables={{ fieldName: 'endTime' }}
            name="endTime"
            rules={[
              {
                required: true,
              },
            ]}>
            <DatePicker className="w-full" />
          </Form.Item>
        </Space>
        <Form.Item
          label={`${t('label.description')}:`}
          name="description"
          trigger="onTextChange"
          valuePropName="initialValue">
          <RichTextEditor
            placeHolder={t('message.write-your-announcement-lowercase')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default observer(EditAnnouncementModal);
