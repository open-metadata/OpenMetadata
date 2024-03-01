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
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { Table } from '../../../generated/entity/data/table';
import { TestCaseParameterValue } from '../../../generated/tests/testCase';
import {
  TestDataType,
  TestDefinition,
} from '../../../generated/tests/testDefinition';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import {
  getTestDefinitionById,
  updateTestCaseById,
} from '../../../rest/testAPI';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import { getColumnNameFromEntityLink } from '../../../utils/EntityUtils';
import { getEntityFQN } from '../../../utils/FeedUtils';
import { generateFormFields } from '../../../utils/formUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
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

  const createTestCaseObj = (value: {
    testName: string;
    params: Record<string, string | { [key: string]: string }[]>;
    testTypeId: string;
  }) => {
    const paramsValue = selectedDefinition?.parameterDefinition?.[0];

    const parameterValues = Object.entries(value.params || {}).map(
      ([key, value]) => ({
        name: key,
        value:
          paramsValue?.dataType === TestDataType.Array
            ? // need to send array as string formate
              JSON.stringify(
                (value as { value: string }[]).map((data) => data.value)
              )
            : value,
      })
    );

    return parameterValues as TestCaseParameterValue[];
  };

  const handleFormSubmit: FormProps['onFinish'] = async (value) => {
    const parameterValues = createTestCaseObj(value);
    const updatedTestCase = {
      ...testCase,
      parameterValues,
      description: showOnlyParameter
        ? testCase.description
        : isEmpty(value.description)
        ? undefined
        : value.description,
      displayName: value.displayName,
      computePassedFailedRowCount: value.computePassedFailedRowCount,
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
    return testCase?.parameterValues?.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.name || '']:
          selectedDefinition?.parameterDefinition?.[0]?.dataType ===
          TestDataType.Array
            ? (JSON.parse(curr.value || '[]') as string[]).map((val) => ({
                value: val,
              }))
            : curr.value,
      }),
      {}
    );
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
      const definition = await getTestDefinitionById(
        testCase.testDefinition.id || ''
      );
      form.setFieldsValue({
        name: testCase?.name,
        testDefinition: testCase?.testDefinition?.name,
        displayName: testCase?.displayName,
        params: getParamsValue(definition),
        table: getNameFromFQN(tableFqn),
        column: getColumnNameFromEntityLink(testCase?.entityLink),
        computePassedFailedRowCount: testCase?.computePassedFailedRowCount,
      });
      setSelectedDefinition(definition);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (testCase) {
      fetchTestDefinitionById();

      const isContainsColumnName = testCase.parameterValues?.find(
        (value) => value.name === 'columnName'
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
      okText={t('label.submit')}
      open={visible}
      title={`${t('label.edit')} ${testCase?.name}`}
      width={600}
      onCancel={onCancel}
      onOk={() => form.submit()}>
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

          {paramsField}

          {!showOnlyParameter && (
            <>
              <Form.Item label={t('label.description')} name="description">
                <RichTextEditor
                  height="200px"
                  initialValue={testCase?.description || ''}
                  style={{
                    margin: 0,
                  }}
                />
              </Form.Item>
              {isComputeRowCountFieldVisible
                ? generateFormFields(formFields)
                : null}
            </>
          )}
        </Form>
      )}
    </Modal>
  );
};

export default EditTestCaseModal;
