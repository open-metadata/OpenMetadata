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

import { Button, Drawer, Form, Input, Select, Space, Switch } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EntityType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  createTestDefinition,
  updateTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

interface TestDefinitionFormProps {
  initialValues?: TestDefinition;
  onSuccess: () => void;
  onCancel: () => void;
}

const TestDefinitionForm: React.FC<TestDefinitionFormProps> = ({
  initialValues,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = Boolean(initialValues);

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue({
        name: initialValues.name,
        displayName: initialValues.displayName,
        description: initialValues.description,
        entityType: initialValues.entityType,
        testPlatforms: initialValues.testPlatforms,
        enabled: initialValues.enabled ?? true,
      });
    } else {
      form.setFieldsValue({ enabled: true });
    }
  }, [initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);

      const payload: TestDefinition = {
        ...initialValues,
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        entityType: values.entityType,
        testPlatforms: values.testPlatforms,
        enabled: values.enabled,
      };

      if (isEditMode) {
        await updateTestDefinition(payload);
        showSuccessToast(
          t('message.entity-updated-success', {
            entity: t('label.test-definition'),
          })
        );
      } else {
        await createTestDefinition(payload);
        showSuccessToast(
          t('message.entity-created-success', {
            entity: t('label.test-definition'),
          })
        );
      }

      onSuccess();
    } catch (error) {
      showErrorToast(error as Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      open
      title={
        isEditMode
          ? t('label.edit-entity', { entity: t('label.test-definition') })
          : t('label.add-entity', { entity: t('label.test-definition') })
      }
      width={600}
      onClose={onCancel}>
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('label.name')}
          name="name"
          rules={[
            {
              required: true,
              message: t('message.field-text-is-required', {
                fieldText: t('label.name'),
              }),
            },
          ]}>
          <Input
            disabled={isEditMode}
            placeholder={t('label.enter-entity-name', {
              entity: t('label.test-definition'),
            })}
          />
        </Form.Item>

        <Form.Item label={t('label.display-name')} name="displayName">
          <Input
            placeholder={t('label.enter-entity-name', {
              entity: t('label.display-name'),
            })}
          />
        </Form.Item>

        <Form.Item
          label={t('label.description')}
          name="description"
          rules={[
            {
              required: true,
              message: t('message.field-text-is-required', {
                fieldText: t('label.description'),
              }),
            },
          ]}>
          <Input.TextArea
            placeholder={t('label.enter-entity-description', {
              entity: t('label.test-definition'),
            })}
            rows={4}
          />
        </Form.Item>

        <Form.Item
          label={t('label.entity-type')}
          name="entityType"
          rules={[
            {
              required: true,
              message: t('message.field-text-is-required', {
                fieldText: t('label.entity-type'),
              }),
            },
          ]}>
          <Select
            disabled={isEditMode}
            options={Object.values(EntityType).map((type) => ({
              label: type,
              value: type,
            }))}
            placeholder={t('label.select-field', {
              field: t('label.entity-type'),
            })}
          />
        </Form.Item>

        <Form.Item
          label={t('label.test-platform')}
          name="testPlatforms"
          rules={[
            {
              required: true,
              message: t('message.field-text-is-required', {
                fieldText: t('label.test-platform'),
              }),
            },
          ]}>
          <Select
            mode="multiple"
            options={Object.values(TestPlatform).map((platform) => ({
              label: platform,
              value: platform,
            }))}
            placeholder={t('label.select-field', {
              field: t('label.test-platform'),
            })}
          />
        </Form.Item>

        <Form.Item
          label={t('label.enabled')}
          name="enabled"
          valuePropName="checked">
          <Switch />
        </Form.Item>

        <Space className="w-full justify-end">
          <Button onClick={onCancel}>{t('label.cancel')}</Button>
          <Button
            data-testid="save-test-definition"
            loading={isSubmitting}
            type="primary"
            onClick={handleSubmit}>
            {t('label.save')}
          </Button>
        </Space>
      </Form>
    </Drawer>
  );
};

export default TestDefinitionForm;
