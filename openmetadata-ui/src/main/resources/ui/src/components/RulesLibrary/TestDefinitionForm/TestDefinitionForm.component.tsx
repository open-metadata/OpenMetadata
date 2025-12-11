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
  MinusCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import { CreateTestDefinition } from '../../../generated/api/tests/createTestDefinition';
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
  patchTestDefinition,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import FormItemLabel from '../../common/Form/FormItemLabel';
import CodeEditor from '../../Database/SchemaEditor/CodeEditor';

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

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      console.log('Values:', values);
      setIsSubmitting(true);

      if (isEditMode && initialValues) {
        const updatedValues: TestDefinition = {
          ...initialValues,
          ...values,
        };
        const patch = compare(initialValues, updatedValues);
        if (patch.length > 0) {
          await patchTestDefinition(initialValues?.id ?? '', patch);
        }
        showSuccessToast(
          t('server.entity-updated-success', {
            entity: t('label.test-definition'),
          })
        );
      } else {
        const payload: CreateTestDefinition = {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          sqlExpression: values.sqlExpression,
          entityType: values.entityType,
          testPlatforms: values.testPlatforms,
          dataQualityDimension: values.dataQualityDimension,
          supportedDataTypes: values.supportedDataTypes,
          parameterDefinition: values.parameterDefinition,
        };
        await createTestDefinition(payload);
        showSuccessToast(
          t('server.entity-created-success', {
            entity: t('label.test-definition'),
          })
        );
      }

      onSuccess();
    } catch (error) {
      showErrorToast(error as AxiosError);
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
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          ...initialValues,
          testPlatforms: initialValues?.testPlatforms || [
            TestPlatform.OpenMetadata,
          ],
        }}>
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

        <Form.Item name="sqlExpression">
          <CodeEditor
            showCopyButton
            refreshEditor
            className="custom-query-editor query-editor-h-200"
            mode={{ name: CSMode.SQL }}
            title={
              <div className="ant-form-item-label">
                <label className="d-flex align-items-center">
                  <Typography.Text className="form-label-title">
                    {t('label.sql-query')}
                  </Typography.Text>
                  <Tooltip title={t('message.test-definition-sql-query-help')}>
                    <QuestionCircleOutlined className="ant-form-item-tooltip" />
                  </Tooltip>
                </label>
              </div>
            }
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
            id="entityType"
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
          label={t('label.test-platform-plural')}
          name="testPlatforms"
          rules={[
            {
              required: true,
              message: t('message.field-text-is-required', {
                fieldText: t('label.test-platform-plural'),
              }),
            },
          ]}>
          <Select
            id="testPlatforms"
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

        <Form.Item
          label={
            <FormItemLabel
              label={t('label.parameter-plural')}
              helperText={t('message.test-definition-parameters-description')}
            />
          }>
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
        </Form.Item>
        {isEditMode && (
          <Form.Item
            label={t('label.enabled')}
            name="enabled"
            style={{ marginTop: 16 }}
            valuePropName="checked">
            <Switch />
          </Form.Item>
        )}

        <Space className="w-full justify-end m-t-lg">
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
