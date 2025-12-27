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
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography,
} from 'antd';
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

const { TextArea } = Input;
const { Text } = Typography;

interface LearningResourceFormProps {
  open: boolean;
  resource: LearningResource | null;
  onClose: () => void;
}

const RESOURCE_TYPES = ['Article', 'Video', 'Storylane'];
const DIFFICULTIES = ['Intro', 'Intermediate', 'Advanced'];
const CATEGORIES = [
  'Discovery',
  'Administration',
  'DataGovernance',
  'DataQuality',
  'Observability',
];
const STATUSES = ['Draft', 'Active', 'Deprecated'];

const PAGE_IDS = [
  'glossary',
  'glossaryTerm',
  'domain',
  'dataProduct',
  'data-quality',
  'table-details',
  'dashboard-details',
  'pipeline-details',
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

  return (
    <Modal
      centered
      destroyOnClose
      footer={
        <Space>
          <Button onClick={onClose}>{t('label.cancel')}</Button>
          <Button
            data-testid="save-resource"
            loading={isSubmitting}
            type="primary"
            onClick={handleSubmit}>
            {resource ? t('label.update') : t('label.create')}
          </Button>
        </Space>
      }
      open={open}
      title={
        resource
          ? t('label.edit-entity', { entity: t('label.learning-resource') })
          : t('label.add-entity', { entity: t('label.learning-resource') })
      }
      width={800}
      onCancel={onClose}>
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('label.name')}
          name="name"
          rules={[{ message: t('label.field-required'), required: true }]}>
          <Input placeholder="e.g., Intro_GlossaryBasics" />
        </Form.Item>

        <Form.Item label={t('label.display-name')} name="displayName">
          <Input placeholder="e.g., Glossary Basics" />
        </Form.Item>

        <Form.Item label={t('label.description')} name="description">
          <TextArea placeholder={t('message.enter-description')} rows={3} />
        </Form.Item>

        <Form.Item
          label={t('label.type')}
          name="resourceType"
          rules={[{ message: t('label.field-required'), required: true }]}>
          <Select
            options={RESOURCE_TYPES.map((type) => ({
              label: type,
              value: type,
            }))}
            placeholder={t('label.select-field', { field: t('label.type') })}
            onChange={setResourceType}
          />
        </Form.Item>

        <Form.Item
          label={t('label.category-plural')}
          name="categories"
          rules={[{ message: t('label.field-required'), required: true }]}>
          <Select
            mode="multiple"
            options={CATEGORIES.map((cat) => ({ label: cat, value: cat }))}
            placeholder={t('label.select-field', {
              field: t('label.category-plural'),
            })}
          />
        </Form.Item>

        <Form.Item label={t('label.difficulty')} name="difficulty">
          <Select
            allowClear
            options={DIFFICULTIES.map((diff) => ({
              label: diff,
              value: diff,
            }))}
            placeholder={t('label.select-field', {
              field: t('label.difficulty'),
            })}
          />
        </Form.Item>

        <Form.Item
          label={t('label.source-url')}
          name="sourceUrl"
          rules={[
            { message: t('label.field-required'), required: true },
            { message: t('message.invalid-url'), type: 'url' },
          ]}>
          <Input placeholder="https://..." />
        </Form.Item>

        <Form.Item label={t('label.source-provider')} name="sourceProvider">
          <Input placeholder="e.g., OpenMetadata, Collate, YouTube" />
        </Form.Item>

        {resourceType === 'Article' && (
          <Form.Item label={t('label.embedded-content')}>
            <Text type="secondary">
              {t('message.optional-markdown-content')}
            </Text>
            <RichTextEditor
              height="200px"
              initialValue={embedContent}
              placeHolder={t('message.write-markdown-content')}
              onTextChange={setEmbedContent}
            />
          </Form.Item>
        )}

        <Form.Item
          label={t('label.estimated-duration-minutes')}
          name="estimatedDuration">
          <InputNumber
            min={1}
            placeholder="e.g., 5"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label={t('label.context-plural')}
          name="contexts"
          rules={[{ message: t('label.field-required'), required: true }]}>
          <Form.List name="contexts">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space align="baseline" key={field.key} size="small">
                    <Form.Item
                      {...field}
                      name={[field.name, 'pageId']}
                      rules={[
                        { message: t('label.field-required'), required: true },
                      ]}>
                      <Select
                        options={PAGE_IDS.map((id) => ({
                          label: id,
                          value: id,
                        }))}
                        placeholder={t('label.page-id')}
                        style={{ width: 200 }}
                      />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'componentId']}>
                      <Input
                        placeholder={t('label.component-id-optional')}
                        style={{ width: 200 }}
                      />
                    </Form.Item>
                    <Button
                      danger
                      size="small"
                      onClick={() => remove(field.name)}>
                      {t('label.remove')}
                    </Button>
                  </Space>
                ))}
                <Button block type="dashed" onClick={() => add()}>
                  {t('label.add-entity', { entity: t('label.context') })}
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item label={t('label.status')} name="status">
          <Select
            options={STATUSES.map((status) => ({
              label: status,
              value: status,
            }))}
            placeholder={t('label.select-field', { field: t('label.status') })}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
