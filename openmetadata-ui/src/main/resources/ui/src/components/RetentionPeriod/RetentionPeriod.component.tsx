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
import { Button, Form, FormProps, InputNumber, Modal, Space } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { Duration, DurationObjectUnits } from 'luxon';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../assets/svg/edit-new.svg';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
  VALIDATION_MESSAGES,
} from '../../constants/constants';
import { showErrorToast } from '../../utils/ToastUtils';
import { ExtraInfoLabel } from '../DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { RetentionPeriodProps } from './RetentionPeriod.interface';

const RetentionPeriod = ({
  retentionPeriod,
  onUpdate,
}: RetentionPeriodProps) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const retentionDuration = useMemo(() => {
    if (!retentionPeriod) {
      return NO_DATA_PLACEHOLDER;
    }
    const durationObject = Duration.fromISO(retentionPeriod);

    if (!durationObject.isValid) {
      return NO_DATA_PLACEHOLDER;
    }

    const durationObjectToObj = durationObject.toObject();

    if (durationObjectToObj.days) {
      form.setFieldsValue({
        days: durationObjectToObj.days,
        hours: durationObjectToObj.hours,
      });
    }

    let durationString = '';

    const durationKeysArray = Object.keys(durationObjectToObj);

    durationKeysArray.forEach((key, index) => {
      durationString += ` ${
        durationObjectToObj[key as keyof DurationObjectUnits]
      } ${key} ${durationKeysArray.length === index + 1 ? '' : 'and'}`;
    });

    return durationString;
  }, [retentionPeriod]);

  const onCancel = useCallback(() => setIsEdit(false), []);

  const handleSubmit: FormProps['onFinish'] = async ({ days, hours }) => {
    setIsLoading(true);
    try {
      if (days || hours) {
        // create a duration object with provided days and hour
        const duration = Duration.fromObject({ days, hours });

        // Format the duration in ISO 8601 format
        const iso8601Duration = duration.toISO();

        await onUpdate(iso8601Duration);
      } else {
        await onUpdate(undefined);
      }

      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Space data-testid="retention-period-container">
        <ExtraInfoLabel
          label={t('label.retention-period')}
          value={retentionDuration}
        />

        <Button
          className="flex-center p-0"
          data-testid="edit-retention-period-button"
          icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
          size="small"
          type="text"
          onClick={() => setIsEdit(true)}
        />
      </Space>

      <Modal
        centered
        destroyOnClose
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
        <Form
          data-testid="retention-period-form"
          form={form}
          id="retention-period-form"
          validateMessages={VALIDATION_MESSAGES}
          onFinish={handleSubmit}>
          <Form.Item
            label={t('label.day-plural')}
            name="days"
            rules={[
              {
                min: 1,
                type: 'number',
                message: t('message.entity-must-be-greater-than-zero', {
                  entity: t('label.day-plural'),
                }),
              },
            ]}>
            <InputNumber className="w-full" data-testid="days-period-input" />
          </Form.Item>

          <Form.Item
            label={t('label.hour-plural')}
            name="hours"
            rules={[
              {
                min: 0,
                max: 23,
                type: 'number',
              },
            ]}>
            <InputNumber className="w-full" data-testid="hours-period-input" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RetentionPeriod;
