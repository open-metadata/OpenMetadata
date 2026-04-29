/*
 *  Copyright 2026 Collate.
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

import {
  Button,
  Drawer,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreateTask,
  createTask,
  DataAccessPermission,
  DataAccessRequestPayload,
  DataAccessType,
  TaskCategory,
  TaskEntityType,
  TaskPriority,
} from '../../../rest/tasksAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../utils/ToastUtils';
import {
  ACCESS_TYPE_OPTIONS,
  DURATION_OPTIONS,
} from '../../../utils/DataAccessRequest/DataAccessRequestUtils';
import { DataAccessRequestDrawerProps } from '../DataAccessRequest.interface';

const { Title } = Typography;

const DataAccessRequestDrawer = ({
  open,
  entityFqn,
  entityType,
  entityDisplayName,
  availableColumns,
  reviewers,
  onClose,
  onCreated,
}: DataAccessRequestDrawerProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const accessType = Form.useWatch('accessType', form) as
    | DataAccessType
    | undefined;

  const columnOptions = useMemo(
    () =>
      (availableColumns ?? []).map((col) => ({
        label: col.split('.').pop() ?? col,
        value: col,
      })),
    [availableColumns]
  );

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload: DataAccessRequestPayload = {
        accessType: values.accessType,
        requestedAccess:
          values.requestedAccess ?? DataAccessPermission.Read,
        reason: values.reason,
        ...(values.duration ? { duration: values.duration } : {}),
        ...(values.accessType === DataAccessType.ColumnLevel
          ? { columns: values.columns ?? [] }
          : {}),
        ...(values.ticketId ? { ticketId: values.ticketId } : {}),
      };

      const requestBody: CreateTask = {
        name: `dar-${entityFqn}-${Date.now()}`,
        displayName: t('label.request-access-to-entity', {
          entity: entityDisplayName,
        }),
        category: TaskCategory.DataAccess,
        type: TaskEntityType.DataAccessRequest,
        priority: TaskPriority.Medium,
        about: entityFqn,
        aboutType: entityType,
        ...(reviewers && reviewers.length > 0 ? { reviewers } : {}),
        payload: payload as unknown as Record<string, unknown>,
      };

      const created = await createTask(requestBody);
      showSuccessToast(t('message.data-access-request-created'));
      onCreated?.(created);
      form.resetFields();
      onClose();
    } catch (error) {
      const axiosError = error as AxiosError;

      if ((error as { errorFields?: unknown[] }).errorFields) {
        return;
      }
      showErrorToast(axiosError);
    } finally {
      setSubmitting(false);
    }
  }, [
    entityDisplayName,
    entityFqn,
    entityType,
    form,
    onClose,
    onCreated,
    reviewers,
    t,
  ]);

  return (
    <Drawer
      destroyOnClose
      footer={
        <Space className="tw:w-full tw:justify-end" data-testid="dar-footer">
          <Button data-testid="dar-cancel" onClick={onClose}>
            {t('label.cancel')}
          </Button>
          <Button
            data-testid="dar-submit"
            loading={submitting}
            type="primary"
            onClick={handleSubmit}>
            {t('label.request-access')}
          </Button>
        </Space>
      }
      open={open}
      title={
        <Title data-testid="dar-drawer-title" level={5}>
          {t('label.request-data-access')}
        </Title>
      }
      width={520}
      onClose={onClose}>
      <Form
        data-testid="dar-form"
        form={form}
        initialValues={{
          accessType: DataAccessType.FullAccess,
          requestedAccess: DataAccessPermission.Read,
          duration: 'P14D',
          columns: [],
        }}
        layout="vertical">
        <Form.Item label={t('label.dataset')}>
          <Input
            disabled
            data-testid="dar-dataset"
            value={entityDisplayName}
          />
        </Form.Item>

        <Form.Item
          label={t('label.access-type')}
          name="accessType"
          rules={[
            {
              required: true,
              message: t('message.field-required', {
                field: t('label.access-type'),
              }),
            },
          ]}>
          <Radio.Group data-testid="dar-access-type">
            {ACCESS_TYPE_OPTIONS.map((option) => {
              const disabled =
                option.value === DataAccessType.ColumnLevel &&
                columnOptions.length === 0;

              return (
                <Radio
                  data-testid={`dar-access-type-${option.value}`}
                  disabled={disabled}
                  key={option.value}
                  value={option.value}>
                  <span>{t(option.labelKey)}</span>
                  <Typography.Paragraph
                    className="tw:text-xs tw:m-0"
                    type="secondary">
                    {t(option.descriptionKey)}
                  </Typography.Paragraph>
                </Radio>
              );
            })}
          </Radio.Group>
        </Form.Item>

        {accessType === DataAccessType.ColumnLevel && (
          <Form.Item
            label={t('label.select-columns')}
            name="columns"
            rules={[
              {
                required: true,
                type: 'array',
                min: 1,
                message: t('message.select-at-least-one-column'),
              },
            ]}>
            <Select
              allowClear
              showSearch
              data-testid="dar-columns"
              mode="multiple"
              options={columnOptions}
              placeholder={t('label.select-columns')}
            />
          </Form.Item>
        )}

        <Form.Item label={t('label.duration')} name="duration">
          <Select
            data-testid="dar-duration"
            options={DURATION_OPTIONS.map((opt) => ({
              label: t(opt.labelKey),
              value: opt.value,
            }))}
            placeholder={t('label.select-duration')}
          />
        </Form.Item>

        <Form.Item
          label={t('label.access-reason')}
          name="reason"
          rules={[
            {
              required: true,
              message: t('message.field-required', {
                field: t('label.access-reason'),
              }),
            },
            { min: 5, message: t('message.access-reason-min-length') },
          ]}>
          <Input.TextArea
            data-testid="dar-reason"
            placeholder={t('label.access-reason-placeholder')}
            rows={4}
          />
        </Form.Item>

        <Form.Item label={t('label.permission-level')} name="requestedAccess">
          <Select
            data-testid="dar-permission"
            options={Object.values(DataAccessPermission).map((p) => ({
              label: p,
              value: p,
            }))}
          />
        </Form.Item>

        <Form.Item label={t('label.external-ticket-id')} name="ticketId">
          <Input data-testid="dar-ticket-id" placeholder="JIRA / ServiceNow" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default DataAccessRequestDrawer;
