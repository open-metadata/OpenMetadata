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

import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import {
  DataQualityDimensions,
  DataType,
  EntityType,
  TestDataType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  createTestDefinition,
  updateTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import SchemaEditor from '../../Database/SchemaEditor/SchemaEditor';

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
  const [sqlExpression, setSqlExpression] = useState('');

  const isEditMode = Boolean(initialValues);

  useEffect(() => {
    if (initialValues) {
      const initialSqlExpression = (initialValues as any).sqlExpression || '';
      setSqlExpression(initialSqlExpression);
      form.setFieldsValue({
        name: initialValues.name,
        displayName: initialValues.displayName,
        description: initialValues.description,
        entityType: initialValues.entityType,
        dataQualityDimension: initialValues.dataQualityDimension,
        supportedDataTypes: initialValues.supportedDataTypes,
        parameterDefinition: initialValues.parameterDefinition,
        enabled: initialValues.enabled ?? true,
      });
    } else {
      form.setFieldsValue({
        enabled: true,
        testPlatforms: [TestPlatform.OpenMetadata],
      });
    }
  }, [initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setIsSubmitting(true);

      const payload: any = {
        ...initialValues,
        name: values.name,
        displayName: values.displayName,
        description: values.description,
        sqlExpression: sqlExpression,
        entityType: values.entityType,
        testPlatforms: [TestPlatform.OpenMetadata],
        dataQualityDimension: values.dataQualityDimension,
        supportedDataTypes: values.supportedDataTypes,
        parameterDefinition: values.parameterDefinition,
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
      width={720}
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

        <div className="m-b-md">
          <Typography.Text strong>{t('label.sql-query')}</Typography.Text>
          <Typography.Paragraph className="m-t-xss text-grey-muted">
            {t('message.test-definition-sql-query-help')}
          </Typography.Paragraph>
          <SchemaEditor
            className="custom-query-editor query-editor-h-200"
            mode={{ name: CSMode.SQL }}
            value={sqlExpression}
            onChange={(value) => setSqlExpression(value)}
          />
        </div>

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
          label={t('label.data-quality-dimension')}
          name="dataQualityDimension">
          <Select
            options={Object.values(DataQualityDimensions).map((dimension) => ({
              label: dimension,
              value: dimension,
            }))}
            placeholder={t('label.select-field', {
              field: t('label.data-quality-dimension'),
            })}
          />
        </Form.Item>

        <Form.Item
          label={t('label.supported-data-type-plural')}
          name="supportedDataTypes">
          <Select
            mode="multiple"
            options={Object.values(DataType).map((dataType) => ({
              label: dataType,
              value: dataType,
            }))}
            placeholder={t('label.select-field', {
              field: t('label.supported-data-type-plural'),
            })}
          />
        </Form.Item>

        <Typography.Title level={5}>
          {t('label.parameter-plural')}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('message.test-definition-parameters-description')}
        </Typography.Text>

        <Form.List name="parameterDefinition">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Card
                  extra={<MinusCircleOutlined onClick={() => remove(name)} />}
                  key={key}
                  size="small"
                  style={{ marginTop: 16 }}
                  title={`${t('label.parameter')} ${name + 1}`}>
                  <Form.Item
                    {...restField}
                    label={t('label.name')}
                    name={[name, 'name']}
                    rules={[
                      {
                        required: true,
                        message: t('message.field-text-is-required', {
                          fieldText: t('label.name'),
                        }),
                      },
                    ]}>
                    <Input placeholder={t('label.parameter-name')} />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    label={t('label.display-name')}
                    name={[name, 'displayName']}>
                    <Input placeholder={t('label.parameter-display-name')} />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    label={t('label.description')}
                    name={[name, 'description']}>
                    <Input.TextArea
                      placeholder={t('label.parameter-description')}
                      rows={2}
                    />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    label={t('label.data-type')}
                    name={[name, 'dataType']}
                    rules={[
                      {
                        required: true,
                        message: t('message.field-text-is-required', {
                          fieldText: t('label.data-type'),
                        }),
                      },
                    ]}>
                    <Select
                      options={Object.values(TestDataType).map((type) => ({
                        label: type,
                        value: type,
                      }))}
                      placeholder={t('label.select-field', {
                        field: t('label.data-type'),
                      })}
                    />
                  </Form.Item>

                  <Form.Item
                    {...restField}
                    label={t('label.required')}
                    name={[name, 'required']}
                    valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Card>
              ))}
              <Button
                block
                icon={<PlusOutlined />}
                style={{ marginTop: 16 }}
                type="dashed"
                onClick={() => add()}>
                {t('label.add-entity', { entity: t('label.parameter') })}
              </Button>
            </>
          )}
        </Form.List>

        <Form.Item
          label={t('label.enabled')}
          name="enabled"
          style={{ marginTop: 16 }}
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
