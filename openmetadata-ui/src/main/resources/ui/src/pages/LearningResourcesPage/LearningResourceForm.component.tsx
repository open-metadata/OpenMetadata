/*
 *  Copyright 2024 Collate.
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

import { CloseOutlined } from '@ant-design/icons';
import { Button, Drawer, Form, Input, Select, Space } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as StoryLaneIcon } from '../../assets/svg/ic_storylane.svg';
import { ReactComponent as VideoIcon } from '../../assets/svg/ic_video.svg';
import {
  CATEGORIES,
  DURATIONS,
  LearningResourceStatus,
  LEARNING_RESOURCE_STATUSES,
  PAGE_IDS,
  ResourceType,
  ResourceTypeOption,
} from '../../constants/Learning.constants';
import {
  createLearningResource,
  CreateLearningResource,
  updateLearningResource,
} from '../../rest/learningResourceAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './learning-resource-form.less';
import { LearningResourceFormProps } from './LearningResourceForm.interface';

const { TextArea } = Input;

export const LearningResourceForm: React.FC<LearningResourceFormProps> = ({
  open,
  resource,
  onClose,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const RESOURCE_TYPES: ResourceTypeOption[] = useMemo(
    () => [
      {
        value: ResourceType.Video,
        label: t('label.video'),
        icon: <VideoIcon height={24} width={24} />,
      },
      {
        value: ResourceType.Storylane,
        label: t('label.storylane'),
        icon: <StoryLaneIcon height={24} width={24} />,
      },
    ],
    [t]
  );

  useEffect(() => {
    if (resource) {
      form.setFieldsValue({
        name: resource.name,
        description: resource.description,
        resourceType: resource.resourceType,
        categories: resource.categories,
        difficulty: resource.difficulty,
        sourceUrl: resource.source.url,
        sourceProvider: resource.source.provider,
        estimatedDuration: resource.estimatedDuration,
        contexts: resource.contexts?.map((ctx) => ctx.pageId) || [],
        status: resource.status || LearningResourceStatus.Active,
      });
    } else {
      form.resetFields();
    }
  }, [resource, form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);

      const contexts = values.contexts.map(
        (ctx: string | { pageId: string; componentId?: string }) => ({
          componentId:
            typeof ctx === 'object' ? ctx.componentId || undefined : undefined,
          pageId: typeof ctx === 'string' ? ctx : ctx.pageId,
        })
      );

      const payload: CreateLearningResource = {
        categories: values.categories,
        contexts,
        description: values.description,
        difficulty: values.difficulty,
        estimatedDuration: values.estimatedDuration,
        name: values.name,
        resourceType: values.resourceType,
        source: {
          provider: values.sourceProvider,
          url: values.sourceUrl,
        },
        status: values.status,
      };

      if (resource) {
        await updateLearningResource(payload);
        showSuccessToast(
          t('server.entity-updated-success', {
            entity: t('label.learning-resource'),
          })
        );
      } else {
        await createLearningResource(payload);
        showSuccessToast(
          t('server.create-entity-success', {
            entity: t('label.learning-resource'),
          })
        );
      }

      onClose();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      showErrorToast(error as AxiosError);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, resource, t, onClose]);

  const parseDuration = (duration: string): number => {
    const match = duration.match(/(\d+)/);

    return match ? parseInt(match[1], 10) * 60 : 0;
  };

  const drawerTitle = (
    <div className="drawer-title-container">
      <span className="drawer-title">
        {resource ? t('label.edit-resource') : t('label.add-resource')}
      </span>
      <CloseOutlined className="drawer-close" onClick={onClose} />
    </div>
  );

  const drawerFooter = (
    <div className="drawer-footer">
      <Button data-testid="cancel-resource" onClick={onClose}>
        {t('label.cancel')}
      </Button>
      <Button
        data-testid="save-resource"
        loading={isSubmitting}
        type="primary"
        onClick={handleSubmit}>
        {t('label.save')}
      </Button>
    </div>
  );

  return (
    <Drawer
      destroyOnClose
      className="learning-resource-form-drawer"
      closable={false}
      data-testid="learning-resource-form-drawer"
      footer={drawerFooter}
      open={open}
      placement="right"
      title={drawerTitle}
      width={600}
      onClose={onClose}>
      <Form
        className="learning-resource-form"
        form={form}
        initialValues={{
          categories: [],
          contexts: [],
          status: LearningResourceStatus.Active,
        }}
        layout="vertical">
        <Form.Item
          className="form-item-required"
          label={t('label.name')}
          name="name"
          rules={[
            {
              message: t('label.field-required', {
                field: t('label.name'),
              }),
              required: true,
            },
          ]}>
          <Input
            data-testid="name-input"
            disabled={Boolean(resource)}
            placeholder={t('label.enter-entity', { entity: t('label.name') })}
          />
        </Form.Item>

        <Form.Item
          className="form-item-required form-item-description"
          label={t('label.description')}
          name="description"
          rules={[
            {
              message: t('label.field-required', {
                field: t('label.description'),
              }),
              required: true,
            },
          ]}>
          <TextArea
            data-testid="description-input"
            placeholder={t('message.enter-description')}
            rows={6}
          />
        </Form.Item>

        <Form.Item
          className="form-item-required form-item-type"
          data-testid="resource-type-form-item"
          label={t('label.type')}
          name="resourceType"
          rules={[
            {
              message: t('label.field-required', {
                field: t('label.type'),
              }),
              required: true,
            },
          ]}>
          <Select
            data-testid="resource-type-select"
            placeholder={t('label.select-field', { field: t('label.type') })}>
            {RESOURCE_TYPES.map((type) => (
              <Select.Option key={type.value} value={type.value}>
                <Space align="center">
                  {type.icon}
                  {type.label}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          className="form-item-required"
          data-testid="categories-form-item"
          label={t('label.category-plural')}
          name="categories"
          normalize={(val) =>
            Array.isArray(val) ? val : val != null ? [val] : []
          }
          rules={[
            {
              message: t('label.field-required', {
                field: t('label.category-plural'),
              }),
              required: true,
            },
          ]}>
          <Select
            data-testid="categories-select"
            mode="multiple"
            options={CATEGORIES}
            placeholder={t('label.select-type')}
          />
        </Form.Item>

        <Form.Item
          className="form-item-required"
          data-testid="contexts-form-item"
          label={t('label.context')}
          name="contexts"
          normalize={(val) =>
            Array.isArray(val) ? val : val != null ? [val] : []
          }
          rules={[
            {
              validator: async (_, contexts) => {
                if (!contexts || contexts.length < 1) {
                  return Promise.reject(
                    new Error(
                      t('label.field-required', {
                        field: t('label.context'),
                      })
                    )
                  );
                }
              },
            },
          ]}>
          <Select
            data-testid="contexts-select"
            mode="multiple"
            options={PAGE_IDS}
            placeholder={t('label.select-field', { field: t('label.context') })}
          />
        </Form.Item>

        <Form.Item
          dependencies={['resourceType']}
          label={t('label.source-url')}
          name="sourceUrl"
          rules={[
            {
              message: t('label.field-required', {
                field: t('label.source-url'),
              }),
              required: true,
            },
            { message: t('label.invalid-url'), type: 'url' },
          ]}>
          <Input
            data-testid="source-url-input"
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </Form.Item>

        <Form.Item label={t('label.source-provider')} name="sourceProvider">
          <Input placeholder="YouTube, Storylane, etc." />
        </Form.Item>

        <Form.Item label={t('label.duration')} name="estimatedDuration">
          <Select
            allowClear
            options={DURATIONS.map((d) => ({
              label: d,
              value: parseDuration(d),
            }))}
            placeholder={t('label.select-duration')}
          />
        </Form.Item>

        <Form.Item
          data-testid="status-form-item"
          label={t('label.status')}
          name="status">
          <Select
            data-testid="status-select"
            options={LEARNING_RESOURCE_STATUSES.map((status) => ({
              label: status,
              value: status,
            }))}
            placeholder={t('label.select-status')}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};
