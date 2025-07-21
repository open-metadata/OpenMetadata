/*
 *  Copyright 2022 Collate.
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

import { Form, FormProps, Input } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isArray, isEmpty, isEqual, pick } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { TABLE_DIFF } from '../../../constants/TestSuite.constant';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { TagSource } from '../../../generated/api/domains/createDataProduct';
import { Table } from '../../../generated/entity/data/table';
import {
  TestDataType,
  TestDefinition,
} from '../../../generated/tests/testDefinition';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import testCaseClassBase from '../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import {
  getTestCaseByFqn,
  getTestDefinitionById,
  updateTestCaseById,
} from '../../../rest/testAPI';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import {
  getColumnNameFromEntityLink,
  getEntityName,
} from '../../../utils/EntityUtils';
import { getEntityFQN } from '../../../utils/FeedUtils';
import { generateFormFields } from '../../../utils/formUtils';
import { isValidJSONString } from '../../../utils/StringsUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import { getTagsWithoutTier, getTierTags } from '../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import Loader from '../../common/Loader/Loader';
import { EditTestCaseModalProps } from './AddDataQualityTest.interface';
import ParameterForm from './components/ParameterForm';

const EditTestCaseModal: React.FC<EditTestCaseModalProps> = ({
  visible,
  testCase,
  showOnlyParameter,
  onCancel,
  onUpdate,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const tableFqn = useMemo(
    () => getEntityFQN(testCase?.entityLink ?? ''),
    [testCase]
  );
  const [selectedDefinition, setSelectedDefinition] =
    useState<TestDefinition>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOnSave, setIsLoadingOnSave] = useState(false);
  const [table, setTable] = useState<Table>();

  const isColumn = useMemo(
    () => testCase?.entityLink.includes('::columns::'),
    [testCase]
  );

  const isComputeRowCountFieldVisible = useMemo(() => {
    return selectedDefinition?.supportsRowLevelPassedFailed ?? false;
  }, [selectedDefinition]);

  const formFields: FieldProp[] = [
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
  ];

  const paramsField = useMemo(() => {
    if (selectedDefinition?.parameterDefinition) {
      return <ParameterForm definition={selectedDefinition} table={table} />;
    }

    return <></>;
  }, [selectedDefinition, table]);

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

  const fetchTableDetails = async (fqn: string) => {
    try {
      const data = await getTableDetailsByFQN(fqn);
      setTable(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchTestDefinitionById = async () => {
    setIsLoading(true);
    try {
      const testCaseDetails = await getTestCaseByFqn(
        testCase?.fullyQualifiedName ?? '',
        { fields: [TabSpecificField.TEST_DEFINITION] }
      );
      const definition = await getTestDefinitionById(
        testCaseDetails.testDefinition.id || ''
      );
      if (testCaseDetails.testDefinition?.fullyQualifiedName === TABLE_DIFF) {
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
        testDefinition: getEntityName(testCaseDetails?.testDefinition),
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

  const formField: FieldProp[] = useMemo(
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
    [testCase?.description, tags, glossaryTerms]
  );

  useEffect(() => {
    if (testCase) {
      fetchTestDefinitionById();

      const isContainsColumnName = testCase.parameterValues?.find(
        (value) => value.name === 'columnName' || value.name === 'column'
      );

      if (isContainsColumnName) {
        fetchTableDetails(tableFqn);
      }
    }
  }, [testCase]);

  return (
    <Modal
      centered
      destroyOnClose
      afterClose={() => {
        form.resetFields();
        onCancel();
      }}
      cancelText={t('label.cancel')}
      closable={false}
      confirmLoading={isLoadingOnSave}
      maskClosable={false}
      okText={t('label.save')}
      open={visible}
      title={`${t('label.edit')} ${testCase?.name}`}
      width={720}
      onCancel={onCancel}
      onOk={() => form.submit()}>
      <EntityAttachmentProvider
        entityFqn={testCase?.fullyQualifiedName}
        entityType={EntityType.TEST_CASE}>
        {isLoading ? (
          <Loader />
        ) : (
          <Form
            data-testid="edit-test-form"
            form={form}
            layout="vertical"
            name="tableTestForm"
            onFinish={handleFormSubmit}>
            {!showOnlyParameter && (
              <>
                <Form.Item required label={t('label.table')} name="table">
                  <Input disabled />
                </Form.Item>
                {isColumn && (
                  <Form.Item required label={t('label.column')} name="column">
                    <Input disabled />
                  </Form.Item>
                )}
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
              </>
            )}

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

            {!showOnlyParameter && <>{generateFormFields(formField)}</>}
            {isComputeRowCountFieldVisible
              ? generateFormFields(formFields)
              : null}
          </Form>
        )}
      </EntityAttachmentProvider>
    </Modal>
  );
};

export default EditTestCaseModal;
