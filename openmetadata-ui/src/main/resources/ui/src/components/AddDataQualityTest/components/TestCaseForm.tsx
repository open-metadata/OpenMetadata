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

import { Button, Form, FormProps, Input, Select, Space } from 'antd';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { t } from 'i18next';
import { isEmpty, snakeCase } from 'lodash';
import Qs from 'qs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { PAGE_SIZE_LARGE } from '../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../constants/regex.constants';
import { ProfilerDashboardType } from '../../../enums/table.enum';
import { CreateTestCase } from '../../../generated/api/tests/createTestCase';
import {
  TestCase,
  TestCaseParameterValue,
} from '../../../generated/tests/testCase';
import {
  EntityType,
  TestDataType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../interface/FormUtils.interface';
import { getListTestCase, getListTestDefinitions } from '../../../rest/testAPI';
import {
  getNameFromFQN,
  replaceAllSpacialCharWith_,
} from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { generateFormFields } from '../../../utils/formUtils';
import { getDecodedFqn } from '../../../utils/StringsUtils';
import { generateEntityLink } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { TestCaseFormProps } from '../AddDataQualityTest.interface';
import ParameterForm from './ParameterForm';

const TestCaseForm: React.FC<TestCaseFormProps> = ({
  initialValue,
  onSubmit,
  onCancel,
  table,
}) => {
  const history = useHistory();
  const { entityTypeFQN, dashboardType } =
    useParams<{ entityTypeFQN: string; dashboardType: string }>();
  const { activeColumnFqn } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeColumnFqn: string };
  }, [location.search]);
  const decodedEntityFQN = getDecodedFqn(entityTypeFQN);
  const isColumnFqn = dashboardType === ProfilerDashboardType.COLUMN;
  const [form] = Form.useForm();
  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [selectedTestType, setSelectedTestType] = useState<string | undefined>(
    initialValue?.testDefinition
  );
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  const columnName = Form.useWatch('column', form);

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

  const fetchAllTestDefinitions = async () => {
    try {
      const { data } = await getListTestDefinitions({
        limit: PAGE_SIZE_LARGE,
        entityType: isColumnFqn ? EntityType.Column : EntityType.Table,
        testPlatform: TestPlatform.OpenMetadata,
        supportedDataType: isColumnFqn
          ? table.columns.find(
              (column) => column.fullyQualifiedName === columnName
            )?.dataType
          : undefined,
      });

      setTestDefinitions(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const fetchAllTestCases = async () => {
    try {
      const { data } = await getListTestCase({
        limit: PAGE_SIZE_LARGE,
        entityLink: generateEntityLink(
          isColumnFqn ? `${decodedEntityFQN}.${columnName}` : decodedEntityFQN,
          isColumnFqn
        ),
      });

      setTestCases(data);
    } catch (error) {
      setTestCases([]);
    }
  };

  const getSelectedTestDefinition = () => {
    const testType = isEmpty(initialValue?.testSuite)
      ? selectedTestType
      : initialValue?.testSuite;

    return testDefinitions.find(
      (definition) => definition.fullyQualifiedName === testType
    );
  };
  const isComputeRowCountFieldVisible = useMemo(() => {
    const selectedDefinition = getSelectedTestDefinition();

    return selectedDefinition?.supportsRowLevelPassedFailed ?? false;
  }, [selectedTestType, initialValue, testDefinitions]);

  const GenerateParamsField = useCallback(() => {
    const selectedDefinition = getSelectedTestDefinition();
    if (selectedDefinition?.parameterDefinition) {
      return <ParameterForm definition={selectedDefinition} table={table} />;
    }

    return;
  }, [selectedTestType, initialValue, testDefinitions]);

  const createTestCaseObj = (value: {
    testName: string;
    params: Record<string, string | { [key: string]: string }[]>;
    testTypeId: string;
    computePassedFailedRowCount?: boolean;
    description?: string;
  }): CreateTestCase => {
    const selectedDefinition = getSelectedTestDefinition();
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
    const name =
      value.testName?.trim() ||
      `${replaceAllSpacialCharWith_(
        columnName ? columnName : table.name
      )}_${snakeCase(selectedTestType)}_${cryptoRandomString({
        length: 4,
        type: 'alphanumeric',
      })}`;

    return {
      name,
      displayName: name,
      computePassedFailedRowCount: value.computePassedFailedRowCount,
      entityLink: generateEntityLink(
        isColumnFqn ? `${decodedEntityFQN}.${columnName}` : decodedEntityFQN,
        isColumnFqn
      ),
      parameterValues: parameterValues as TestCaseParameterValue[],
      testDefinition: value.testTypeId,
      description: isEmpty(value.description) ? undefined : value.description,
      testSuite: '',
    };
  };

  const handleFormSubmit: FormProps['onFinish'] = (value) => {
    onSubmit(createTestCaseObj(value));
  };

  const onBack = () => {
    const data = form.getFieldsValue();
    onCancel(createTestCaseObj(data));
  };

  const getParamsValue = () => {
    return initialValue?.parameterValues?.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.name || '']:
          getSelectedTestDefinition()?.parameterDefinition?.[0].dataType ===
          TestDataType.Array
            ? (JSON.parse(curr?.value || '[]') as string[]).map((val) => ({
                value: val,
              }))
            : curr?.value,
      }),
      {}
    );
  };

  const handleValueChange: FormProps['onValuesChange'] = (value) => {
    if (value.testTypeId) {
      setSelectedTestType(value.testTypeId);
    }
  };

  useEffect(() => {
    fetchAllTestDefinitions();
    const selectedColumn = table.columns.find(
      (column) => column.name === columnName
    );
    if (selectedColumn) {
      history.push({
        search: Qs.stringify({
          activeColumnFqn: selectedColumn?.fullyQualifiedName,
        }),
      });
    }
  }, [columnName]);

  useEffect(() => {
    if (isEmpty(testCases)) {
      fetchAllTestCases();
    }
    form.setFieldsValue({
      testName: replaceAllSpacialCharWith_(initialValue?.name ?? ''),
      testTypeId: initialValue?.testDefinition,
      params: initialValue?.parameterValues?.length
        ? getParamsValue()
        : undefined,
      columnName: activeColumnFqn ? getNameFromFQN(activeColumnFqn) : undefined,
    });
  }, []);

  useEffect(() => {
    form.setFieldsValue({
      column: activeColumnFqn ? getNameFromFQN(activeColumnFqn) : undefined,
    });
  }, [activeColumnFqn]);

  return (
    <Form
      data-testid="test-case-form"
      form={form}
      layout="vertical"
      name="tableTestForm"
      preserve={false}
      onFinish={handleFormSubmit}
      onValuesChange={handleValueChange}>
      {isColumnFqn && (
        <Form.Item
          label={t('label.column')}
          name="column"
          rules={[
            {
              required: true,
              message: `${t('label.field-required', {
                field: t('label.column'),
              })}`,
            },
          ]}>
          <Select
            data-testid="column"
            placeholder={t('label.please-select-entity', {
              entity: t('label.column-lowercase'),
            })}>
            {table.columns.map((column) => (
              <Select.Option key={column.name}>{column.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}
      <Form.Item
        label={t('label.name')}
        name="testName"
        rules={[
          {
            pattern: ENTITY_NAME_REGEX,
            message: t('message.entity-name-validation'),
          },
          {
            validator: (_, value) => {
              if (testCases.some((test) => test.name === value)) {
                return Promise.reject(
                  t('message.entity-already-exists', {
                    entity: t('label.name'),
                  })
                );
              }

              return Promise.resolve();
            },
          },
        ]}>
        <Input
          data-testid="test-case-name"
          placeholder={t('message.enter-test-case-name')}
        />
      </Form.Item>
      <Form.Item
        label={t('label.test-type')}
        name="testTypeId"
        rules={[
          {
            required: true,
            message: `${t('label.field-required', {
              field: t('label.test-type'),
            })}`,
          },
        ]}>
        <Select
          showSearch
          data-testid="test-type"
          options={testDefinitions.map((suite) => ({
            label: getEntityName(suite),
            value: suite.fullyQualifiedName,
          }))}
          placeholder={t('label.select-field', { field: t('label.test-type') })}
        />
      </Form.Item>

      {GenerateParamsField()}

      <Form.Item
        label={t('label.description')}
        name="description"
        trigger="onTextChange">
        <RichTextEditor
          height="200px"
          initialValue={initialValue?.description || ''}
          style={{
            margin: 0,
          }}
        />
      </Form.Item>

      {isComputeRowCountFieldVisible ? generateFormFields(formFields) : null}

      <Form.Item noStyle>
        <Space className="w-full justify-end" size={16}>
          <Button data-testid="cancel-btn" onClick={onBack}>
            {t('label.back')}
          </Button>
          <Button data-testid="submit-test" htmlType="submit" type="primary">
            {t('label.submit')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default TestCaseForm;
