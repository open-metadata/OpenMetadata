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
import { Button, Drawer, Form, Input, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArticalIcon } from '../../assets/svg/artical.svg';
import { ReactComponent as StoryLaneIcon } from '../../assets/svg/story-lane.svg';
import { ReactComponent as VideoIcon } from '../../assets/svg/video.svg';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import {
  createLearningResource,
  CreateLearningResource,
  LearningResource,
  updateLearningResource,
} from '../../rest/learningResourceAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './learning-resource-form.less';
const { TextArea } = Input;
const { Text } = Typography;

interface LearningResourceFormProps {
  open: boolean;
  resource: LearningResource | null;
  onClose: () => void;
}

const RESOURCE_TYPES = [
  {
    value: 'Video',
    label: 'Video',
    icon: <VideoIcon height={16} width={16} />,
  },
  {
    value: 'Storylane',
    label: 'Storylane',
    icon: <StoryLaneIcon height={16} width={16} />,
  },
  {
    value: 'Article',
    label: 'Article',
    icon: <ArticalIcon height={16} width={16} />,
  },
];
const CATEGORIES = [
  { value: 'Discovery', label: 'Discovery' },
  { value: 'DataGovernance', label: 'Governance' },
  { value: 'DataQuality', label: 'Data Quality' },
  { value: 'Observability', label: 'Observability' },
  { value: 'Administration', label: 'Admin' },
  { value: 'AI', label: 'AI' },
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
  // Domains & Data Products
  { value: 'domain', label: 'Domain' },
  { value: 'dataProduct', label: 'Data Product' },
  // Glossaries
  { value: 'glossary', label: 'Glossary' },
  { value: 'glossaryTerm', label: 'Glossary Term' },
  // Classification
  { value: 'classification', label: 'Classification' },
  { value: 'tags', label: 'Tags' },
  // Lineage
  { value: 'lineage', label: 'Lineage' },
  // Data Insights
  { value: 'dataInsights', label: 'Data Insights' },
  { value: 'dataInsightDashboards', label: 'Data Insight Dashboards' },
  // Data Quality
  { value: 'dataQuality', label: 'Data Quality' },
  { value: 'testSuite', label: 'Test Suite' },
  { value: 'incidentManager', label: 'Incident Manager' },
  { value: 'profilerConfiguration', label: 'Profiler Configuration' },
  // Rules Library
  { value: 'rulesLibrary', label: 'Rules Library' },
  // Explore & Discovery
  { value: 'explore', label: 'Explore' },
  { value: 'table', label: 'Table' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'pipeline', label: 'Pipeline' },
  { value: 'topic', label: 'Topic' },
  { value: 'container', label: 'Container' },
  { value: 'mlmodel', label: 'ML Model' },
  { value: 'storedProcedure', label: 'Stored Procedure' },
  { value: 'searchIndex', label: 'Search Index' },
  { value: 'apiEndpoint', label: 'API Endpoint' },
  { value: 'apiCollection', label: 'API Collection' },
  { value: 'database', label: 'Database' },
  { value: 'databaseSchema', label: 'Database Schema' },
  // Home Page
  { value: 'homePage', label: 'Home Page' },
  { value: 'myData', label: 'My Data' },
  // Workflows & Automations
  { value: 'workflows', label: 'Workflows' },
  { value: 'automations', label: 'Automations' },
  // Knowledge Center
  { value: 'knowledgeCenter', label: 'Knowledge Center' },
  // SQL Studio
  { value: 'sqlStudio', label: 'SQL Studio' },
  { value: 'queryBuilder', label: 'Query Builder' },
  // Ask Collate
  { value: 'askCollate', label: 'Ask Collate' },
  { value: 'aiAssistant', label: 'AI Assistant' },
  // Metrics
  { value: 'metrics', label: 'Metrics' },
  // Observability
  { value: 'dataObservability', label: 'Data Observability' },
  { value: 'pipelineObservability', label: 'Pipeline Observability' },
  { value: 'alerts', label: 'Alerts' },
  // Administration
  { value: 'services', label: 'Services' },
  { value: 'policies', label: 'Policies' },
  { value: 'roles', label: 'Roles' },
  { value: 'teams', label: 'Teams' },
  { value: 'users', label: 'Users' },
  { value: 'notificationTemplates', label: 'Notification Templates' },
  { value: 'ingestionRunners', label: 'Ingestion Runners' },
  { value: 'usage', label: 'Usage' },
  { value: 'settings', label: 'Settings' },
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
        contexts: resource.contexts?.map((ctx) => ctx.pageId) || [],
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
          t('server.create-entity-success', {
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
      width={600}
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
          rules={[
            {
              message: t('label.field-required', {
                field: t('label.name'),
              }),
              required: true,
            },
          ]}>
          <Input
            placeholder={t('label.enter-entity', { entity: t('label.name') })}
          />
        </Form.Item>

        <Form.Item
          className="form-item-required"
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
          <TextArea placeholder={t('message.enter-description')} rows={3} />
        </Form.Item>

        <Form.Item
          className="form-item-required"
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
            placeholder={t('label.select-field', { field: t('label.type') })}
            onChange={setResourceType}>
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
          label={t('label.page-plural')}
          name="contexts"
          rules={[
            {
              validator: async (_, contexts) => {
                if (!contexts || contexts.length < 1) {
                  return Promise.reject(
                    new Error(
                      t('label.field-required', {
                        field: t('label.page-plural'),
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
            placeholder={t('label.select-page-plural')}
          />
        </Form.Item>

        <Form.Item
          label={t('label.source-url')}
          name="sourceUrl"
          rules={[
            {
              message: t('label.field-required', {
                field: t('label.source-url'),
              }),
              required: true,
            },
            { message: t('message.invalid-url'), type: 'url' },
          ]}>
          <Input placeholder="https://www.youtube.com/watch?v=..." />
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
