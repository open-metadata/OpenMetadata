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
import { Alert, Button, Form, FormProps, Input, Modal, Space, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { Duration } from 'luxon';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import {
    DE_ACTIVE_COLOR,
    NO_DATA_PLACEHOLDER,
    VALIDATION_MESSAGES
} from '../../../constants/constants';
import { showErrorToast } from '../../../utils/ToastUtils';
import { Tooltip } from '../../common/AntdCompat';
import './retention-period.less';
import { RetentionPeriodProps } from './RetentionPeriod.interface';
;
// Helper function to detect and format ISO 8601 duration
const formatRetentionPeriod = (retentionPeriod: string | undefined) => {
  if (!retentionPeriod) {
    return NO_DATA_PLACEHOLDER;
  }

  const isoDurationRegex =
    /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/;
  // Check if the string matches the ISO 8601 duration format
  if (isoDurationRegex.test(retentionPeriod)) {
    const duration = Duration.fromISO(retentionPeriod);

    const years = duration.years
      ? `${duration.years} year${duration.years > 1 ? 's' : ''}`
      : '';
    const months = duration.months
      ? `${duration.months} month${duration.months > 1 ? 's' : ''}`
      : '';
    const weeks = duration.weeks
      ? `${duration.weeks} week${duration.weeks > 1 ? 's' : ''}`
      : '';
    const days = duration.days
      ? `${duration.days} day${duration.days > 1 ? 's' : ''}`
      : '';
    const hours = duration.hours
      ? `${duration.hours} hour${duration.hours > 1 ? 's' : ''}`
      : '';
    const minutes = duration.minutes
      ? `${duration.minutes} minute${duration.minutes > 1 ? 's' : ''}`
      : '';
    const seconds = duration.seconds
      ? `${duration.seconds} second${duration.seconds > 1 ? 's' : ''}`
      : '';

    const formattedDuration = [
      years,
      months,
      weeks,
      days,
      hours,
      minutes,
      seconds,
    ]
      .filter(Boolean)
      .join(' ');

    return formattedDuration || NO_DATA_PLACEHOLDER;
  }

  // If it's not ISO, return the plain string
  return retentionPeriod;
};
const RetentionPeriod = ({
  retentionPeriod,
  onUpdate,
  hasPermission,
}: RetentionPeriodProps) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const onCancel = useCallback(() => setIsEdit(false), []);

  const handleSubmit: FormProps['onFinish'] = async ({ retentionPeriod }) => {
    setIsLoading(true);
    try {
      await onUpdate(retentionPeriod);
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    form.setFieldsValue({ retentionPeriod });
  }, [retentionPeriod]);

  return (
    <div className="d-flex items-start gap-1">
      <Space
        className="d-flex retention-period-container align-start"
        data-testid="retention-period-container">
        <div className="d-flex ">
          <Typography.Text className="text-sm d-flex flex-col gap-2">
            <div className="d-flex items-center gap-1">
              <span className="extra-info-label-heading">
                {t('label.retention-period')}
              </span>
              {hasPermission && (
                <Tooltip
                  title={t('label.edit-entity', {
                    entity: t('label.retention-period'),
                  })}>
                  <Button
                    className="remove-button-default-styling  flex-center edit-retention-period-button p-0"
                    data-testid="edit-retention-period-button"
                    icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
                    type="text"
                    onClick={() => setIsEdit(true)}
                  />
                </Tooltip>
              )}
            </div>

            <span className={`font-medium extra-info-value `}>
              {formatRetentionPeriod(retentionPeriod) ?? NO_DATA_PLACEHOLDER}
            </span>
          </Typography.Text>
        </div>
      </Space>

      <Modal
        centered
        destroyOnClose
        cancelText={t('label.cancel')}
        closable={false}
        confirmLoading={isLoading}
        data-testid="retention-period-modal"
        maskClosable={false}
        okButtonProps={{
          form: 'retention-period-form',
          type: 'primary',
          htmlType: 'submit',
        }}
        okText={t('label.save')}
        open={isEdit}
        title={t('label.edit-entity', {
          entity: t('label.retention-period'),
        })}
        onCancel={onCancel}>
        <Alert
          className="m-b-sm"
          description={t('message.retention-period-description')}
          type="info"
        />
        <Form
          data-testid="retention-period-form"
          form={form}
          id="retention-period-form"
          layout="vertical"
          validateMessages={VALIDATION_MESSAGES}
          onFinish={handleSubmit}>
          <Form.Item label={t('label.retention-period')} name="retentionPeriod">
            <Input data-testid="retention-period-input" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RetentionPeriod;
