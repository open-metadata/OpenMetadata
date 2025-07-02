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

// =============================================
// IMPORTS
// =============================================
import {
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Row,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { isEmpty, isEqual, isString, snakeCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnIcon } from '../../../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-format-table.svg';
import {
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../../constants/regex.constants';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { SearchIndex } from '../../../../enums/search.enum';
import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import {
  ConfigType,
  CreateIngestionPipeline,
  PipelineType,
} from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { CreateTestCase } from '../../../../generated/api/tests/createTestCase';
import { Table } from '../../../../generated/entity/data/table';
import { LogLevels } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
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
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
  getIngestionPipelines,
} from '../../../../rest/ingestionPipelineAPI';
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
import { getScheduleOptionsFromSchedules } from '../../../../utils/SchedularUtils';
import { getIngestionName } from '../../../../utils/ServiceUtils';
import { generateUUID } from '../../../../utils/StringsUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { AsyncSelect } from '../../../common/AsyncSelect/AsyncSelect';
import SelectionCardGroup from '../../../common/SelectionCardGroup/SelectionCardGroup';
import { SelectionOption } from '../../../common/SelectionCardGroup/SelectionCardGroup.interface';
import ScheduleIntervalV1 from '../../../Settings/Services/AddIngestion/Steps/ScheduleIntervalV1';
import { AddTestCaseList } from '../../AddTestCaseList/AddTestCaseList.component';
import { TestCaseFormType } from '../AddDataQualityTest.interface';
import ParameterForm from './ParameterForm';
import {
  FormValues,
  TablesCache,
  TestCaseFormV1Props,
  TestLevel,
} from './TestCaseFormV1.interface';
import './TestCaseFormV1.less';

// =============================================
// CONSTANTS
// =============================================
const MAX_TEST_NAME_LENGTH = 256;
const RANDOM_STRING_LENGTH = 4;

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
  'testSuite',
];

// =============================================
// HELPER FUNCTIONS
// =============================================
const convertSearchSourceToTable = (searchSource: TableSearchSource): Table =>
  ({
    ...searchSource,
    columns: searchSource.columns || [],
  } as Table);

// =============================================
// MAIN COMPONENT
// =============================================
const TestCaseFormV1: FC<TestCaseFormV1Props> = ({
  className,
  drawerProps,
  initialValues,
  isDrawer = false,
  table,
  testSuite,
  onFormSubmit,
  onCancel,
  loading: externalLoading = false,
}: TestCaseFormV1Props) => {
  // =============================================
  // HOOKS - External
  // =============================================
  const { t } = useTranslation();
  const { config } = useLimitStore();
  const [form] = useForm<FormValues>();

  // =============================================
  // HOOKS - State (grouped by functionality)
  // =============================================
  // Form state
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Test definition state
  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [selectedTestDefinition, setSelectedTestDefinition] =
    useState<TestDefinition>();
  const [selectedTestType, setSelectedTestType] = useState<string | undefined>(
    initialValues?.testTypeId
  );
  const [currentColumnType, setCurrentColumnType] = useState<string>();

  // Table state
  const [selectedTableData, setSelectedTableData] = useState<Table | undefined>(
    table
  );
  const [tablesCache, setTablesCache] = useState<TablesCache>(new Map());

  // Test case state
  const [existingTestCases, setExistingTestCases] = useState<string[]>([]);

  // Pipeline state
  const [canCreatePipeline, setCanCreatePipeline] = useState<boolean>(false);
  const [isTestNameManuallyEdited, setIsTestNameManuallyEdited] =
    useState<boolean>(false);

  // =============================================
  // HOOKS - Form Watches
  // =============================================
  const selectedTestLevel = Form.useWatch('testLevel', form);
  const selectedTable = Form.useWatch('selectedTable', form);
  const selectedColumn = Form.useWatch('selectedColumn', form);
  const selectAllTestCases = Form.useWatch('selectAllTestCases', form);

  // =============================================
  // HOOKS - Computed Values
  // =============================================
  const hasTestSuite = Boolean(
    testSuite?.id || selectedTableData?.testSuite?.id
  );
  const isSelectAllTestCasesEnabled = Boolean(selectedTable && hasTestSuite);
  const shouldShowScheduler = selectedTable && canCreatePipeline;
  const isFormLoading = loading || externalLoading;

  const pipelineSchedules = config?.limits?.config.featureLimits.find(
    (feature) => feature.name === 'dataQuality'
  )?.pipelineSchedules;

  // =============================================
  // HOOKS - Memoized Values (grouped by functionality)
  // =============================================
  // Scheduler options
  const schedulerOptions = useMemo(() => {
    if (isEmpty(pipelineSchedules) || !pipelineSchedules) {
      return undefined;
    }

    return getScheduleOptionsFromSchedules(pipelineSchedules);
  }, [pipelineSchedules]);

  // Table & Column options
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

  // Test type options
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

  // Test definition capabilities
  const isComputeRowCountFieldVisible = useMemo(
    () => selectedTestDefinition?.supportsRowLevelPassedFailed ?? false,
    [selectedTestDefinition]
  );

  // Parameter form rendering
  const generateParamsField = useMemo(() => {
    if (!selectedTestDefinition?.parameterDefinition) {
      return null;
    }

    return (
      <ParameterForm
        definition={selectedTestDefinition}
        table={selectedTableData}
      />
    );
  }, [selectedTestDefinition, selectedTableData]);

  // Initial parameter values
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

  // Dynamic test name generation
  const generateDynamicTestName = useCallback(() => {
    const testType = selectedTestDefinition?.name || '';

    // Don't generate if test type is missing
    if (!testType) {
      return '';
    }

    const randomString = cryptoRandomString({
      length: RANDOM_STRING_LENGTH,
      type: 'alphanumeric',
    });

    let dynamicName = '';

    if (selectedTestLevel === TestLevel.TABLE) {
      // Table level: tableName_testType_randomString
      const tableName = selectedTableData?.name || selectedTable || 'table';
      dynamicName = `${tableName}_${testType}_${randomString}`;
    } else if (selectedTestLevel === TestLevel.COLUMN && selectedColumn) {
      // Column level: columnName_testType_randomString
      dynamicName = `${selectedColumn}_${testType}_${randomString}`;
    }

    // Replace spaces and special characters with underscores
    let finalName = snakeCase(dynamicName);

    // Check length limit
    if (finalName.length > MAX_TEST_NAME_LENGTH) {
      // Fallback to testType_randomString if too long
      finalName = snakeCase(`${testType}_${randomString}`);
    }

    return finalName;
  }, [
    selectedTableData,
    selectedTable,
    selectedColumn,
    selectedTestDefinition,
    selectedTestLevel,
  ]);

  // Form field configurations (grouped by form section)
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
          onChange: () => setIsTestNameManuallyEdited(true),
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
          style: { margin: 0 },
        },
      },
      {
        name: 'tags',
        required: false,
        label: t('label.tag-plural'),
        id: 'root/tags',
        type: FieldTypes.TAG_SUGGESTION,
        props: {
          selectProps: { 'data-testid': 'tags-selector' },
        },
      },
      {
        name: 'glossaryTerms',
        required: false,
        label: t('label.glossary-term-plural'),
        id: 'root/glossaryTerms',
        type: FieldTypes.TAG_SUGGESTION,
        props: {
          selectProps: { 'data-testid': 'glossary-terms-selector' },
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
    [
      initialValues?.description,
      initialValues?.tags,
      existingTestCases,
      setIsTestNameManuallyEdited,
    ]
  );

  const computeRowCountField: FieldProp[] = useMemo(
    () => [
      {
        name: 'computePassedFailedRowCount',
        label: t('label.compute-row-count'),
        type: FieldTypes.SWITCH,
        helperText: t('message.compute-row-count-helper-text'),
        required: false,
        props: { 'data-testid': 'compute-passed-failed-row-count' },
        id: 'root/computePassedFailedRowCount',
        formItemLayout: FormItemLayout.HORIZONTAL,
      },
    ],
    []
  );

  const schedulerFormFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'pipelineName',
        label: t('label.name'),
        type: FieldTypes.TEXT,
        required: false,
        placeholder: t('label.enter-entity', { entity: t('label.name') }),
        props: { 'data-testid': 'pipeline-name' },
        id: 'root/pipelineName',
      },
    ],
    []
  );

  // =============================================
  // HOOKS - Callbacks (grouped by functionality)
  // =============================================
  // Pipeline-related callbacks
  const checkExistingPipelines = useCallback(async (testSuiteFqn: string) => {
    try {
      const { paging } = await getIngestionPipelines({
        testSuite: testSuiteFqn,
        pipelineType: [PipelineType.TestSuite],
        arrQueryFields: ['id'],
        limit: 0,
      });
      setCanCreatePipeline(paging.total === 0);
    } catch (error) {
      setCanCreatePipeline(true);
    }
  }, []);

  // Form interaction callbacks
  const handleCancel = useCallback(() => {
    onCancel?.();
  }, [onCancel]);

  const handleValuesChange = useCallback(
    (changedValues: Partial<FormValues>) => {
      if (changedValues.testTypeId) {
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

  const handleTestDefinitionChange = useCallback(
    (value: string) => {
      const testDefinition = testDefinitions.find(
        (definition) => definition.fullyQualifiedName === value
      );
      setSelectedTestDefinition(testDefinition);
    },
    [testDefinitions]
  );

  // Action buttons rendering
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
    [isFormLoading, handleCancel, form]
  );

  // API-related callbacks
  const fetchTables = useCallback(async (searchValue = '', page = 1) => {
    try {
      const response = await searchQuery({
        query: searchValue ? `*${searchValue}*` : '*',
        pageNumber: page,
        pageSize: PAGE_SIZE_MEDIUM,
        searchIndex: SearchIndex.TABLE,
        includeFields: TABLE_SEARCH_FIELDS,
        fetchSource: true,
        trackTotalHits: true,
      });

      const data = response.hits.hits.map((hit) => {
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

      return {
        data,
        paging: { total: response.hits.total.value },
      };
    } catch (error) {
      return { data: [], paging: { total: 0 } };
    }
  }, []);

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
        fields: 'columns,testSuite',
      });
      setSelectedTableData(tableData);
    } catch (error) {
      setSelectedTableData(undefined);
    }
  }, []);

  const fetchExistingTestCases = useCallback(async () => {
    if (!hasTestSuite || (!selectedTableData && !selectedTable)) {
      setExistingTestCases([]);

      return;
    }

    try {
      const entityFqn = selectedTableData?.fullyQualifiedName || selectedTable;
      if (!entityFqn) {
        setExistingTestCases([]);

        return;
      }

      const { data } = await getListTestCaseBySearch({
        limit: PAGE_SIZE_LARGE,
        entityLink: `<#E::table::${entityFqn}>`,
      });

      setExistingTestCases(data.map((testCase) => testCase.name));
    } catch (error) {
      setExistingTestCases([]);
    }
  }, [selectedTableData, selectedTable, hasTestSuite]);

  // Utility callbacks
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

  const createTestCaseObj = useCallback(
    (value: FormValues): CreateTestCase => {
      const selectedDefinition = getSelectedTestDefinition();
      const columnName = selectedColumn;

      const name = value.testName?.trim() || generateDynamicTestName();

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

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      setLoading(true);
      try {
        const testCaseObj = createTestCaseObj(values);
        const createdTestCase = await createTestCase(testCaseObj);
        const testSuiteResponse = createdTestCase.testSuite ?? testSuite;

        // Pipeline Creation Logic:
        // Pipeline will be created when ALL conditions are met:
        // 1. canCreatePipeline is true, which happens when:
        //    - Table has NO existing test suite (test suite will be created automatically)
        //    - Table has test suite with NO existing pipelines (count = 0)
        // 2. A test suite exists (either provided or newly created)
        // 3. User has configured scheduler (cron value for scheduled, undefined for onDemand)
        //
        // Pipeline will NOT be created when:
        // - No table is selected
        // - Table has test suite with existing pipelines
        // - canCreatePipeline is false
        if (testSuiteResponse && canCreatePipeline) {
          const selectedTestCases =
            values.testCases?.map((testCase) => {
              if (isString(testCase)) {
                return testCase;
              }

              return testCase.name ?? '';
            }) ?? [];
          const tableName = replaceAllSpacialCharWith_(
            selectedTable || table?.fullyQualifiedName || ''
          );
          const updatedName =
            values.pipelineName ||
            getIngestionName(tableName, PipelineType.TestSuite);

          const ingestionPayload: CreateIngestionPipeline = {
            airflowConfig: {
              scheduleInterval: values.cron,
            },
            displayName: updatedName,
            name: generateUUID(),
            loggerLevel: values.enableDebugLog
              ? LogLevels.Debug
              : LogLevels.Info,
            pipelineType: PipelineType.TestSuite,
            raiseOnError: values.raiseOnError ?? true,
            service: {
              id: testSuiteResponse.id ?? '',
              type: 'testSuite',
            },
            sourceConfig: {
              config: {
                type: ConfigType.TestSuite,
                entityFullyQualifiedName: testSuiteResponse.fullyQualifiedName,
                testCases: values.selectAllTestCases
                  ? undefined
                  : [createdTestCase.name, ...selectedTestCases],
              },
            },
          };

          const ingestion = await addIngestionPipeline(ingestionPayload);
          await deployIngestionPipelineById(ingestion.id ?? '');
        }

        showSuccessToast(
          t('server.create-entity-success', {
            entity: t('label.test-case'),
          })
        );

        onFormSubmit?.(createdTestCase);
        if (isDrawer) {
          onCancel?.();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setLoading(false);
      }
    },
    [
      createTestCaseObj,
      testSuite,
      selectedTable,
      table,
      onFormSubmit,
      isDrawer,
      onCancel,
    ]
  );

  // =============================================
  // EFFECT HOOKS
  // =============================================
  // Auto-set selectAllTestCases to true when switch should be disabled
  useEffect(() => {
    if (!isSelectAllTestCasesEnabled) {
      form.setFieldValue('selectAllTestCases', true);
    }
  }, [isSelectAllTestCasesEnabled, form]);

  // Initialize form on mount and update params when test definition changes
  useEffect(() => {
    if (!isInitialized) {
      setIsInitialized(true);
      if (initialValues?.parameterValues?.length && selectedTestDefinition) {
        form.setFieldsValue({
          params: getParamsValue(),
        });
      }
    }
  }, [
    isInitialized,
    initialValues?.parameterValues,
    selectedTestDefinition,
    form,
    getParamsValue,
  ]);

  // Handle test level changes
  useEffect(() => {
    if (selectedTestLevel) {
      fetchTestDefinitions();
      form.setFieldsValue({
        testTypeId: undefined,
        selectedColumn:
          selectedTestLevel === TestLevel.TABLE
            ? undefined
            : form.getFieldValue('selectedColumn'),
      });
      setSelectedTestDefinition(undefined);
    }
  }, [selectedTestLevel, fetchTestDefinitions, form]);

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

  // Check for existing pipelines when table is selected
  useEffect(() => {
    if (selectedTableData?.testSuite?.fullyQualifiedName) {
      // Table has test suite - check for existing pipelines
      checkExistingPipelines(selectedTableData.testSuite.fullyQualifiedName);
    } else if (testSuite?.fullyQualifiedName) {
      // Using provided test suite - check for existing pipelines
      checkExistingPipelines(testSuite.fullyQualifiedName);
    } else if (selectedTable) {
      // Table selected but no test suite - can create pipeline (test suite will be created)
      setCanCreatePipeline(true);
    } else {
      // No table selected - hide scheduler
      setCanCreatePipeline(false);
    }
  }, [
    selectedTableData?.testSuite?.fullyQualifiedName,
    testSuite?.fullyQualifiedName,
    selectedTable,
    checkExistingPipelines,
  ]);

  // Initialize manual edit flag based on initial values
  useEffect(() => {
    if (initialValues?.testName) {
      setIsTestNameManuallyEdited(true);
    } else {
      // Reset manual edit flag when no initial values (new test case)
      setIsTestNameManuallyEdited(false);
    }
  }, [initialValues?.testName]);

  // Reset manual edit flag when drawer is opened for new test case
  useEffect(() => {
    if (isDrawer && !initialValues?.testName) {
      setIsTestNameManuallyEdited(false);
    }
  }, [isDrawer, initialValues?.testName]);

  // Auto-generate test name when inputs change
  useEffect(() => {
    if (
      selectedTable &&
      selectedTestDefinition &&
      selectedTestLevel &&
      !initialValues?.testName && // Only auto-generate if no initial value provided
      !isTestNameManuallyEdited // Don't override if user has manually edited the name
    ) {
      const dynamicName = generateDynamicTestName();
      if (dynamicName) {
        form.setFieldValue('testName', dynamicName);
      }
    }
  }, [
    selectedTable,
    selectedColumn,
    selectedTestDefinition,
    selectedTestLevel,
    generateDynamicTestName,
    form,
    initialValues?.testName,
    isTestNameManuallyEdited,
  ]);

  // =============================================
  // RENDER
  // =============================================
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
          cron: DEFAULT_SCHEDULE_CRON_DAILY,
          enableDebugLog: false,
          raiseOnError: true,
          selectAllTestCases: true,
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

          {generateFormFields(
            testCaseClassBase.createFormAdditionalFields(
              selectedTestDefinition?.supportsDynamicAssertion ?? false
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
        </Card>

        <Card className="test-details-card">
          {generateFormFields(testDetailsFormFields)}

          {isComputeRowCountFieldVisible &&
            generateFormFields(computeRowCountField)}
        </Card>

        {shouldShowScheduler && (
          <Card className="scheduler-card">
            <div className="card-title">
              {t('label.schedule-for-entity', {
                entity: t('label.test-case-plural'),
              })}
            </div>

            {generateFormFields(schedulerFormFields)}

            <Form.Item label={t('label.schedule-interval')} name="cron">
              <ScheduleIntervalV1
                defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
                includePeriodOptions={schedulerOptions}
              />
            </Form.Item>

            {/* Debug Log and Raise on Error switches */}
            <div style={{ marginTop: '24px' }}>
              <Row gutter={[24, 16]}>
                <Col span={12}>
                  <div className="d-flex justify-between align-center">
                    <Typography.Text className="font-medium">
                      {t('label.enable-debug-log')}
                    </Typography.Text>
                    <Form.Item
                      name="enableDebugLog"
                      style={{ marginBottom: 0 }}
                      valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </div>
                </Col>
                <Col span={12}>
                  <div className="d-flex justify-between align-center">
                    <Typography.Text className="font-medium">
                      {t('label.raise-on-error')}
                    </Typography.Text>
                    <Form.Item
                      name="raiseOnError"
                      style={{ marginBottom: 0 }}
                      valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </div>
                </Col>
                <Col span={12}>
                  <div
                    className="d-flex justify-between align-center"
                    style={{ marginBottom: '16px' }}>
                    <Typography.Text className="font-medium">
                      {t('label.select-all-entity', {
                        entity: t('label.test-case-plural'),
                      })}
                    </Typography.Text>
                    <Form.Item
                      name="selectAllTestCases"
                      style={{ marginBottom: 0 }}
                      valuePropName="checked">
                      <Switch disabled={!isSelectAllTestCasesEnabled} />
                    </Form.Item>
                  </div>
                </Col>
                {!selectAllTestCases && isSelectAllTestCasesEnabled && (
                  <Col span={24}>
                    <Form.Item
                      label={t('label.test-case')}
                      name="testCases"
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.test-case'),
                          }),
                        },
                      ]}
                      valuePropName="selectedTest">
                      <AddTestCaseList
                        showButton={false}
                        testCaseParams={{
                          testSuiteId:
                            testSuite?.id ?? selectedTableData?.testSuite?.id,
                        }}
                      />
                    </Form.Item>
                  </Col>
                )}
              </Row>
            </div>
          </Card>
        )}
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
        closable={false}
        footer={drawerFooter}
        maskClosable={false}
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
