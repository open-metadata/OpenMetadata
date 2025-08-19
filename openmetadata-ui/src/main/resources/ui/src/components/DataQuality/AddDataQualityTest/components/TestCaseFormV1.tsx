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
import { EditOutlined } from '@ant-design/icons';
import { Button, Card, Col, Drawer, Form, Row, Space, Switch, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { isEmpty, isEqual, isString, snakeCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../../assets/svg/close.svg';
import { ReactComponent as ColumnIcon } from '../../../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-table-test.svg';
import {
    MAX_NAME_LENGTH,
    PAGE_SIZE_LARGE,
    PAGE_SIZE_MEDIUM
} from '../../../../constants/constants';
import { ENTITY_NAME_REGEX } from '../../../../constants/regex.constants';
import { DEFAULT_SCHEDULE_CRON_DAILY } from '../../../../constants/Schedular.constants';
import { useAirflowStatus } from '../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { SearchIndex } from '../../../../enums/search.enum';
import { TagSource } from '../../../../generated/api/domains/createDataProduct';
import {
    CreateIngestionPipeline,
    FluffyType as ConfigType,
    PipelineType
} from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { CreateTestCase } from '../../../../generated/api/tests/createTestCase';
import { Table } from '../../../../generated/entity/data/table';
import { LogLevels } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
    EntityType,
    TestDefinition,
    TestPlatform
} from '../../../../generated/tests/testDefinition';
import {
    FieldProp,
    FieldTypes,
    FormItemLayout
} from '../../../../interface/FormUtils.interface';
import { TableSearchSource } from '../../../../interface/search.interface';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import {
    addIngestionPipeline,
    deployIngestionPipelineById,
    getIngestionPipelines
} from '../../../../rest/ingestionPipelineAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTableDetailsByFQN } from '../../../../rest/tableAPI';
import {
    createTestCase,
    getListTestCaseBySearch,
    getListTestDefinitions
} from '../../../../rest/testAPI';
import {
    filterSelectOptions,
    replaceAllSpacialCharWith_,
    Transi18next
} from '../../../../utils/CommonUtils';
import { convertSearchSourceToTable } from '../../../../utils/DataQuality/DataQualityUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
    generateFormFields,
    getPopupContainer
} from '../../../../utils/formUtils';
import { getScheduleOptionsFromSchedules } from '../../../../utils/SchedularUtils';
import { getIngestionName } from '../../../../utils/ServiceUtils';
import { generateUUID } from '../../../../utils/StringsUtils';
import { generateEntityLink } from '../../../../utils/TableUtils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import AlertBar from '../../../AlertBar/AlertBar';
import { Select } from '../../../common/AntdCompat';
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
    TestLevel
} from './TestCaseFormV1.interface';
import './TestCaseFormV1.less';
;

const TABLE_SEARCH_FIELDS: (keyof TableSearchSource)[] = [
  'name',
  'fullyQualifiedName',
  'displayName',
  'columns',
  'testSuite',
];

// =============================================
// MAIN COMPONENT
// =============================================
const TestCaseFormV1: FC<TestCaseFormV1Props> = ({
  className,
  drawerProps,
  table,
  testSuite,
  onFormSubmit,
  onCancel,
  loading: externalLoading = false,
  testLevel = TestLevel.TABLE,
}: TestCaseFormV1Props) => {
  // =============================================
  // HOOKS - External
  // =============================================
  const { t } = useTranslation();
  const { config, getResourceLimit } = useLimitStore();
  const [form] = useForm<FormValues>();
  const { isAirflowAvailable } = useAirflowStatus();
  const { getEntityPermissionByFqn, permissions } = usePermissionProvider();
  const { ingestionPipeline, testCase } = permissions;

  const TEST_LEVEL_OPTIONS: SelectionOption[] = [
    {
      value: TestLevel.TABLE,
      label: t('label.table-level'),
      description: t('label.test-applied-on-entity', {
        entity: t('label.table-lowercase'),
      }),
      icon: <TableIcon />,
    },
    {
      value: TestLevel.COLUMN,
      label: t('label.column-level'),
      description: t('label.test-applied-on-entity', {
        entity: t('label.column-lowercase'),
      }),
      icon: <ColumnIcon />,
    },
  ];

  // =============================================
  // HOOKS - State (grouped by functionality)
  // =============================================
  // Form state
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Test definition state
  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [selectedTestDefinition, setSelectedTestDefinition] =
    useState<TestDefinition>();
  const [selectedTestType, setSelectedTestType] = useState<
    string | undefined
  >();
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

  // Permission state - only need loading state
  const [isCheckingPermissions, setIsCheckingPermissions] =
    useState<boolean>(false);
  const [isCustomQuery, setIsCustomQuery] = useState<boolean>(false);

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
  // Show select all test cases switch only when table has test suite and can create pipeline
  const isSelectAllTestCasesEnabled = Boolean(
    selectedTable && hasTestSuite && canCreatePipeline
  );
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

  // Dynamic test name generation
  const generateDynamicTestName = useCallback(() => {
    const testType = selectedTestDefinition?.name || '';

    // Don't generate if test type is missing
    if (!testType) {
      return '';
    }

    const randomString = cryptoRandomString({
      length: 4,
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
    if (finalName.length > MAX_NAME_LENGTH) {
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
            max: MAX_NAME_LENGTH,
            message: t('message.entity-maximum-size', {
              entity: t('label.name'),
              max: MAX_NAME_LENGTH,
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
          initialValue: '',
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
          selectProps: {
            'data-testid': 'tags-selector',
            getPopupContainer,
            maxTagCount: 8,
          },
          newLook: true,
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
            getPopupContainer,
            maxTagCount: 8,
          },
          open: false,
          hasNoActionButtons: true,
          newLook: true,
          isTreeSelect: true,
          tagType: TagSource.Glossary,
          placeholder: t('label.select-field', {
            field: t('label.glossary-term-plural'),
          }),
        },
      },
    ],
    [existingTestCases, setIsTestNameManuallyEdited]
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
        newLook: true,
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
  const checkExistingPipelines = useCallback(
    async (testSuiteFqn: string) => {
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
    },
    [ingestionPipeline]
  );

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
          type="link"
          onClick={handleCancel}>
          {t('label.cancel')}
        </Button>
        <Button
          data-testid="create-btn"
          htmlType="submit"
          loading={isFormLoading || isCheckingPermissions}
          type="primary"
          onClick={() => form.submit()}>
          {t('label.create')}
        </Button>
      </Space>
    ),
    [isFormLoading, isCheckingPermissions, handleCancel, form, t]
  );

  // API-related callbacks
  const fetchTables = useCallback(
    async (searchValue = '', page = 1) => {
      // Skip API call if table is provided via props
      if (table) {
        return {
          data: [
            {
              label: table.fullyQualifiedName,
              value: table.fullyQualifiedName,
              data: table,
            },
          ],
          paging: { total: 1 },
        };
      }

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
    },
    [table]
  );

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
    if (table) {
      setSelectedTableData(table);

      return;
    }

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

  // Permission checking callback
  const checkTablePermissions = useCallback(
    async (tableFqn: string) => {
      if (testCase.Create) {
        return Promise.resolve();
      }

      setIsCheckingPermissions(true);
      try {
        const permissions = await getEntityPermissionByFqn(
          ResourceEntity.TABLE,
          tableFqn
        );
        const canCreate = permissions.EditAll || permissions.EditTests;

        setCanCreatePipeline(canCreate);

        if (!canCreate) {
          // Return false to trigger validation error
          return Promise.reject(
            t('message.no-permission-for-create-test-case-on-table')
          );
        }

        return Promise.resolve();
      } catch (error) {
        // On permission check error, allow creation
        return Promise.resolve();
      } finally {
        setIsCheckingPermissions(false);
      }
    },
    [getEntityPermissionByFqn, t]
  );

  // Utility callbacks
  const getSelectedTestDefinition = useCallback(() => {
    return testDefinitions.find(
      (definition) => definition.fullyQualifiedName === selectedTestType
    );
  }, [selectedTestType, testDefinitions]);

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
      setErrorMessage('');
      try {
        const testCaseObj = createTestCaseObj(values);
        const createdTestCase = await createTestCase(testCaseObj);

        // Update current count when Create / Delete operation performed
        await getResourceLimit('dataQuality', true, true);
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
          if (isAirflowAvailable && ingestionPipeline.EditAll) {
            await deployIngestionPipelineById(ingestion.id ?? '');
          }
        }

        showSuccessToast(
          t('server.create-entity-success', {
            entity: t('label.test-case'),
          })
        );

        onFormSubmit?.(createdTestCase);
        onCancel?.();
      } catch (error) {
        // Show inline error alert for drawer mode
        const errorMsg =
          (error as AxiosError<{ message: string }>)?.response?.data?.message ||
          t('server.create-entity-error', {
            entity: t('label.test-case'),
          });
        setErrorMessage(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [createTestCaseObj, testSuite, selectedTable, table, onFormSubmit, onCancel]
  );

  // =============================================
  // EFFECT HOOKS
  // =============================================

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
      setIsCustomQuery(false);
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
    // Early return if user doesn't have permission to create pipelines or Early return if no table is selected
    if (!ingestionPipeline.Create || !selectedTable) {
      setCanCreatePipeline(false);

      return;
    }

    // Get the test suite FQN from either the table data or provided test suite
    const testSuiteFqn =
      selectedTableData?.testSuite?.fullyQualifiedName ||
      testSuite?.fullyQualifiedName;

    if (testSuiteFqn) {
      // Check for existing pipelines if we have a test suite
      checkExistingPipelines(testSuiteFqn);
    } else {
      // No test suite exists - can create pipeline (test suite will be created)
      setCanCreatePipeline(true);
    }
  }, [
    selectedTableData?.testSuite?.fullyQualifiedName,
    testSuite?.fullyQualifiedName,
    selectedTable,
    checkExistingPipelines,
    ingestionPipeline,
  ]);

  // Initialize manual edit flag
  useEffect(() => {
    // Reset manual edit flag for new test case
    setIsTestNameManuallyEdited(false);
  }, []);

  // Auto-generate test name when inputs change
  useEffect(() => {
    if (
      selectedTable &&
      selectedTestDefinition &&
      selectedTestLevel &&
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
    isTestNameManuallyEdited,
  ]);

  // =============================================
  // RENDER
  // =============================================
  const formContent = (
    <div className={classNames('test-case-form-v1 drawer-mode', className)}>
      {/* Floating Error Alert - always visible at top */}
      {errorMessage && (
        <div className="floating-error-alert">
          <AlertBar
            defafultExpand
            className="test-case-form-alert custom-alert-description"
            message={errorMessage}
            type="error"
          />
        </div>
      )}

      <Form
        className="new-form-style"
        data-testid="test-case-form-v1"
        form={form}
        initialValues={{
          testLevel,
          useDynamicAssertion: false,
          ...testCaseClassBase.initialFormValues(),
          cron: DEFAULT_SCHEDULE_CRON_DAILY,
          enableDebugLog: false,
          raiseOnError: true,
          selectAllTestCases: true,
          selectedTable: table?.fullyQualifiedName,
        }}
        layout="vertical"
        name="testCaseFormV1"
        preserve={false}
        scrollToFirstError={{
          behavior: 'smooth',
          block: 'center',
          scrollMode: 'if-needed',
        }}
        onFinish={handleSubmit}
        onValuesChange={handleValuesChange}>
        <Card className="form-card-section" data-testid="select-table-card">
          <Form.Item
            label={t('message.select-test-level')}
            name="testLevel"
            rules={[
              {
                required: true,
                message: t('label.please-select-entity', {
                  entity: t('label.test-level-lowercase'),
                }),
              },
            ]}>
            <SelectionCardGroup options={TEST_LEVEL_OPTIONS} />
          </Form.Item>
          <Form.Item
            label={t('label.select-entity', {
              entity: t('label.table'),
            })}
            name="selectedTable"
            rules={[
              {
                required: true,
                message: t('label.please-select-entity', {
                  entity: t('label.table'),
                }),
              },
              {
                validator: async (_, value) => {
                  if (value && !table) {
                    // Only check permissions if table is not provided via props
                    return checkTablePermissions(value);
                  }

                  return Promise.resolve();
                },
              },
            ]}>
            <AsyncSelect
              allowClear
              enableInfiniteScroll
              showSearch
              api={fetchTables}
              disabled={Boolean(table)}
              getPopupContainer={getPopupContainer}
              placeholder={t('label.select-entity', {
                entity: t('label.table'),
              })}
            />
          </Form.Item>

          {selectedTestLevel === TestLevel.COLUMN && selectedTable && (
            <Form.Item
              label={t('label.select-entity', {
                entity: t('label.column'),
              })}
              name="selectedColumn"
              rules={[
                {
                  required: true,
                  message: t('label.please-select-entity', {
                    entity: t('label.column'),
                  }),
                },
              ]}>
              <Select
                allowClear
                showSearch
                filterOption={filterSelectOptions}
                getPopupContainer={getPopupContainer}
                loading={!selectedTableData}
                options={columnOptions}
                placeholder={t('label.select-entity', {
                  entity: t('label.column'),
                })}
              />
            </Form.Item>
          )}
        </Card>

        <Card className="form-card-section" data-testid="test-details-card">
          {generateFormFields(testDetailsFormFields)}
        </Card>

        <Card className="form-card-section" data-testid="test-type-card">
          <Form.Item className="custom-select-test-type-style m-b-md">
            {selectedTestLevel === TestLevel.TABLE && (
              <div
                className={classNames(
                  'custom-test-type-container',
                  isCustomQuery ? 'justify-between' : 'justify-end'
                )}>
                {isCustomQuery ? (
                  <>
                    <Typography.Text className="test-type-label">
                      {t('label.test-type')}
                    </Typography.Text>
                    <Button
                      className="text-primary custom-query-btn"
                      data-testid="test-type-btn"
                      icon={<EditOutlined />}
                      size="small"
                      type="link"
                      onClick={() => {
                        form.setFieldValue('testTypeId', undefined);
                        // Manually trigger the change handlers
                        handleTestDefinitionChange('');
                        handleValuesChange({ testTypeId: undefined });
                        setIsCustomQuery(false);
                      }}>
                      {t('label.select-test-type')}
                    </Button>
                  </>
                ) : (
                  <Button
                    className="text-primary"
                    data-testid="custom-query"
                    icon={<EditOutlined />}
                    size="small"
                    type="link"
                    onClick={() => {
                      form.setFieldValue('testTypeId', 'tableCustomSQLQuery');
                      // Manually trigger the change handlers
                      handleTestDefinitionChange('tableCustomSQLQuery');
                      handleValuesChange({ testTypeId: 'tableCustomSQLQuery' });
                      setIsCustomQuery(true);
                    }}>
                    {t('label.custom-query')}
                  </Button>
                )}
              </div>
            )}
            <Form.Item
              hidden={isCustomQuery}
              label={t('label.select-test-type')}
              name="testTypeId"
              requiredMark={false}
              rules={[
                {
                  required: true,
                  message: t('label.select-test-type'),
                },
              ]}
              tooltip={selectedTestDefinition?.description}>
              <Select
                showSearch
                data-testid="test-type"
                filterOption={filterSelectOptions}
                getPopupContainer={getPopupContainer}
                options={testTypeOptions}
                placeholder={t('label.select-test-type')}
                popupClassName="no-wrap-option"
                onChange={handleTestDefinitionChange}
              />
            </Form.Item>
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

          {isComputeRowCountFieldVisible &&
            generateFormFields(computeRowCountField)}
        </Card>

        {shouldShowScheduler && (
          <Row gutter={[20, 20]}>
            <Col span={24}>
              <AlertBar
                defafultExpand
                className="test-case-form-alert custom-alert-description"
                message={
                  <Transi18next
                    i18nKey="message.entity-pipeline-information"
                    renderElement={<strong />}
                    values={{
                      entity: t('label.test-case-lowercase'),
                      type: t('label.table-lowercase'),
                    }}
                  />
                }
                type="grey-info"
              />
            </Col>

            <Col span={24}>
              <Card className="form-card-section" data-testid="scheduler-card">
                <div className="card-title-container">
                  <Typography.Paragraph className="card-title-text">
                    {t('label.create-entity', {
                      entity: t('label.pipeline'),
                    })}
                  </Typography.Paragraph>
                  <Typography.Paragraph className="card-title-description">
                    {t('message.pipeline-entity-description', {
                      entity: t('label.test-case'),
                    })}
                  </Typography.Paragraph>
                </div>

                {isSelectAllTestCasesEnabled && (
                  <Row className="m-b-md" gutter={[16, 16]}>
                    <Col span={12}>
                      <div className="d-flex gap-2 form-switch-container">
                        <Form.Item
                          className="m-b-0"
                          name="selectAllTestCases"
                          valuePropName="checked">
                          <Switch />
                        </Form.Item>
                        <Typography.Text className="font-medium">
                          {t('label.select-all-entity', {
                            entity: t('label.test-case-plural'),
                          })}
                        </Typography.Text>
                      </div>
                    </Col>

                    {!selectAllTestCases && (
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
                                testSuite?.id ??
                                selectedTableData?.testSuite?.id,
                            }}
                          />
                        </Form.Item>
                      </Col>
                    )}
                  </Row>
                )}

                {generateFormFields(schedulerFormFields)}

                <Form.Item name="cron">
                  <ScheduleIntervalV1
                    defaultSchedule={DEFAULT_SCHEDULE_CRON_DAILY}
                    entity={t('label.test-case')}
                    includePeriodOptions={schedulerOptions}
                  />
                </Form.Item>

                {/* Debug Log and Raise on Error switches */}
                <div className="m-t-md">
                  <Row gutter={[24, 16]}>
                    <Col span={12}>
                      <div className="d-flex gap-2 form-switch-container">
                        <Form.Item
                          className="m-b-0"
                          name="enableDebugLog"
                          valuePropName="checked">
                          <Switch />
                        </Form.Item>
                        <Typography.Paragraph className="font-medium m-0">
                          {t('label.enable-debug-log')}
                        </Typography.Paragraph>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div className="d-flex gap-2 form-switch-container">
                        <Form.Item
                          className="m-b-0"
                          name="raiseOnError"
                          valuePropName="checked">
                          <Switch />
                        </Form.Item>
                        <Typography.Paragraph className="font-medium m-0">
                          {t('label.raise-on-error')}
                        </Typography.Paragraph>
                      </div>
                    </Col>
                  </Row>
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Form>
    </div>
  );

  const drawerFooter = (
    <div className="drawer-footer-actions">{renderActionButtons}</div>
  );

  return (
    <Drawer
      destroyOnClose
      className="custom-drawer-style"
      closable={false}
      footer={drawerFooter}
      maskClosable={false}
      placement="right"
      size="large"
      title={t('label.add-entity', {
        entity: t('label.test-case'),
      })}
      {...drawerProps}
      extra={
        <Button
          className="drawer-close-icon flex-center"
          icon={<CloseIcon />}
          type="link"
          onClick={onCancel}
        />
      }
      onClose={onCancel}>
      <div className="drawer-form-content">{formContent}</div>
    </Drawer>
  );
};

export default TestCaseFormV1;
