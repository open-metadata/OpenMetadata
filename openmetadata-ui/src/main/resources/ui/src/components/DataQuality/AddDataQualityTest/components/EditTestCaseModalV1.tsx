/*
 *  Copyright 2025 Collate.
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
  Card,
  Drawer,
  Form,
  FormProps,
  Input,
  Select,
  Space,
} from 'antd';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isArray, isEmpty, isEqual, pick } from 'lodash';
import {
  FC,
  FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../../assets/svg/close.svg';
import { ENTITY_NAME_REGEX } from '../../../../constants/regex.constants';
import { TEST_CASE_FORM } from '../../../../constants/service-guide.constant';
import { OPEN_METADATA } from '../../../../constants/Services.constant';
import { EntityType, TabSpecificField } from '../../../../enums/entity.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { Table } from '../../../../generated/entity/data/table';
import {
  TestDataType,
  TestDefinition,
} from '../../../../generated/tests/testDefinition';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import { getTableDetailsByFQN } from '../../../../rest/tableAPI';
import {
  getTestDefinitionById,
  updateTestCaseById,
} from '../../../../rest/testAPI';
import { getNameFromFQN } from '../../../../utils/CommonUtils';
import {
  getColumnNameFromEntityLink,
  getEntityName,
} from '../../../../utils/EntityUtils';
import { getEntityFQN } from '../../../../utils/FeedUtils';
import {
  createScrollToErrorHandler,
  generateFormFields,
  getPopupContainer,
} from '../../../../utils/formUtils';
import { isValidJSONString } from '../../../../utils/StringsUtils';
import { getFilterTags } from '../../../../utils/TableTags/TableTags.utils';
import { getTagsWithoutTier, getTierTags } from '../../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import AlertBar from '../../../AlertBar/AlertBar';
import { EntityAttachmentProvider } from '../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import Loader from '../../../common/Loader/Loader';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import { EditTestCaseModalProps } from './EditTestCaseModal.interface';
import ParameterForm from './ParameterForm';

// =============================================
// MAIN COMPONENT
// =============================================
const EditTestCaseModalV1: FC<EditTestCaseModalProps> = ({
  open,
  testCase,
  showOnlyParameter = false,
  drawerProps,
  onCancel,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // =============================================
  // STATE
  // =============================================
  const [selectedDefinition, setSelectedDefinition] =
    useState<TestDefinition>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOnSave, setIsLoadingOnSave] = useState(false);
  const [table, setTable] = useState<Table & { entityType: EntityType }>();
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeField, setActiveField] = useState<string>('');

  // =============================================
  // COMPUTED VALUES
  // =============================================
  const tableFqn = useMemo(
    () => getEntityFQN(testCase?.entityLink ?? ''),
    [testCase]
  );

  const isColumn = useMemo(
    () => testCase?.entityLink.includes('::columns::'),
    [testCase]
  );

  const isComputeRowCountFieldVisible = useMemo(() => {
    return selectedDefinition?.supportsRowLevelPassedFailed ?? false;
  }, [selectedDefinition]);

  const scrollToError = useMemo(() => createScrollToErrorHandler(), []);

  const { tags, glossaryTerms, tierTag } = useMemo(() => {
    if (!testCase?.tags) {
      return { tags: [], glossaryTerms: [], tierTag: null };
    }

    // First extract tier tag
    const tierTag = getTierTags(testCase.tags);
    // Filter out tier tags before processing
    const tagsWithoutTier = getTagsWithoutTier(testCase.tags);
    const filteredTags = getFilterTags(tagsWithoutTier);

    return {
      tags: filteredTags.Classification,
      glossaryTerms: filteredTags.Glossary,
      tierTag,
    };
  }, [testCase?.tags]);

  const handleActiveField = useCallback(
    (id: string) => {
      // Only update if id matches pattern root/{any string}
      if (/^root\/.+/.test(id)) {
        setActiveField((pre) => {
          if (pre !== id) {
            return id;
          }

          return pre;
        });
      }
    },
    [setActiveField]
  );

  const paramsField = useMemo(() => {
    if (selectedDefinition?.parameterDefinition) {
      return (
        <div
          onClick={() => handleActiveField(`root/${selectedDefinition.name}`)}>
          <ParameterForm definition={selectedDefinition} table={table} />
        </div>
      );
    }

    return <></>;
  }, [selectedDefinition, table, handleActiveField]);

  const dimensionColumnOptions = useMemo(() => {
    const selectedColumn = getColumnNameFromEntityLink(testCase?.entityLink);

    return table?.columns?.reduce((acc, col) => {
      if (col.name === selectedColumn) {
        return acc;
      }

      acc.push({
        label: getEntityName(col),
        value: col.name,
      });

      return acc;
    }, [] as { label: string; value: string }[]);
  }, [table?.columns]);

  // =============================================
  // FORM FIELDS
  // =============================================
  const computeRowCountField: FieldProp[] = useMemo(
    () => [
      {
        name: 'computePassedFailedRowCount',
        label: t('label.compute-row-count'),
        type: FieldTypes.SWITCH,
        helperText: t('message.compute-row-count-helper-text'),
        required: false,
        props: {
          'data-testid': 'compute-passed-failed-row-count',
          id: 'root/computePassedFailedRowCount',
        },
        id: 'computePassedFailedRowCount',
        formItemLayout: FormItemLayout.HORIZONTAL,
        newLook: true,
      },
    ],
    [t]
  );

  const formFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'description',
        required: false,
        label: t('label.description'),
        id: 'root/description',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'description',
          initialValue: testCase?.description ?? '',
          style: {
            margin: 0,
          },
        },
      },
      {
        name: 'tags',
        required: false,
        label: t('label.tag-plural'),
        id: 'tags',
        type: FieldTypes.TAG_SUGGESTION,
        props: {
          selectProps: {
            'data-testid': 'tags-selector',
            getPopupContainer,
            id: 'root/tags',
          },
          newLook: true,
          initialValue: tags,
        },
      },
      {
        name: 'glossaryTerms',
        required: false,
        label: t('label.glossary-term-plural'),
        id: 'glossaryTerms',
        type: FieldTypes.TAG_SUGGESTION,
        props: {
          selectProps: {
            'data-testid': 'glossary-terms-selector',
            getPopupContainer,
            id: 'root/glossaryTerms',
          },
          newLook: true,
          initialValue: glossaryTerms,
          open: false,
          hasNoActionButtons: true,
          isTreeSelect: true,
          tagType: TagSource.Glossary,
          placeholder: t('label.select-field', {
            field: t('label.glossary-term-plural'),
          }),
        },
      },
    ],
    [testCase?.description, tags, glossaryTerms, t]
  );

  // =============================================
  // HANDLERS
  // =============================================

  const handleFieldFocus = useCallback(
    (event: FocusEvent<HTMLFormElement>) => {
      if (event.target.id) {
        handleActiveField(event.target.id);
      }
    },
    [handleActiveField]
  );

  const handleFormSubmit: FormProps['onFinish'] = async (value) => {
    setErrorMessage('');
    const updatedTestCase = {
      ...testCase,
      ...testCaseClassBase.getCreateTestCaseObject(value, selectedDefinition),
      description: showOnlyParameter
        ? testCase.description
        : isEmpty(value.description)
        ? undefined
        : value.description,
      displayName: showOnlyParameter
        ? testCase?.displayName
        : value.displayName,
      computePassedFailedRowCount: isComputeRowCountFieldVisible
        ? value.computePassedFailedRowCount
        : testCase?.computePassedFailedRowCount,
      tags: showOnlyParameter
        ? testCase.tags
        : [
            ...(tierTag ? [tierTag] : []),
            ...(value.tags ?? []),
            ...(value.glossaryTerms ?? []),
          ],
      dimensionColumns: value.dimensionColumns || undefined,
    };

    const jsonPatch = compare(testCase, updatedTestCase);

    if (jsonPatch.length) {
      try {
        setIsLoadingOnSave(true);
        const updateRes = await updateTestCaseById(
          testCase.id ?? '',
          jsonPatch
        );
        onUpdate?.(updateRes);
        showSuccessToast(
          t('server.update-entity-success', { entity: t('label.test-case') })
        );
        onCancel();
        form.resetFields();
      } catch (error) {
        const errorMsg =
          (error as AxiosError<{ message: string }>)?.response?.data?.message ||
          t('server.update-entity-error', {
            entity: t('label.test-case'),
          });
        setErrorMessage(errorMsg);
      } finally {
        setIsLoadingOnSave(false);
      }
    }
  };

  const getParamsValue = (selectedDefinition: TestDefinition) => {
    return testCase?.parameterValues?.reduce((acc, curr) => {
      const param = selectedDefinition?.parameterDefinition?.find(
        (definition) => definition.name === curr.name
      );

      if (
        param?.dataType === TestDataType.Array &&
        isValidJSONString(curr.value)
      ) {
        const value = JSON.parse(curr.value || '[]');

        return {
          ...acc,
          [curr.name || '']: isArray(value)
            ? value.map((val) => ({
                value: val,
              }))
            : value,
        };
      }

      if (param?.dataType === TestDataType.Boolean) {
        return {
          ...acc,
          [curr.name || '']: curr.value === 'true',
        };
      }

      return {
        ...acc,
        [curr.name || '']: curr.value,
      };
    }, {});
  };

  const fetchTableDetails = async (tableFqn: string) => {
    if (!tableFqn) {
      return;
    }
    try {
      const response = await getTableDetailsByFQN(tableFqn, {
        fields: [
          TabSpecificField.TAGS,
          TabSpecificField.OWNERS,
          TabSpecificField.DOMAINS,
          TabSpecificField.TESTSUITE,
          TabSpecificField.COLUMNS,
        ],
      });
      setTable({ ...response, entityType: EntityType.TABLE });
    } catch (error) {
      // Handle error silently
    }
  };

  const fetchTestDefinitionById = async () => {
    try {
      setIsLoading(true);

      const definition = await getTestDefinitionById(
        testCase.testDefinition.id || ''
      );

      await fetchTableDetails(tableFqn);

      const formValue = pick(testCase, [
        'name',
        'displayName',
        'description',
        'computePassedFailedRowCount',
        'useDynamicAssertion',
        'dimensionColumns',
      ]);

      form.setFieldsValue({
        testDefinition: getEntityName(testCase?.testDefinition),
        params: getParamsValue(definition),
        table: getNameFromFQN(tableFqn),
        column: getColumnNameFromEntityLink(testCase?.entityLink),
        tags: tags,
        glossaryTerms: glossaryTerms,
        ...formValue,
      });
      setSelectedDefinition(definition);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  // =============================================
  // EFFECTS
  // =============================================
  useEffect(() => {
    if (testCase && open) {
      fetchTestDefinitionById();
    }
  }, [testCase, open]);

  // =============================================
  // RENDER
  // =============================================
  const renderActionButtons = useMemo(
    () => (
      <Space size={16}>
        <Button
          data-testid="cancel-btn"
          disabled={isLoadingOnSave}
          type="link"
          onClick={() => {
            form.resetFields();
            onCancel();
          }}>
          {t('label.cancel')}
        </Button>
        <Button
          data-testid="update-btn"
          htmlType="submit"
          loading={isLoadingOnSave}
          type="primary"
          onClick={() => form.submit()}>
          {t('label.update')}
        </Button>
      </Space>
    ),
    [isLoadingOnSave]
  );

  const formContent = (
    <EntityAttachmentProvider
      entityFqn={testCase?.fullyQualifiedName}
      entityType={EntityType.TEST_CASE}>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="test-case-form-v1 drawer-mode">
          {/* Floating Error Alert - always visible at top */}
          {errorMessage && (
            <div className="floating-error-alert">
              <AlertBar
                defaultExpand
                className="h-full custom-alert-description"
                message={errorMessage}
                type="error"
              />
            </div>
          )}

          <Form
            className="new-form-style"
            data-testid="edit-test-form"
            form={form}
            layout="vertical"
            name="tableTestForm"
            onFinish={handleFormSubmit}
            onFinishFailed={scrollToError}
            onFocus={handleFieldFocus}>
            {!showOnlyParameter && (
              <Card className="form-card-section">
                <Form.Item required label={t('label.table')} name="table">
                  <Input disabled id="root/selected-entity" />
                </Form.Item>
                {isColumn && (
                  <Form.Item required label={t('label.column')} name="column">
                    <Input disabled id="root/column" />
                  </Form.Item>
                )}
                {isColumn && (
                  <Form.Item
                    label={t('label.dimension-plural')}
                    name="dimensionColumns">
                    <Select
                      getPopupContainer={getPopupContainer}
                      id="root/dimensionColumns"
                      mode="multiple"
                      options={dimensionColumnOptions}
                    />
                  </Form.Item>
                )}
              </Card>
            )}
            <Card className="form-card-section test-type-card">
              <Form.Item
                required
                label={t('label.test-entity', {
                  entity: t('label.type'),
                })}
                name="testDefinition">
                <Input
                  disabled
                  id={`root/${selectedDefinition?.name}`}
                  placeholder={t('message.enter-test-case-name')}
                />
              </Form.Item>

              {generateFormFields(
                testCaseClassBase.createFormAdditionalFields(
                  selectedDefinition?.supportsDynamicAssertion ?? false
                )
              )}

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => {
                  return !isEqual(
                    prevValues['useDynamicAssertion'],
                    currentValues['useDynamicAssertion']
                  );
                }}>
                {({ getFieldValue }) =>
                  getFieldValue('useDynamicAssertion') ? null : paramsField
                }
              </Form.Item>

              {isComputeRowCountFieldVisible &&
                generateFormFields(computeRowCountField)}
            </Card>
            {!showOnlyParameter && (
              <Card className="form-card-section">
                <Form.Item
                  required
                  label={t('label.name')}
                  name="name"
                  rules={[
                    {
                      pattern: ENTITY_NAME_REGEX,
                      message: t('message.entity-name-validation'),
                    },
                  ]}>
                  <Input
                    disabled
                    id="root/name"
                    placeholder={t('message.enter-test-case-name')}
                  />
                </Form.Item>

                <Form.Item label={t('label.display-name')} name="displayName">
                  <Input
                    id="root/displayName"
                    placeholder={t('message.enter-test-case-name')}
                  />
                </Form.Item>

                {generateFormFields(formFields)}
              </Card>
            )}
          </Form>
        </div>
      )}
    </EntityAttachmentProvider>
  );

  const drawerFooter = (
    <div className="drawer-footer-actions">{renderActionButtons}</div>
  );

  return (
    <Drawer
      destroyOnClose
      className="custom-drawer-style test-case-form-drawer"
      closable={false}
      footer={drawerFooter}
      open={open}
      placement="right"
      title={
        <label data-testid="edit-test-case-drawer-title">
          {t('label.edit-entity', {
            entity: getEntityName(testCase),
          })}
        </label>
      }
      width="75%"
      {...drawerProps}
      extra={
        <Button
          className="drawer-close-icon flex-center"
          icon={<CloseIcon />}
          type="link"
          onClick={onCancel}
        />
      }
      onClose={() => {
        form.resetFields();
        onCancel();
      }}>
      <div className="drawer-content-wrapper">
        <div className="drawer-form-content">{formContent}</div>
        <div className="drawer-doc-panel service-doc-panel markdown-parser">
          <ServiceDocPanel
            activeField={activeField}
            selectedEntity={table}
            serviceName={TEST_CASE_FORM}
            serviceType={OPEN_METADATA as ServiceCategory}
          />
        </div>
      </div>
    </Drawer>
  );
};

export default EditTestCaseModalV1;
