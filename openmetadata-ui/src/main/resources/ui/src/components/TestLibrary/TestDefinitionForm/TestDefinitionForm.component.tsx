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
import type { FormInstance } from 'antd';
import { Button, Card, Drawer, Form, Input, Select, Space, Switch } from 'antd';
import type { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import {
  lazy,
  useCallback,
  useMemo,
  useState,
  type FC,
  type FocusEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close.svg';
import {
  OPEN_METADATA,
  TEST_DEFINITION_FORM,
} from '../../../constants/service-guide.constant';
import { CSMode } from '../../../enums/codemirror.enum';
import type { CreateTestDefinition } from '../../../generated/api/tests/createTestDefinition';
import { DatabaseServiceType } from '../../../generated/entity/services/databaseService';
import type { TestDefinition } from '../../../generated/tests/testDefinition';
import {
  DataQualityDimensions,
  DataType,
  EntityType,
  TestDataType,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  createTestDefinition,
  patchTestDefinition,
} from '../../../rest/testAPI';
import { handleSearchFilterOption } from '../../../utils/FilterQueryUtils';
import { createScrollToErrorHandler } from '../../../utils/formPureUtils';
import { isExternalTestDefinition } from '../../../utils/TestDefinitionUtils';
import { showSuccessToast } from '../../../utils/ToastUtils';
import AlertBar from '../../AlertBar/AlertBar';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import FormItemLabel from '../../common/Form/FormItemLabel';

const CodeEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/CodeEditor'))
);

const ServiceDocPanel = withSuspenseFallback(
  lazy(() => import('../../common/ServiceDocPanel/ServiceDocPanel'))
);

interface TestDefinitionFormProps {
  initialValues?: TestDefinition;
  onSuccess: (data?: TestDefinition) => void;
  onCancel: () => void;
}

const TestDefinitionForm: FC<TestDefinitionFormProps> = ({
  initialValues,
  onSuccess,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeField, setActiveField] = useState('');
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

  const handleActiveField = useCallback((id?: string) => {
    if (!id) {
      return;
    }

    const fieldId = id.startsWith('root/') ? id : `root/${id}`;
    setActiveField((previousField) =>
      previousField === fieldId ? previousField : fieldId
    );
  }, []);

  const handleFieldFocus = useCallback(
    (event: FocusEvent<HTMLFormElement>) => {
      handleActiveField(event.target.id);
    },
    [handleActiveField]
  );

  return (
    <Drawer
      destroyOnClose
      open
      bodyStyle={{ paddingBottom: 0, paddingTop: 0 }}
      className="custom-drawer-style test-case-form-drawer"
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
      width="80%"
      onClose={onCancel}>
      <div className="tw:grid tw:h-full tw:grid-cols-3 tw:gap-6">
        <div className="drawer-form-content tw:col-span-2 tw:h-full tw:overflow-y-auto tw:py-6 tw:pr-2">
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
            onFinishFailed={scrollToError}
            onFocus={handleFieldFocus}>
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

            <Form.Item label={t('label.description')} name="description">
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
                  className="font-monospace text-xs"
                  rows={8}
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
                options={Object.values(DataQualityDimensions).map(
                  (dimension) => ({
                    label: dimension,
                    value: dimension,
                  })
                )}
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
              dependencies={['testPlatforms']}
              label={t('label.supported-data-type-plural')}
              name="supportedDataTypes"
              rules={[
                ({ getFieldValue }: Pick<FormInstance, 'getFieldValue'>) => ({
                  required: (getFieldValue('testPlatforms') ?? []).includes(
                    TestPlatform.OpenMetadata
                  ),
                  message: t('message.field-text-is-required', {
                    fieldText: t('label.supported-data-type-plural'),
                  }),
                }),
              ]}>
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

            <div onClick={() => handleActiveField('root/parameterDefinition')}>
              <Form.Item
                label={
                  <FormItemLabel
                    helperText={t(
                      'message.test-definition-parameters-description'
                    )}
                    label={t('label.parameter-plural')}
                  />
                }>
                <Form.List name="parameterDefinition">
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map(({ key, name, ...restField }) => (
                        <Card
                          className="m-t-md"
                          extra={
                            !isReadOnlyField && (
                              <MinusCircleOutlined
                                onClick={() => remove(name)}
                              />
                            )
                          }
                          key={key}
                          size="small"
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
                            name={[name, 'dataType']}>
                            <Select
                              showSearch
                              disabled={isReadOnlyField}
                              filterOption={handleSearchFilterOption}
                              options={Object.values(TestDataType).map(
                                (type) => ({
                                  label: type,
                                  value: type,
                                })
                              )}
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
                          className="m-t-md"
                          icon={<PlusOutlined />}
                          type="dashed"
                          onClick={() => add()}>
                          {t('label.add-entity', {
                            entity: t('label.parameter'),
                          })}
                        </Button>
                      )}
                    </>
                  )}
                </Form.List>
              </Form.Item>
            </div>
            {isEditMode && (
              <div className="d-flex items-center gap-2 m-t-md">
                <label>{t('label.enabled')}</label>
                <Form.Item noStyle name="enabled" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </div>
            )}
          </Form>
        </div>
        <div className="drawer-doc-panel service-doc-panel markdown-parser tw:my-6 tw:mr-6 tw:overflow-y-auto tw:rounded-xl tw:border tw:border-solid tw:border-gray-200 tw:px-5">
          <ServiceDocPanel
            activeField={activeField}
            serviceName={TEST_DEFINITION_FORM}
            serviceType={OPEN_METADATA}
          />
        </div>
      </div>
    </Drawer>
  );
};

export default TestDefinitionForm;
