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

import { Button, Card, Drawer, Form, FormProps, Input, Space } from 'antd';
import { DrawerProps } from 'antd/lib/drawer';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isArray, isEmpty, isEqual, pick } from 'lodash';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../../constants/regex.constants';
import { TABLE_DIFF } from '../../../../constants/TestSuite.constant';
import { EntityType } from '../../../../enums/entity.enum';
import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { Table } from '../../../../generated/entity/data/table';
import { TestCase } from '../../../../generated/tests/testCase';
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
import { generateFormFields } from '../../../../utils/formUtils';
import { isValidJSONString } from '../../../../utils/StringsUtils';
import { getFilterTags } from '../../../../utils/TableTags/TableTags.utils';
import { getTagsWithoutTier, getTierTags } from '../../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { EntityAttachmentProvider } from '../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import Loader from '../../../common/Loader/Loader';
import ParameterForm from './ParameterForm';

// =============================================
// INTERFACES
// =============================================
export interface EditTestCaseModalV1Props {
  open: boolean;
  testCase: TestCase;
  showOnlyParameter?: boolean;
  drawerProps?: DrawerProps;
  onCancel: () => void;
  onUpdate?: (testCase: TestCase) => void;
}

// =============================================
// MAIN COMPONENT
// =============================================
const EditTestCaseModalV1: FC<EditTestCaseModalV1Props> = ({
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
  const [table, setTable] = useState<Table>();

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

  const paramsField = useMemo(() => {
    if (selectedDefinition?.parameterDefinition) {
      return <ParameterForm definition={selectedDefinition} table={table} />;
    }

    return <></>;
  }, [selectedDefinition, table]);

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
        },
        id: 'root/computePassedFailedRowCount',
        formItemLayout: FormItemLayout.HORIZONTAL,
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
        id: 'root/tags',
        type: FieldTypes.TAG_SUGGESTION,
        props: {
          selectProps: {
            'data-testid': 'tags-selector',
          },
          initialValue: tags,
        },
      },
      {
        name: 'glossaryTerms',
        required: false,
        label: t('label.glossary-term-plural'),
        id: 'root/glossaryTerms',
        type: FieldTypes.TAG_SUGGESTION,
        props: {
          selectProps: {
            'data-testid': 'glossary-terms-selector',
          },
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
  const handleFormSubmit: FormProps['onFinish'] = async (value) => {
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
        showErrorToast(error as AxiosError);
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
        fields: 'columns',
      });
      setTable(response);
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

      if (testCase.testDefinition?.fullyQualifiedName === TABLE_DIFF) {
        await fetchTableDetails(tableFqn);
      }

      const formValue = pick(testCase, [
        'name',
        'displayName',
        'description',
        'computePassedFailedRowCount',
        'useDynamicAssertion',
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

      const isContainsColumnName = testCase.parameterValues?.find(
        (value) => value.name === 'columnName' || value.name === 'column'
      );

      if (isContainsColumnName) {
        fetchTableDetails(tableFqn);
      }
    }
  }, [testCase, open]);

  // =============================================
  // RENDER
  // =============================================
  const renderActionButtons = () => (
    <Space size={16}>
      <Button
        data-testid="cancel-btn"
        disabled={isLoadingOnSave}
        size="large"
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
        size="large"
        type="primary"
        onClick={() => form.submit()}>
        {t('label.update')}
      </Button>
    </Space>
  );

  const formContent = (
    <EntityAttachmentProvider
      entityFqn={testCase?.fullyQualifiedName}
      entityType={EntityType.TEST_CASE}>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="test-case-form-v1 drawer-mode">
          <Form
            data-testid="edit-test-form"
            form={form}
            layout="vertical"
            name="tableTestForm"
            onFinish={handleFormSubmit}>
            {!showOnlyParameter && (
              <Card className="select-table-card">
                <Form.Item required label={t('label.table')} name="table">
                  <Input disabled />
                </Form.Item>
                {isColumn && (
                  <Form.Item required label={t('label.column')} name="column">
                    <Input disabled />
                  </Form.Item>
                )}
              </Card>
            )}

            {!showOnlyParameter && (
              <Card className="test-type-card">
                <Form.Item
                  required
                  label={t('label.test-entity', {
                    entity: t('label.type'),
                  })}
                  name="testDefinition">
                  <Input
                    disabled
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
              </Card>
            )}

            {!showOnlyParameter && (
              <Card className="test-details-card">
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
                    placeholder={t('message.enter-test-case-name')}
                  />
                </Form.Item>

                <Form.Item label={t('label.display-name')} name="displayName">
                  <Input placeholder={t('message.enter-test-case-name')} />
                </Form.Item>

                {generateFormFields(formFields)}

                {isComputeRowCountFieldVisible &&
                  generateFormFields(computeRowCountField)}
              </Card>
            )}

            {/* Show params and dynamic assertion fields outside cards when showOnlyParameter is true */}
            {showOnlyParameter && (
              <>
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
              </>
            )}
          </Form>
        </div>
      )}
    </EntityAttachmentProvider>
  );

  const drawerFooter = (
    <div className="drawer-footer-actions">{renderActionButtons()}</div>
  );

  return (
    <Drawer
      destroyOnClose
      className="custom-gradient-drawer"
      closable={false}
      footer={drawerFooter}
      maskClosable={false}
      open={open}
      placement="right"
      size="large"
      title={`${t('label.edit')} ${testCase?.name}`}
      {...drawerProps}
      onClose={() => {
        form.resetFields();
        onCancel();
      }}>
      <div className="drawer-form-content">{formContent}</div>
    </Drawer>
  );
};

export default EditTestCaseModalV1;
