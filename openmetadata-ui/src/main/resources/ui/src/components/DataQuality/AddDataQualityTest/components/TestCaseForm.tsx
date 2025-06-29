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

import {
  Button,
  Form,
  FormProps,
  Input,
  Select,
  Space,
  Typography,
} from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';

import { isEmpty, isEqual, snakeCase } from 'lodash';
import Qs from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../../constants/regex.constants';
import { ProfilerDashboardType } from '../../../../enums/table.enum';
import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { CreateTestCase } from '../../../../generated/api/tests/createTestCase';
import { TestCase } from '../../../../generated/tests/testCase';
import {
  EntityType,
  TestDataType,
  TestDefinition,
  TestPlatform,
} from '../../../../generated/tests/testDefinition';
import { useFqn } from '../../../../hooks/useFqn';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import {
  getListTestCaseBySearch,
  getListTestDefinitions,
} from '../../../../rest/testAPI';
import {
  filterSelectOptions,
  getNameFromFQN,
  replaceAllSpacialCharWith_,
} from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { generateFormFields } from '../../../../utils/formUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import {
  TestCaseFormProps,
  TestCaseFormType,
} from '../AddDataQualityTest.interface';
import ParameterForm from './ParameterForm';

const TestCaseForm: React.FC<TestCaseFormProps> = ({
  initialValue,
  onSubmit,
  onCancel,
  table,
}) => {
  const navigate = useNavigate();
  const { dashboardType } = useRequiredParams<{ dashboardType: string }>();
  const { t } = useTranslation();
  const { fqn: decodedEntityFQN } = useFqn();
  const { activeColumnFqn } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeColumnFqn: string };
  }, [location.search]);

  const isColumnFqn = dashboardType === ProfilerDashboardType.COLUMN;
  const [form] = Form.useForm();
  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [testDefinition, setTestDefinition] = useState<TestDefinition>();
  const [selectedTestType, setSelectedTestType] = useState<string | undefined>(
    initialValue?.testDefinition
  );
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [currentColumnType, setCurrentColumnType] = useState<string>();
  const [loading, setLoading] = useState(false);

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

  const fetchAllTestDefinitions = async (columnType?: string) => {
    try {
      const { data } = await getListTestDefinitions({
        limit: PAGE_SIZE_LARGE,
        entityType: isColumnFqn ? EntityType.Column : EntityType.Table,
        testPlatform: TestPlatform.OpenMetadata,
        supportedDataType: columnType,
      });

      setTestDefinitions(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };
  const fetchAllTestCases = async () => {
    try {
      const { data } = await getListTestCaseBySearch({
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

  const getSelectedTestDefinition = useCallback(() => {
    const testType = isEmpty(initialValue?.testDefinition)
      ? selectedTestType
      : initialValue?.testDefinition;

    return testDefinitions.find(
      (definition) => definition.fullyQualifiedName === testType
    );
  }, [initialValue?.testDefinition, selectedTestType, testDefinitions]);
  const isComputeRowCountFieldVisible = useMemo(() => {
    const selectedDefinition = getSelectedTestDefinition();

    return selectedDefinition?.supportsRowLevelPassedFailed ?? false;
  }, [getSelectedTestDefinition]);

  const generateParamsField = useMemo(() => {
    const selectedDefinition = getSelectedTestDefinition();
    if (selectedDefinition?.parameterDefinition) {
      return <ParameterForm definition={selectedDefinition} table={table} />;
    }

    return null;
  }, [table, getSelectedTestDefinition]);

  const createTestCaseObj = (value: TestCaseFormType): CreateTestCase => {
    const selectedDefinition = getSelectedTestDefinition();

    const name =
      value.testName?.trim() ||
      `${replaceAllSpacialCharWith_(columnName ?? table.name)}_${snakeCase(
        selectedTestType
      )}_${cryptoRandomString({
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
      testDefinition: value.testTypeId,
      description: isEmpty(value.description) ? undefined : value.description,
      tags: [...(value.tags ?? []), ...(value.glossaryTerms ?? [])],
      ...testCaseClassBase.getCreateTestCaseObject(value, selectedDefinition),
    };
  };

  const handleFormSubmit: FormProps['onFinish'] = async (value) => {
    setLoading(true);
    await onSubmit(createTestCaseObj(value));
    setLoading(false);
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
    } else if (value.column) {
      form.setFieldsValue({ testTypeId: undefined });
      setSelectedTestType(undefined);
    }
  };

  const handleTestDefinitionChange = (value: string) => {
    setTestDefinition(
      testDefinitions.find((item) => item.fullyQualifiedName === value)
    );
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
          initialValue: initialValue?.description ?? '',
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
    [initialValue?.description, initialValue?.tags]
  );

  useEffect(() => {
    const selectedColumn = table.columns.find(
      (column) => column.name === columnName
    );

    if (selectedColumn?.dataType !== currentColumnType) {
      fetchAllTestDefinitions(selectedColumn?.dataType);
      setCurrentColumnType(selectedColumn?.dataType);
    }
    if (selectedColumn) {
      navigate({
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
    if (!isColumnFqn) {
      fetchAllTestDefinitions();
    }
    form.setFieldsValue({
      testName: replaceAllSpacialCharWith_(initialValue?.name ?? ''),
      testTypeId: initialValue?.testDefinition,
      params: initialValue?.parameterValues?.length
        ? getParamsValue()
        : undefined,
      columnName: activeColumnFqn ? getNameFromFQN(activeColumnFqn) : undefined,
      tags: initialValue?.tags || [],
    });
  }, []);

  useEffect(() => {
    form.setFieldsValue({
      column: activeColumnFqn ? getNameFromFQN(activeColumnFqn) : undefined,
    });
  }, [activeColumnFqn]);

  const testTypeOptions: DefaultOptionType[] = useMemo(
    () =>
      testDefinitions.map((suite) => ({
        label: (
          <div data-testid={suite.fullyQualifiedName}>
            <Typography.Paragraph className="m-b-0">
              {getEntityName(suite)}
            </Typography.Paragraph>
            <Typography.Paragraph className="m-b-0 text-grey-muted text-xs">
              {suite.description}
            </Typography.Paragraph>
          </div>
        ),
        value: suite.fullyQualifiedName ?? '',
        labelValue: getEntityName(suite),
      })),

    [testDefinitions]
  );

  return (
    <Form
      data-testid="test-case-form"
      form={form}
      initialValues={{ ...testCaseClassBase.initialFormValues() }}
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
            allowClear
            showSearch
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
            max: 256,
            message: t('message.entity-maximum-size', {
              entity: t('label.name'),
              max: 256,
            }),
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
        ]}
        tooltip={testDefinition?.description}>
        <Select
          showSearch
          data-testid="test-type"
          filterOption={filterSelectOptions}
          options={testTypeOptions}
          placeholder={t('label.select-field', { field: t('label.test-type') })}
          popupClassName="no-wrap-option"
          onChange={handleTestDefinitionChange}
        />
      </Form.Item>
      {generateFormFields(
        testCaseClassBase.createFormAdditionalFields(
          testDefinition?.supportsDynamicAssertion ?? false
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
          getFieldValue('useDynamicAssertion') ? null : generateParamsField
        }
      </Form.Item>

      {generateFormFields(formField)}

      {isComputeRowCountFieldVisible ? generateFormFields(formFields) : null}

      <Form.Item noStyle>
        <Space className="w-full justify-end" size={16}>
          <Button data-testid="cancel-btn" disabled={loading} onClick={onBack}>
            {t('label.back')}
          </Button>
          <Button
            data-testid="submit-test"
            htmlType="submit"
            loading={loading}
            type="primary">
            {t('label.submit')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default TestCaseForm;
