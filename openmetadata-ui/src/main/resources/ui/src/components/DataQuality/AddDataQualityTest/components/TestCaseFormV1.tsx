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
  DrawerProps,
  Form,
  Select,
  Space,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { isEmpty, snakeCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnIcon } from '../../../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-format-table.svg';
import {
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../../constants/regex.constants';
import { SearchIndex } from '../../../../enums/search.enum';
import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import { CreateTestCase } from '../../../../generated/api/tests/createTestCase';
import { Table } from '../../../../generated/entity/data/table';
import { TagLabel, TestCase } from '../../../../generated/tests/testCase';
import {
  EntityType,
  TestDataType,
  TestDefinition,
  TestPlatform,
} from '../../../../generated/tests/testDefinition';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../interface/FormUtils.interface';
import { TableSearchSource } from '../../../../interface/search.interface';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTableDetailsByFQN } from '../../../../rest/tableAPI';
import {
  createTestCase,
  getListTestCaseBySearch,
  getListTestDefinitions,
} from '../../../../rest/testAPI';
import {
  filterSelectOptions,
  replaceAllSpacialCharWith_,
} from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { generateFormFields } from '../../../../utils/formUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { AsyncSelect } from '../../../common/AsyncSelect/AsyncSelect';
import SelectionCardGroup from '../../../common/SelectionCardGroup/SelectionCardGroup';
import { SelectionOption } from '../../../common/SelectionCardGroup/SelectionCardGroup.interface';
import { TestCaseFormType } from '../AddDataQualityTest.interface';
import ParameterForm from './ParameterForm';
import './TestCaseFormV1.less';

export interface TestCaseFormV1Props {
  isDrawer?: boolean;
  drawerProps?: DrawerProps;
  className?: string;
  table?: Table;
  onFormSubmit?: (testCase: TestCase) => void;
  onCancel?: () => void;
  initialValues?: Partial<FormValues>;
  loading?: boolean;
}

interface FormValues {
  testLevel: TestLevel;
  selectedTable?: string;
  selectedColumn?: string;
  testTypeId?: string;
  testName?: string;
  description?: string;
  tags?: TagLabel[];
  glossaryTerms?: TagLabel[];
  computePassedFailedRowCount?: boolean;
  useDynamicAssertion?: boolean;
  params?: Record<string, string | { [key: string]: string }[]>;
  parameterValues?: Array<{ name: string; value: string }>;
}

type TablesCache = Map<string, TableSearchSource>;

export enum TestLevel {
  TABLE = 'table',
  COLUMN = 'column',
}

// Constants
const TEST_LEVEL_OPTIONS: SelectionOption[] = [
  {
    value: TestLevel.TABLE,
    label: 'Table Level',
    description: 'Test applied on table',
    icon: <TableIcon />,
  },
  {
    value: TestLevel.COLUMN,
    label: 'Column Level',
    description: 'Test applied on column',
    icon: <ColumnIcon />,
  },
];

const TABLE_SEARCH_FIELDS: (keyof TableSearchSource)[] = [
  'name',
  'fullyQualifiedName',
  'displayName',
  'columns',
];

// Helper function to convert TableSearchSource to Table
const convertSearchSourceToTable = (searchSource: TableSearchSource): Table =>
  ({
    ...searchSource,
    columns: searchSource.columns || [],
  } as Table);

const TestCaseFormV1: FC<TestCaseFormV1Props> = ({
  className,
  drawerProps,
  initialValues,
  isDrawer = false,
  table,
  onFormSubmit,
  onCancel,
  loading: externalLoading = false,
}: TestCaseFormV1Props) => {
  const { t } = useTranslation();
  const [form] = useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [selectedTestDefinition, setSelectedTestDefinition] =
    useState<TestDefinition>();
  const [selectedTestType, setSelectedTestType] = useState<string | undefined>(
    initialValues?.testTypeId
  );
  const [currentColumnType, setCurrentColumnType] = useState<string>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedTableData, setSelectedTableData] = useState<Table | undefined>(
    table
  );
  const [tablesCache, setTablesCache] = useState<TablesCache>(new Map());
  const [existingTestCases, setExistingTestCases] = useState<string[]>([]);
  const selectedTestLevel = Form.useWatch('testLevel', form);
  const selectedTable = Form.useWatch('selectedTable', form);
  const selectedColumn = Form.useWatch('selectedColumn', form);
  const useDynamicAssertion = Form.useWatch('useDynamicAssertion', form);

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const testCaseObj = createTestCaseObj(values);
      const createdTestCase = await createTestCase(testCaseObj);

      // Pass created test case to parent
      onFormSubmit?.(createdTestCase);
      // Close drawer if in drawer mode
      if (isDrawer) {
        onCancel?.();
      }
      // Show success message
      showSuccessToast(
        t('message.entity-created-successfully', {
          entity: t('label.test-case'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleValuesChange = useCallback(
    (changedValues: Partial<FormValues>) => {
      if (changedValues.testTypeId) {
        // Handle test type selection
        setSelectedTestType(changedValues.testTypeId);
        const testDef = testDefinitions.find(
          (definition) =>
            definition.fullyQualifiedName === changedValues.testTypeId
        );
        setSelectedTestDefinition(testDef);
      }
    },
    [testDefinitions]
  );

  const isFormLoading = loading || externalLoading;

  // Reusable action buttons component
  const renderActionButtons = useMemo(
    () => (
      <Space size={16}>
        <Button
          data-testid="cancel-btn"
          disabled={isFormLoading}
          size="large"
          onClick={handleCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          data-testid="create-btn"
          htmlType="submit"
          loading={isFormLoading}
          size="large"
          type="primary"
          onClick={() => form.submit()}>
          {t('label.create')}
        </Button>
      </Space>
    ),
    [isFormLoading, handleCancel, form, t]
  );

  const fetchTables = useCallback(async (searchValue = '', page = 1) => {
    try {
      const response = await searchQuery({
        query: searchValue ? `*${searchValue}*` : '*',
        pageNumber: page,
        pageSize: PAGE_SIZE_MEDIUM,
        searchIndex: SearchIndex.TABLE,
        includeFields: TABLE_SEARCH_FIELDS,
        trackTotalHits: true,
      });

      const data = response.hits.hits.map((hit) => {
        // Cache the table data for later use
        setTablesCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(
            hit._source.fullyQualifiedName ?? hit._source.name,
            hit._source
          );

          return newCache;
        });

        return {
          label: hit._source.fullyQualifiedName,
          value: hit._source.fullyQualifiedName,
          data: hit._source,
        };
      });

      // Return data in the format expected by AsyncSelect for infinite scroll
      return {
        data,
        paging: {
          total: response.hits.total.value,
        },
      };
    } catch (error) {
      return {
        data: [],
        paging: { total: 0 },
      };
    }
  }, []);

  const columnOptions = useMemo(() => {
    if (!selectedTableData?.columns) {
      return [];
    }

    return selectedTableData.columns.map((column) => ({
      label: column.name,
      value: column.name,
      data: column,
    }));
  }, [selectedTableData]);

  const fetchTestDefinitions = useCallback(
    async (columnType?: string) => {
      try {
        const { data } = await getListTestDefinitions({
          limit: PAGE_SIZE_LARGE,
          entityType:
            selectedTestLevel === TestLevel.COLUMN
              ? EntityType.Column
              : EntityType.Table,
          testPlatform: TestPlatform.OpenMetadata,
          supportedDataType: columnType,
        });

        setTestDefinitions(data);
      } catch (error) {
        setTestDefinitions([]);
      }
    },
    [selectedTestLevel]
  );

  const fetchSelectedTableData = useCallback(async (tableFqn: string) => {
    try {
      const tableData = await getTableDetailsByFQN(tableFqn, {
        fields: 'columns',
      });
      setSelectedTableData(tableData);
    } catch (error) {
      setSelectedTableData(undefined);
    }
  }, []);

  const fetchExistingTestCases = useCallback(async () => {
    if (!selectedTableData && !selectedTable) {
      return;
    }

    try {
      const entityFqn = selectedTableData?.fullyQualifiedName || selectedTable;
      if (!entityFqn) {
        return;
      }

      const { data } = await getListTestCaseBySearch({
        limit: PAGE_SIZE_LARGE,
        entityLink: `<#E::table::${entityFqn}>`,
      });

      const testCaseNames = data.map((testCase) => testCase.name);
      setExistingTestCases(testCaseNames);
    } catch (error) {
      setExistingTestCases([]);
    }
  }, [selectedTableData, selectedTable]);

  // Initialize form on mount and update params when test definition changes
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);

      // Set proper params with type handling if we have initial parameter values
      if (initialValues?.parameterValues?.length && selectedTestDefinition) {
        form.setFieldsValue({
          params: getParamsValue(),
        });
      }
    }
  }, [isInitialized, initialValues?.parameterValues, selectedTestDefinition]);

  // Handle test level changes
  useEffect(() => {
    if (selectedTestLevel) {
      // Fetch appropriate test definitions
      fetchTestDefinitions();

      // Reset dependent fields
      form.setFieldsValue({
        testTypeId: undefined,
        selectedColumn:
          selectedTestLevel === TestLevel.TABLE
            ? undefined
            : form.getFieldValue('selectedColumn'),
      });
      setSelectedTestDefinition(undefined);
    }
  }, [selectedTestLevel, fetchTestDefinitions]);

  // Handle table selection: use cached data or fetch if needed
  useEffect(() => {
    if (selectedTable) {
      const cachedTableData = tablesCache.get(selectedTable);
      if (cachedTableData) {
        setSelectedTableData(convertSearchSourceToTable(cachedTableData));
      } else {
        fetchSelectedTableData(selectedTable);
      }
    } else {
      setSelectedTableData(table);
    }
    form.setFieldsValue({ selectedColumn: undefined });
  }, [selectedTable, table, tablesCache, fetchSelectedTableData, form]);

  // Fetch existing test cases when table data is available
  useEffect(() => {
    fetchExistingTestCases();
  }, [fetchExistingTestCases]);

  const getSelectedTestDefinition = useCallback(() => {
    const testType = isEmpty(initialValues?.testTypeId)
      ? selectedTestType
      : initialValues?.testTypeId;

    return testDefinitions.find(
      (definition) => definition.fullyQualifiedName === testType
    );
  }, [initialValues?.testTypeId, selectedTestType, testDefinitions]);

  const getParamsValue = useCallback(() => {
    return initialValues?.parameterValues?.reduce(
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
  }, [initialValues?.parameterValues, getSelectedTestDefinition]);

  // Compute initial params without test definition dependency for form initialization
  const getInitialParamsValue = useMemo(() => {
    if (!initialValues?.parameterValues?.length) {
      return undefined;
    }

    return initialValues.parameterValues.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.name || '']: curr?.value,
      }),
      {}
    );
  }, [initialValues?.parameterValues]);

  const createTestCaseObj = useCallback(
    (value: FormValues): CreateTestCase => {
      const selectedDefinition = getSelectedTestDefinition();
      const tableName =
        selectedTableData?.name || selectedTable || table?.name || '';
      const columnName = selectedColumn;

      const name =
        value.testName?.trim() ||
        `${replaceAllSpacialCharWith_(columnName ?? tableName)}_${snakeCase(
          selectedTestType
        )}_${cryptoRandomString({
          length: 4,
          type: 'alphanumeric',
        })}`;

      // Generate entity link based on test level
      const entityFqn =
        selectedTableData?.fullyQualifiedName ||
        selectedTable ||
        table?.fullyQualifiedName ||
        '';
      const isColumnLevel = selectedTestLevel === TestLevel.COLUMN;
      const entityLink = generateEntityLink(
        isColumnLevel ? `${entityFqn}.${columnName}` : entityFqn,
        isColumnLevel
      );

      return {
        name,
        displayName: name,
        computePassedFailedRowCount: value.computePassedFailedRowCount,
        entityLink,
        testDefinition: value.testTypeId ?? '',
        description: isEmpty(value.description) ? undefined : value.description,
        tags: [...(value.tags ?? []), ...(value.glossaryTerms ?? [])],
        ...testCaseClassBase.getCreateTestCaseObject(
          value as TestCaseFormType,
          selectedDefinition
        ),
      };
    },
    [
      getSelectedTestDefinition,
      selectedTableData,
      selectedTable,
      table,
      selectedColumn,
      selectedTestType,
      selectedTestLevel,
    ]
  );

  // Handle column selection and fetch test definitions with column type
  useEffect(() => {
    if (
      selectedColumn &&
      selectedTableData &&
      selectedTestLevel === TestLevel.COLUMN
    ) {
      const selectedColumnData = selectedTableData.columns?.find(
        (column) => column.name === selectedColumn
      );

      if (selectedColumnData?.dataType !== currentColumnType) {
        fetchTestDefinitions(selectedColumnData?.dataType);
        setCurrentColumnType(selectedColumnData?.dataType);
      }
    }
  }, [
    selectedColumn,
    selectedTableData,
    currentColumnType,
    selectedTestLevel,
    fetchTestDefinitions,
  ]);

  // Handle test type selection
  const handleTestDefinitionChange = useCallback(
    (value: string) => {
      const testDefinition = testDefinitions.find(
        (definition) => definition.fullyQualifiedName === value
      );
      setSelectedTestDefinition(testDefinition);
    },
    [testDefinitions]
  );

  const testTypeOptions = useMemo(
    () =>
      testDefinitions.map((testDef) => ({
        label: (
          <div data-testid={testDef.fullyQualifiedName}>
            <Typography.Paragraph className="m-b-0">
              {getEntityName(testDef)}
            </Typography.Paragraph>
            <Typography.Paragraph className="m-b-0 text-grey-muted text-xs">
              {testDef.description}
            </Typography.Paragraph>
          </div>
        ),
        value: testDef.fullyQualifiedName ?? '',
        labelValue: getEntityName(testDef),
      })),
    [testDefinitions]
  );

  const generateParamsField = useMemo(() => {
    if (selectedTestDefinition?.parameterDefinition && !useDynamicAssertion) {
      return (
        <ParameterForm
          definition={selectedTestDefinition}
          table={selectedTableData}
        />
      );
    }

    return null;
  }, [selectedTestDefinition, selectedTableData, useDynamicAssertion]);

  const isComputeRowCountFieldVisible = useMemo(() => {
    return selectedTestDefinition?.supportsRowLevelPassedFailed ?? false;
  }, [selectedTestDefinition]);

  const isDynamicAssertionSupported = useMemo(() => {
    return selectedTestDefinition?.supportsDynamicAssertion ?? false;
  }, [selectedTestDefinition]);

  const testDetailsFormFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'testName',
        required: false,
        label: t('label.name'),
        id: 'root/testName',
        type: FieldTypes.TEXT,
        placeholder: t('message.enter-test-case-name'),
        rules: [
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
              if (value && existingTestCases.includes(value)) {
                return Promise.reject(
                  t('message.entity-already-exists', {
                    entity: t('label.name'),
                  })
                );
              }

              return Promise.resolve();
            },
          },
        ],
        props: {
          'data-testid': 'test-case-name',
        },
      },
      {
        name: 'description',
        required: false,
        label: t('label.description'),
        id: 'root/description',
        type: FieldTypes.DESCRIPTION,
        props: {
          'data-testid': 'description',
          initialValue: initialValues?.description ?? '',
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
    [initialValues?.description, initialValues?.tags, existingTestCases, t]
  );

  const dynamicAssertionField: FieldProp[] = useMemo(
    () => [
      {
        name: 'useDynamicAssertion',
        label: t('label.use-dynamic-assertion'),
        type: FieldTypes.SWITCH,
        required: false,
        props: {
          'data-testid': 'use-dynamic-assertion',
          className: 'use-dynamic-assertion-switch',
        },
        id: 'root/useDynamicAssertion',
        formItemLayout: FormItemLayout.HORIZONTAL,
      },
    ],
    [t]
  );

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
    []
  );

  const formContent = (
    <div
      className={classNames(
        'test-case-form-v1',
        {
          'drawer-mode': isDrawer,
          'standalone-mode': !isDrawer,
        },
        className
      )}>
      <Form
        data-testid="test-case-form-v1"
        form={form}
        initialValues={{
          testLevel: TestLevel.TABLE,
          ...testCaseClassBase.initialFormValues(),
          testName: replaceAllSpacialCharWith_(initialValues?.testName ?? ''),
          testTypeId: initialValues?.testTypeId,
          params: getInitialParamsValue,
          tags: initialValues?.tags || [],
          useDynamicAssertion: initialValues?.useDynamicAssertion ?? false,
          ...initialValues,
        }}
        layout="vertical"
        name="testCaseFormV1"
        preserve={false}
        onFinish={handleSubmit}
        onValuesChange={handleValuesChange}>
        <Form.Item
          label="Select on which element your test should be performed"
          name="testLevel"
          rules={[{ required: true, message: 'Please select test level' }]}>
          <SelectionCardGroup options={TEST_LEVEL_OPTIONS} />
        </Form.Item>

        <Card className="select-table-card">
          <Form.Item
            label="Select Table"
            name="selectedTable"
            rules={[{ required: true, message: 'Please select a table' }]}>
            <AsyncSelect
              allowClear
              enableInfiniteScroll
              showSearch
              api={fetchTables}
              placeholder="Select one or more table at a time"
            />
          </Form.Item>

          {selectedTestLevel === TestLevel.COLUMN && selectedTable && (
            <Form.Item
              label="Select Column"
              name="selectedColumn"
              rules={[{ required: true, message: 'Please select a column' }]}>
              <Select
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                loading={!selectedTableData}
                options={columnOptions}
                placeholder="Select a column"
              />
            </Form.Item>
          )}
        </Card>

        <Card className="test-type-card">
          <Form.Item
            label="Test Type"
            name="testTypeId"
            rules={[{ required: true, message: 'Please select a test type' }]}
            tooltip={selectedTestDefinition?.description}>
            <Select
              showSearch
              filterOption={filterSelectOptions}
              options={testTypeOptions}
              placeholder="Select a test type"
              popupClassName="no-wrap-option"
              onChange={handleTestDefinitionChange}
            />
          </Form.Item>

          {isDynamicAssertionSupported &&
            generateFormFields(dynamicAssertionField)}

          {selectedTestDefinition && generateParamsField}
        </Card>

        <Card className="test-details-card">
          {generateFormFields(testDetailsFormFields)}

          {isComputeRowCountFieldVisible &&
            generateFormFields(computeRowCountField)}
        </Card>
      </Form>

      {!isDrawer && (
        <div className="test-case-form-actions">{renderActionButtons}</div>
      )}
    </div>
  );

  const drawerFooter = (
    <div className="drawer-footer-actions">{renderActionButtons}</div>
  );

  if (isDrawer) {
    return (
      <Drawer
        destroyOnClose
        footer={drawerFooter}
        placement="right"
        size="large"
        {...drawerProps}
        onClose={onCancel}>
        <div className="drawer-form-content">{formContent}</div>
      </Drawer>
    );
  }

  return formContent;
};

export default TestCaseFormV1;
