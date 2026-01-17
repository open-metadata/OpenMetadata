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

import {
  CloseOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Form, Input, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import {
  createLearningResource,
  CreateLearningResource,
  LearningResource,
  updateLearningResource,
} from '../../rest/learningResourceAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './LearningResourceForm.less';

const { TextArea } = Input;
const { Text } = Typography;

interface LearningResourceFormProps {
  open: boolean;
  resource: LearningResource | null;
  onClose: () => void;
}

const RESOURCE_TYPES = [
  { value: 'Video', label: 'Video', icon: <PlayCircleOutlined /> },
  { value: 'Storylane', label: 'Storylane', icon: <RocketOutlined /> },
  { value: 'Article', label: 'Article', icon: <FileTextOutlined /> },
];
const CATEGORIES = [
  'Discovery',
  'Administration',
  'DataGovernance',
  'DataQuality',
  'Observability',
];
const STATUSES = ['Draft', 'Active', 'Deprecated'];
const DURATIONS = [
  '1 min',
  '2 mins',
  '3 mins',
  '5 mins',
  '10 mins',
  '15 mins',
  '30 mins',
];

const PAGE_IDS = [
  'glossary',
  'glossaryTerm',
  'domain',
  'dataProduct',
  'dataQuality',
  'testSuite',
  'incidentManager',
  'profilerConfiguration',
  'lineage',
  'table',
  'dashboard',
  'pipeline',
  'topic',
  'container',
  'mlmodel',
  'storedProcedure',
  'searchIndex',
  'automations',
  'services',
  'policies',
  'roles',
  'dataObservability',
];

export const LearningResourceForm: React.FC<LearningResourceFormProps> = ({
  open,
  resource,
  onClose,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [embedContent, setEmbedContent] = useState('');
  const [resourceType, setResourceType] = useState<string>('Article');

  useEffect(() => {
    if (resource) {
      const embedConfig = resource.source.embedConfig as Record<
        string,
        unknown
      >;
      setEmbedContent((embedConfig?.content as string) || '');
      setResourceType(resource.resourceType);
      form.setFieldsValue({
        name: resource.name,
        displayName: resource.displayName,
        description: resource.description,
        resourceType: resource.resourceType,
        categories: resource.categories,
        difficulty: resource.difficulty,
        sourceUrl: resource.source.url,
        sourceProvider: resource.source.provider,
        estimatedDuration: resource.estimatedDuration
          ? Math.floor(resource.estimatedDuration / 60)
          : undefined,
        contexts: resource.contexts,
        status: resource.status || 'Active',
      });
    } else {
      form.resetFields();
      setEmbedContent('');
      setResourceType('Article');
    }
  }, [resource, form]);

  const handleSubmit = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);

      const contexts = values.contexts.map(
        (ctx: { pageId: string; componentId?: string }) => ({
          componentId: ctx.componentId || undefined,
          pageId: ctx.pageId,
        })
      );

      const payload: CreateLearningResource = {
        categories: values.categories,
        contexts,
        description: values.description,
        difficulty: values.difficulty,
        displayName: values.displayName,
        estimatedDuration: values.estimatedDuration
          ? values.estimatedDuration * 60
          : undefined,
        name: values.name,
        resourceType: values.resourceType,
        source: {
          embedConfig:
            values.resourceType === 'Article' && embedContent
              ? { content: embedContent }
              : undefined,
          provider: values.sourceProvider,
          url: values.sourceUrl,
        },
        status: values.status,
      };

      if (resource) {
        await updateLearningResource(resource.id, payload);
        showSuccessToast(
          t('message.entity-updated-successfully', {
            entity: t('label.learning-resource'),
          })
        );
      } else {
        await createLearningResource(payload);
        showSuccessToast(
          t('message.entity-created-successfully', {
            entity: t('label.learning-resource'),
          })
        );
      }

      onClose();
    } catch (error) {
      if (error instanceof Error && 'errorFields' in error) {
        return;
      }
      showErrorToast(error as AxiosError);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, resource, embedContent, t, onClose]);

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
      <Button onClick={onClose}>{t('label.cancel')}</Button>
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
      footer={drawerFooter}
      open={open}
      placement="right"
      title={drawerTitle}
      width={480}
      onClose={onClose}>
      <Form
        className="learning-resource-form"
        form={form}
        initialValues={{ status: 'Active' }}
        layout="vertical">
        <Form.Item
          className="form-item-required"
          label={t('label.name')}
          name="name"
          rules={[{ message: t('label.field-required'), required: true }]}>
          <Input
            placeholder={t('label.enter-entity', { entity: t('label.name') })}
          />
        </Form.Item>

        <Form.Item
          className="form-item-required"
          label={t('label.description')}
          name="description"
          rules={[{ message: t('label.field-required'), required: true }]}>
          <TextArea placeholder={t('message.enter-description')} rows={3} />
        </Form.Item>

        <Form.Item
          className="form-item-required"
          label={t('label.type')}
          name="resourceType"
          rules={[{ message: t('label.field-required'), required: true }]}>
          <Select
            optionLabelProp="label"
            placeholder={t('label.select-field', { field: t('label.type') })}
            onChange={setResourceType}>
            {RESOURCE_TYPES.map((type) => (
              <Select.Option
                key={type.value}
                label={type.label}
                value={type.value}>
                <Space>
                  {type.icon}
                  {type.label}
                </Space>
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          className="form-item-required"
          label={t('label.category-plural')}
          name="categories"
          rules={[{ message: t('label.field-required'), required: true }]}>
          <Select
            mode="multiple"
            options={CATEGORIES.map((cat) => ({ label: cat, value: cat }))}
            placeholder={t('label.select-type')}
          />
        </Form.Item>

        <Form.Item
          className="form-item-required"
          label={t('label.context')}
          name="contexts"
          rules={[
            {
              validator: async (_, contexts) => {
                if (!contexts || contexts.length < 1) {
                  return Promise.reject(new Error(t('label.field-required')));
                }
              },
            },
          ]}>
          <Select
            mode="multiple"
            options={PAGE_IDS.map((id) => ({ label: id, value: id }))}
            placeholder={t('label.select-context')}
            onChange={(values: string[]) => {
              form.setFieldsValue({
                contexts: values.map((pageId) => ({ pageId })),
              });
            }}
          />
        </Form.Item>

        <Form.Item
          label={t('label.source-url')}
          name="sourceUrl"
          rules={[
            { message: t('label.field-required'), required: true },
            { message: t('message.invalid-url'), type: 'url' },
          ]}>
          <Input placeholder="https://www.youtube.com/watch?v=..." />
        </Form.Item>

        <Form.Item label={t('label.source-provider')} name="sourceProvider">
          <Input placeholder="https://www.youtube.com/watch?v=..." />
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

        <Form.Item label={t('label.status')} name="status">
          <Select
            options={STATUSES.map((status) => ({
              label: status,
              value: status,
            }))}
            placeholder={t('label.select-status')}
          />
        </Form.Item>

        {resourceType === 'Article' && (
          <Form.Item label={t('label.embedded-content')}>
            <Text className="embedded-content-hint" type="secondary">
              {t('message.optional-markdown-content')}
            </Text>
            <RichTextEditor
              initialValue={embedContent}
              placeHolder={t('message.write-markdown-content')}
              onTextChange={setEmbedContent}
            />
          </Form.Item>
        )}
      </Form>
    </Drawer>
  );
};
