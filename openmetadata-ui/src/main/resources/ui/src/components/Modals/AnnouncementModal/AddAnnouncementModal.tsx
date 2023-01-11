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
import { AxiosError } from 'axios';
import { observer } from 'mobx-react';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postThread } from 'rest/feedsAPI';
import AppState from '../../../AppState';
import {
  CreateThread,
  ThreadType,
} from '../../../generated/api/feed/createThread';
import { validateMessages } from '../../../utils/AnnouncementsUtils';
import { getEntityFeedLink } from '../../../utils/EntityUtils';
import { getTimeZone, getUTCDateTime } from '../../../utils/TimeUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import RichTextEditor from '../../common/rich-text-editor/RichTextEditor';
import './AnnouncementModal.less';

interface Props {
  open: boolean;
  entityType: string;
  entityFQN: string;
  onCancel: () => void;
}

const AddAnnouncementModal: FC<Props> = ({
  open,
  onCancel,
  entityType,
  entityFQN,
}) => {
  // get current user details
  const currentUser = useMemo(
    () => AppState.getCurrentUserDetails(),
    [AppState.userDetails, AppState.nonSecureUserDetails]
  );

  const [title, setTitle] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { t } = useTranslation();

  const handleCreateAnnouncement = async () => {
    const startTime = Math.floor(getUTCDateTime(startDate) / 1000);
    const endTime = Math.floor(getUTCDateTime(endDate) / 1000);
    if (startTime >= endTime) {
      showErrorToast(t('message.announcement-invalid-start-time'));
    } else {
      const announcementData: CreateThread = {
        from: currentUser?.name as string,
        message: title,
        about: getEntityFeedLink(entityType, entityFQN),
        announcementDetails: {
          description,
          startTime,
          endTime,
        },
        type: ThreadType.Announcement,
      };
      try {
        setIsLoading(true);
        const data = await postThread(announcementData);
        if (data) {
          showSuccessToast(t('message.announcement-created-successfully'));
        }
        onCancel();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Modal
      centered
      className="announcement-modal"
      closable={false}
      confirmLoading={isLoading}
      data-testid="add-announcement"
      okButtonProps={{
        id: 'announcement-submit',
        form: 'announcement-form',
        type: 'primary',
        htmlType: 'submit',
      }}
      okText="Submit"
      open={open}
      title={t('message.make-an-announcement')}
      width={720}
      onCancel={onCancel}>
      <Form
        data-testid="announcement-form"
        id="announcement-form"
        layout="vertical"
        validateMessages={validateMessages}
        onFinish={handleCreateAnnouncement}>
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
            messageVariables={{ fieldName: 'endtDate' }}
            name="endtDate"
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

export default observer(AddAnnouncementModal);
