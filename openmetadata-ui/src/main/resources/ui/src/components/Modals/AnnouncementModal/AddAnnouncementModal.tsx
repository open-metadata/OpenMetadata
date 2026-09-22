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
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VALIDATION_MESSAGES } from '../../../constants/constants';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import { createAnnouncement } from '../../../rest/announcementsAPI';
import { getTimeZone } from '../../../utils/date-time/DateTimeUtils';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

import { FieldProp, FieldTypes } from '../../../interface/FormUtils.interface';
import { getField } from '../../../utils/formUtils';
import DatePicker from '../../common/DatePicker/DatePicker';
import './announcement-modal.less';
import { AnnouncementFormValues } from './AnnouncementModal.interface';
import {
  AnnouncementColorSelect,
  AnnouncementTypeSelect,
} from './AnnouncementTypeField.component';

interface Props {
  open: boolean;
  entityType: string;
  entityFQN: string;
  onCancel: () => void;
  onSave: () => void;
}

const AddAnnouncementModal: FC<Props> = ({
  open,
  onCancel,
  onSave,
  entityType,
  entityFQN,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { t } = useTranslation();

  const handleCreateAnnouncement = async ({
    title,
    startTime,
    endTime,
    description,
    announcementType,
    color,
  }: AnnouncementFormValues) => {
    const startTimeMs = startTime.toMillis();
    const endTimeMs = endTime.toMillis();

    if (startTimeMs >= endTimeMs) {
      showErrorToast(t('message.announcement-invalid-start-time'));
    } else {
      try {
        setIsLoading(true);
        const data = await createAnnouncement({
          displayName: title,
          description,
          entityLink: getEntityFeedLink(entityType, entityFQN),
          startTime: startTimeMs,
          endTime: endTimeMs,
          announcementType,
          color:
            announcementType === AnnouncementType.Custom ? color : undefined,
        });
        if (data) {
          showSuccessToast(t('message.announcement-created-successfully'));
        }
        onSave();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const descriptionField: FieldProp = useMemo(
    () => ({
      name: 'description',
      required: false,
      label: `${t('label.description')}:`,
      id: 'root/description',
      type: FieldTypes.DESCRIPTION,
      props: {
        'data-testid': 'description',
        initialValue: '',
        placeHolder: t('message.write-your-announcement-lowercase'),
      },
    }),
    []
  );

  return (
    <Modal
      centered
      className="announcement-modal"
      closable={false}
      confirmLoading={isLoading}
      data-testid="add-announcement"
      maskClosable={false}
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
      <Form<AnnouncementFormValues>
        data-testid="announcement-form"
        id="announcement-form"
        initialValues={{ announcementType: AnnouncementType.Notice }}
        layout="vertical"
        validateMessages={VALIDATION_MESSAGES}
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
          <Input placeholder={t('label.announcement-title')} type="text" />
        </Form.Item>
        <Form.Item
          label={`${t('label.announcement-type')}:`}
          name="announcementType"
          rules={[{ required: true }]}>
          <AnnouncementTypeSelect />
        </Form.Item>
        <Form.Item
          noStyle
          shouldUpdate={(prev, next) =>
            prev.announcementType !== next.announcementType
          }>
          {({ getFieldValue }) =>
            getFieldValue('announcementType') === AnnouncementType.Custom && (
              <Form.Item
                label={`${t('label.color')}:`}
                name="color"
                rules={[{ required: true }]}>
                <AnnouncementColorSelect />
              </Form.Item>
            )
          }
        </Form.Item>
        <Space className="announcement-date-space" size={16}>
          <Form.Item
            label={t('label.start-date-time-zone', {
              timeZone: getTimeZone(),
            })}
            messageVariables={{ fieldName: 'startDate' }}
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
            messageVariables={{ fieldName: 'endtDate' }}
            name="endTime"
            rules={[
              {
                required: true,
              },
            ]}>
            <DatePicker className="w-full" />
          </Form.Item>
        </Space>
        {getField(descriptionField)}
      </Form>
    </Modal>
  );
};

export default AddAnnouncementModal;
