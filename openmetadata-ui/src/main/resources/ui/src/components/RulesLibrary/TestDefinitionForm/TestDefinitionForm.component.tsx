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
import { Button, Card, Drawer, Form, Input, Select, Space, Switch } from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg';
import { CSMode } from '../../../enums/codemirror.enum';
import { CreateTestDefinition } from '../../../generated/api/tests/createTestDefinition';
import { DatabaseServiceType } from '../../../generated/entity/services/databaseService';
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
import { handleSearchFilterOption } from '../../../utils/CommonUtils';
import { createScrollToErrorHandler } from '../../../utils/formUtils';
import { isExternalTestDefinition } from '../../../utils/TestDefinitionUtils';
import { showSuccessToast } from '../../../utils/ToastUtils';
import AlertBar from '../../AlertBar/AlertBar';
import FormItemLabel from '../../common/Form/FormItemLabel';
import CodeEditor from '../../Database/SchemaEditor/CodeEditor';

interface TestDefinitionFormProps {
  initialValues?: TestDefinition;
  onSuccess: (data?: TestDefinition) => void;
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
  const [errorMessage, setErrorMessage] = useState<string>('');
  const isEditMode = Boolean(initialValues);
  const scrollToError = useMemo(() => createScrollToErrorHandler(), []);

  const isReadOnlyField = useMemo(() => {
    if (!initialValues) {
      return false;
    }

    const isExternalTest = isExternalTestDefinition(initialValues);

    return isExternalTest && isEditMode;
  }, [initialValues, isEditMode]);

  const databaseServiceTypes = useMemo(() => {
    return Object.values(DatabaseServiceType).map((service) => ({
      label: service,
      value: service,
    }));
  }, []);

  const handleSubmit = async (values: TestDefinition) => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      if (isEditMode && initialValues) {
        const updatedValues = {
          ...initialValues,
          ...values,
        };
        const patch = compare(initialValues, updatedValues);
        if (patch.length > 0) {
          const result = await patchTestDefinition(
            initialValues?.id ?? '',
            patch
          );
          onSuccess(result);
          showSuccessToast(
            t('server.entity-updated-success', {
              entity: t('label.test-definition'),
            })
          );
        }
      } else {
        let validatorClass: string | undefined;
        if (values.sqlExpression) {
          validatorClass =
            values.entityType === EntityType.Column
              ? 'ColumnRuleLibrarySqlExpressionValidator'
              : 'TableRuleLibrarySqlExpressionValidator';
        }

        const payload: CreateTestDefinition = {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          sqlExpression: values.sqlExpression,
          entityType: values.entityType ?? EntityType.Table,
          testPlatforms: values.testPlatforms,
          dataQualityDimension: values.dataQualityDimension,
          supportedDataTypes: values.supportedDataTypes,
          supportedServices: values.supportedServices,
          parameterDefinition: values.parameterDefinition,
          validatorClass,
        };
        await createTestDefinition(payload);
        showSuccessToast(
          t('server.entity-created-success', {
            entity: t('label.test-definition'),
          })
        );
        onSuccess();
      }
    } catch (error) {
      const errorMsg =
        (error as AxiosError<{ message: string }>)?.response?.data?.message ||
        (isEditMode
          ? t('server.update-entity-error', {
              entity: t('label.test-definition'),
            })
          : t('server.create-entity-error', {
              entity: t('label.test-definition'),
            }));
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      destroyOnClose
      open
      className="custom-drawer-style"
      closable={false}
      extra={
        <Button
          className="drawer-close-icon flex-center"
          data-testid="close-drawer-button"
          icon={<CloseIcon />}
          type="link"
          onClick={onCancel}
        />
      }
      footer={
        <Space className="w-full justify-end">
          <Button onClick={onCancel}>{t('label.cancel')}</Button>
          <Button
            data-testid="save-test-definition"
            htmlType="submit"
            loading={isSubmitting}
            type="primary"
            onClick={() => form.submit()}>
            {t('label.save')}
          </Button>
        </Space>
      }
      title={
        isEditMode
          ? t('label.edit-entity', { entity: t('label.test-definition') })
          : t('label.add-entity', { entity: t('label.test-definition') })
      }
      width={720}
      onClose={onCancel}>
      {errorMessage && (
        <div className="m-b-md">
          <AlertBar
            defaultExpand
            className="test-definition-form-alert"
            message={errorMessage}
            type="error"
          />
        </div>
      )}
      <Form
        className="new-form-style"
        form={form}
        initialValues={{
          ...initialValues,
          testPlatforms: initialValues?.testPlatforms || [
            TestPlatform.OpenMetadata,
          ],
          supportedServices: initialValues?.supportedServices || [],
        }}
        layout="vertical"
        onFinish={handleSubmit}
        onFinishFailed={scrollToError}>
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
          label={
            <FormItemLabel
              helperText={t('message.test-definition-sql-query-help')}
              label={t('label.sql-query')}
            />
          }
          name="sqlExpression">
          {isReadOnlyField ? (
            <Input.TextArea
              disabled
              rows={8}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
              value={initialValues?.sqlExpression}
            />
          ) : (
            <CodeEditor
              refreshEditor
              showCopyButton
              className="custom-query-editor query-editor-h-200"
              mode={{ name: CSMode.SQL }}
            />
          )}
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
            disabled={isReadOnlyField}
            id="entityType"
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
            disabled={isReadOnlyField}
            id="testPlatforms"
            mode="multiple"
            options={Object.values(TestPlatform).map((platform) => ({
              label: platform,
              value: platform,
            }))}
            placeholder={t('label.select-field', {
              field: t('label.test-platform-plural'),
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
          label={
            <FormItemLabel
              helperText={t('message.supported-services-help')}
              label={t('label.supported-service-plural')}
            />
          }
          name="supportedServices">
          <Select
            showSearch
            disabled={isReadOnlyField}
            filterOption={handleSearchFilterOption}
            mode="multiple"
            options={databaseServiceTypes}
            placeholder={t('message.empty-means-all-services')}
          />
        </Form.Item>

        <Form.Item
          label={t('label.supported-data-type-plural')}
          name="supportedDataTypes">
          <Select
            disabled={isReadOnlyField}
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
              helperText={t('message.test-definition-parameters-description')}
              label={t('label.parameter-plural')}
            />
          }>
          <Form.List name="parameterDefinition">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    extra={
                      !isReadOnlyField && (
                        <MinusCircleOutlined onClick={() => remove(name)} />
                      )
                    }
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
                      <Input
                        disabled={isReadOnlyField}
                        placeholder={t('label.parameter-name')}
                      />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      label={t('label.display-name')}
                      name={[name, 'displayName']}>
                      <Input
                        disabled={isReadOnlyField}
                        placeholder={t('label.parameter-display-name')}
                      />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      label={t('label.description')}
                      name={[name, 'description']}>
                      <Input.TextArea
                        disabled={isReadOnlyField}
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
                        showSearch
                        disabled={isReadOnlyField}
                        filterOption={handleSearchFilterOption}
                        options={Object.values(TestDataType).map((type) => ({
                          label: type,
                          value: type,
                        }))}
                        placeholder={t('label.select-field', {
                          field: t('label.data-type'),
                        })}
                      />
                    </Form.Item>

                    <div className="d-flex items-center gap-2">
                      <label>{t('label.required')}</label>
                      <Form.Item
                        noStyle
                        {...restField}
                        name={[name, 'required']}
                        valuePropName="checked">
                        <Switch disabled={isReadOnlyField} />
                      </Form.Item>
                    </div>
                  </Card>
                ))}
                {!isReadOnlyField && (
                  <Button
                    block
                    icon={<PlusOutlined />}
                    style={{ marginTop: 16 }}
                    type="dashed"
                    onClick={() => add()}>
                    {t('label.add-entity', { entity: t('label.parameter') })}
                  </Button>
                )}
              </>
            )}
          </Form.List>
        </Form.Item>
        {isEditMode && (
          <div className="d-flex items-center gap-2" style={{ marginTop: 16 }}>
            <label>{t('label.enabled')}</label>
            <Form.Item noStyle name="enabled" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        )}
      </Form>
    </Drawer>
  );
};

export default TestDefinitionForm;
