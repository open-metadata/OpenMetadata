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
  Alert,
  Button,
  FieldProp,
  FieldTypes,
  FormField,
  FormItemLabel,
  FormItemLayout,
  FormSelectItem,
  getField,
} from '@openmetadata/ui-core-components';
import { Edit01 } from '@untitledui/icons';
import classNames from 'classnames';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { debounce, snakeCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DimensionIcon } from '../../../../assets/svg/data-observability/dimension.svg';
import { ReactComponent as ColumnIcon } from '../../../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-table-test.svg';
import {
  MAX_NAME_LENGTH,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { TEST_CASE_NAME_REGEX } from '../../../../constants/regex.constants';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import { SearchIndex } from '../../../../enums/search.enum';
import { PipelineType } from '../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { TagSource } from '../../../../generated/entity/data/container';
import { Table } from '../../../../generated/entity/data/table';
import {
  EntityType,
  TestDefinition,
  TestPlatform,
} from '../../../../generated/tests/testDefinition';
import { TableSearchSource } from '../../../../interface/search.interface';
import testCaseClassBase from '../../../../pages/IncidentManager/IncidentManagerDetailPage/TestCaseClassBase';
import { getIngestionPipelines } from '../../../../rest/ingestionPipelineAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTableDetailsByFQN } from '../../../../rest/tableAPI';
import {
  getListTestCaseBySearch,
  getListTestDefinitions,
} from '../../../../rest/testAPI';
import { getScheduleOptionsFromSchedules } from '../../../../utils/CronExpressionUtils';
import {
  convertSearchSourceToTable,
  getServiceTypeForTestDefinition,
} from '../../../../utils/DataQuality/DataQualityPureUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import RichTextEditor from '../../../common/RichTextEditor/RichTextEditor';
import SelectionCardGroup from '../../../common/SelectionCardGroup/SelectionCardGroup';
import TagSuggestion from '../../../common/TagSuggestion/TagSuggestion';
import ParameterFields from './ParameterFields';
import {
  TablesCache,
  TestCaseFormBodyProps,
  TestLevel,
  TestLevelOption,
} from './TestCaseFormV1.interface';
import TestCaseSchedulerSection from './TestCaseSchedulerSection';

const TABLE_CUSTOM_SQL_QUERY = 'tableCustomSQLQuery';
const TABLES_CACHE_MAX_SIZE = 100;

const fqnFromSelectItem = (
  value?: FormSelectItem | string | null
): string | undefined => {
  let result: string | undefined;
  if (typeof value === 'string') {
    result = value;
  } else if (value) {
    result = value.id;
  }

  return result;
};

const TestCaseFormBody: FC<TestCaseFormBodyProps> = ({
  form,
  table,
  testSuite,
  errorMessage,
  onErrorDismiss,
  onActiveFieldChange,
  onContextChange,
}: TestCaseFormBodyProps) => {
  const { t } = useTranslation();
  const { config } = useLimitStore();
  const { permissions } = usePermissionProvider();
  const { ingestionPipeline } = permissions;

  const [selectedTableData, setSelectedTableData] = useState<Table | undefined>(
    table
  );
  const [tablesCache, setTablesCache] = useState<TablesCache>(new Map());
  const [tableOptions, setTableOptions] = useState<FormSelectItem[]>([]);
  const [isTableLoading, setIsTableLoading] = useState(false);

  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [selectedTestDefinition, setSelectedTestDefinition] =
    useState<TestDefinition>();
  const [selectedTestType, setSelectedTestType] = useState<string>();
  const [currentColumnType, setCurrentColumnType] = useState<string>();
  const [isCustomQuery, setIsCustomQuery] = useState(false);

  const [existingTestCases, setExistingTestCases] = useState<string[]>([]);
  const [canCreatePipeline, setCanCreatePipeline] = useState(false);
  const [isTestNameManuallyEdited, setIsTestNameManuallyEdited] =
    useState(false);

  const testLevelFieldValue = useWatch({
    control: form.control,
    name: 'testLevel',
  });
  const selectedTableValue = useWatch({
    control: form.control,
    name: 'selectedTable',
  });
  const selectedColumnValue = useWatch({
    control: form.control,
    name: 'selectedColumn',
  });
  const testTypeValue = useWatch({
    control: form.control,
    name: 'testTypeId',
  });
  const useDynamicAssertionValue = useWatch({
    control: form.control,
    name: 'useDynamicAssertion',
  });

  const selectedTableFqn = fqnFromSelectItem(
    selectedTableValue as FormSelectItem | string | null
  );
  const selectedColumn = fqnFromSelectItem(
    selectedColumnValue as FormSelectItem | string | null
  );
  const selectedTestTypeFqn = fqnFromSelectItem(
    testTypeValue as FormSelectItem | string | null
  );

  const handleActiveField = useCallback(
    (id: string) => {
      onActiveFieldChange?.(id);
    },
    [onActiveFieldChange]
  );

  // Report the focused field to the doc panel. Rendered controls carry
  // `root/<fieldName>` ids, so one capture handler covers every field the
  // same way the legacy antd form's form-level onFocus did.
  const handleFormFocusCapture = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const fieldId = (event.target as HTMLElement).closest?.(
        '[id^="root/"]'
      )?.id;
      if (fieldId) {
        handleActiveField(fieldId);
      }
    },
    [handleActiveField]
  );

  const testLevelOptions: TestLevelOption[] = useMemo(
    () => [
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
      {
        value: TestLevel.COLUMN_DIMENSION,
        label: t('label.dimension-level'),
        description: t('label.column-with-dimension'),
        icon: <DimensionIcon />,
        isBeta: true,
      },
    ],
    [t]
  );

  const selectedTestLevel = useMemo(() => {
    let result = testLevelFieldValue;
    if (testLevelFieldValue === TestLevel.COLUMN_DIMENSION) {
      result = TestLevel.COLUMN;
    }

    return result;
  }, [testLevelFieldValue]);

  const hasTestSuite = Boolean(
    testSuite?.id || selectedTableData?.testSuite?.id
  );

  const pipelineSchedules = config?.limits?.config.featureLimits.find(
    (feature) => feature.name === 'dataQuality'
  )?.pipelineSchedules;

  const schedulerOptions = useMemo(() => {
    let result: string[] | undefined;
    if (pipelineSchedules && pipelineSchedules.length > 0) {
      result = getScheduleOptionsFromSchedules(pipelineSchedules);
    }

    return result;
  }, [pipelineSchedules]);

  const columnOptions: FormSelectItem[] = useMemo(() => {
    let result: FormSelectItem[] = [];
    if (selectedTableData?.columns) {
      result = selectedTableData.columns.map((column) => ({
        id: column.name,
        label: getEntityName(column),
      }));
    }

    return result;
  }, [selectedTableData]);

  const dimensionColumnOptions: FormSelectItem[] = useMemo(() => {
    let result = columnOptions;
    if (selectedColumn) {
      result = columnOptions.filter((option) => option.id !== selectedColumn);
    }

    return result;
  }, [columnOptions, selectedColumn]);

  const fetchTables = useCallback(
    async (searchValue = '') => {
      if (table) {
        setTableOptions([
          {
            id: table.fullyQualifiedName ?? table.name,
            label: table.fullyQualifiedName ?? table.name,
          },
        ]);

        return;
      }

      setIsTableLoading(true);
      try {
        const response = await searchQuery({
          query: searchValue ? `*${searchValue}*` : '*',
          pageNumber: 1,
          pageSize: PAGE_SIZE_MEDIUM,
          searchIndex: SearchIndex.TABLE,
          fetchSource: true,
          trackTotalHits: true,
        });

        setTablesCache((prev) => {
          const newCache = new Map(prev);
          response.hits.hits.forEach((hit) => {
            const source = hit._source as TableSearchSource;
            newCache.set(source.fullyQualifiedName ?? source.name, source);
            while (newCache.size > TABLES_CACHE_MAX_SIZE) {
              const oldestKey = newCache.keys().next().value;
              if (oldestKey === undefined) {
                break;
              }
              newCache.delete(oldestKey);
            }
          });

          return newCache;
        });

        setTableOptions(
          response.hits.hits.map((hit) => {
            const source = hit._source as TableSearchSource;

            return {
              id: source.fullyQualifiedName ?? source.name,
              label: source.fullyQualifiedName ?? source.name,
            };
          })
        );
      } catch {
        setTableOptions([]);
      } finally {
        setIsTableLoading(false);
      }
    },
    [table]
  );

  const debouncedFetchTables = useMemo(
    () => debounce(fetchTables, 500),
    [fetchTables]
  );

  useEffect(
    () => () => {
      debouncedFetchTables.cancel();
    },
    [debouncedFetchTables]
  );

  const fetchSelectedTableData = useCallback(
    async (tableFqn: string) => {
      if (table) {
        setSelectedTableData(table);

        return;
      }

      try {
        const tableData = await getTableDetailsByFQN(tableFqn, {
          fields: 'columns,testSuite',
        });
        setSelectedTableData(tableData);
      } catch {
        setSelectedTableData(undefined);
      }
    },
    [table]
  );

  const fetchTestDefinitions = useCallback(
    async (columnType?: string) => {
      try {
        const serviceType = getServiceTypeForTestDefinition(
          selectedTableData ?? table
        );

        const { data } = await getListTestDefinitions({
          limit: PAGE_SIZE_LARGE,
          entityType:
            selectedTestLevel === TestLevel.COLUMN
              ? EntityType.Column
              : EntityType.Table,
          testPlatform: TestPlatform.OpenMetadata,
          supportedDataType: columnType,
          supportedService: serviceType,
        });
        setTestDefinitions(data);
      } catch {
        setTestDefinitions([]);
      }
    },
    [selectedTestLevel, selectedTableData, table]
  );

  useEffect(() => {
    if (table?.fullyQualifiedName) {
      form.setValue('selectedTable', {
        id: table.fullyQualifiedName,
        label: table.fullyQualifiedName,
      } as never);
    }
  }, [table, form]);

  useEffect(() => {
    if (selectedTableFqn) {
      const cachedTableData = tablesCache.get(selectedTableFqn);
      if (cachedTableData) {
        setSelectedTableData(convertSearchSourceToTable(cachedTableData));
      } else {
        fetchSelectedTableData(selectedTableFqn);
      }
    } else {
      setSelectedTableData(table);
    }
    form.setValue('selectedColumn', undefined as never);
    form.setValue('dimensionColumns', undefined);
    form.setValue('topDimensions', undefined);
  }, [selectedTableFqn, table, tablesCache, fetchSelectedTableData, form]);

  useEffect(() => {
    form.setValue('dimensionColumns', undefined);
    form.setValue('topDimensions', undefined);
  }, [selectedColumn, form]);

  useEffect(() => {
    if (selectedTestLevel) {
      fetchTestDefinitions();
      form.setValue('testTypeId', undefined as never);
      setSelectedTestDefinition(undefined);
      setSelectedTestType(undefined);
      setIsCustomQuery(false);
    }
  }, [selectedTestLevel, fetchTestDefinitions, form]);

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

  useEffect(() => {
    setSelectedTestType(selectedTestTypeFqn);
    const testDefinition = testDefinitions.find(
      (definition) => definition.fullyQualifiedName === selectedTestTypeFqn
    );
    setSelectedTestDefinition(testDefinition);
  }, [selectedTestTypeFqn, testDefinitions]);

  const testTypeOptions: FormSelectItem[] = useMemo(
    () =>
      testDefinitions.map((testDef) => ({
        id: testDef.fullyQualifiedName ?? '',
        label: getEntityName(testDef),
        supportingText: testDef.description,
      })),
    [testDefinitions]
  );

  const handleCustomQueryToggle = useCallback(() => {
    if (isCustomQuery) {
      form.setValue('testTypeId', undefined as never);
      setIsCustomQuery(false);
    } else {
      form.setValue('testTypeId', {
        id: TABLE_CUSTOM_SQL_QUERY,
        label: TABLE_CUSTOM_SQL_QUERY,
      } as never);
      setIsCustomQuery(true);
    }
  }, [isCustomQuery, form]);

  const generateDynamicTestName = useCallback(() => {
    const testType = selectedTestDefinition?.name ?? '';
    let finalName = '';

    if (testType) {
      const randomString = cryptoRandomString({
        length: 4,
        type: 'alphanumeric',
      });

      let dynamicName = '';
      if (selectedTestLevel === TestLevel.TABLE) {
        const tableName =
          selectedTableData?.name ?? selectedTableFqn ?? 'table';
        dynamicName = `${tableName}_${testType}_${randomString}`;
      } else if (selectedTestLevel === TestLevel.COLUMN && selectedColumn) {
        dynamicName = `${selectedColumn}_${testType}_${randomString}`;
      }

      finalName = snakeCase(dynamicName);
      if (finalName.length > MAX_NAME_LENGTH) {
        finalName = snakeCase(`${testType}_${randomString}`);
      }
    }

    return finalName;
  }, [
    selectedTableData,
    selectedTableFqn,
    selectedColumn,
    selectedTestDefinition,
    selectedTestLevel,
  ]);

  const fetchExistingTestCases = useCallback(async () => {
    const entityFqn = selectedTableData?.fullyQualifiedName ?? selectedTableFqn;
    if (!hasTestSuite || !entityFqn) {
      setExistingTestCases([]);

      return;
    }

    try {
      const { data } = await getListTestCaseBySearch({
        limit: PAGE_SIZE_LARGE,
        entityLink: `<#E::table::${entityFqn}>`,
      });
      setExistingTestCases(data.map((testCase) => testCase.name));
    } catch {
      setExistingTestCases([]);
    }
  }, [selectedTableData, selectedTableFqn, hasTestSuite]);

  const checkExistingPipelines = useCallback(async (testSuiteFqn: string) => {
    try {
      const { paging } = await getIngestionPipelines({
        testSuite: testSuiteFqn,
        pipelineType: [PipelineType.TestSuite],
        arrQueryFields: ['id'],
        limit: 0,
      });
      setCanCreatePipeline(paging.total === 0);
    } catch {
      setCanCreatePipeline(true);
    }
  }, []);

  const isComputeRowCountFieldVisible =
    selectedTestDefinition?.supportsRowLevelPassedFailed ?? false;

  const showParameterFields =
    Boolean(selectedTestDefinition?.parameterDefinition) &&
    useDynamicAssertionValue !== true;

  useEffect(() => {
    fetchExistingTestCases();
  }, [fetchExistingTestCases]);

  useEffect(() => {
    if (!ingestionPipeline.Create || !selectedTableFqn) {
      setCanCreatePipeline(false);

      return;
    }

    const testSuiteFqn =
      selectedTableData?.testSuite?.fullyQualifiedName ??
      testSuite?.fullyQualifiedName;

    if (testSuiteFqn) {
      checkExistingPipelines(testSuiteFqn);
    } else {
      setCanCreatePipeline(true);
    }
  }, [
    selectedTableData?.testSuite?.fullyQualifiedName,
    testSuite?.fullyQualifiedName,
    selectedTableFqn,
    checkExistingPipelines,
    ingestionPipeline,
  ]);

  useEffect(() => {
    if (
      selectedTableFqn &&
      selectedTestDefinition &&
      selectedTestLevel &&
      !isTestNameManuallyEdited
    ) {
      const dynamicName = generateDynamicTestName();
      if (dynamicName) {
        form.setValue('testName', dynamicName);
      }
    }
  }, [
    selectedTableFqn,
    selectedColumn,
    selectedTestDefinition,
    selectedTestLevel,
    generateDynamicTestName,
    isTestNameManuallyEdited,
    form,
  ]);

  useEffect(() => {
    onContextChange?.({
      selectedDefinition: selectedTestDefinition,
      selectedTableData,
      selectedColumn,
      selectedTestLevel,
      generateName: generateDynamicTestName,
      canCreatePipeline,
    });
  }, [
    selectedTestDefinition,
    selectedTableData,
    selectedColumn,
    selectedTestLevel,
    generateDynamicTestName,
    canCreatePipeline,
    onContextChange,
  ]);

  const selectedTableField = {
    name: 'selectedTable',
    label: t('label.select-entity', { entity: t('label.table') }),
    type: FieldTypes.ASYNC_SELECT,
    required: true,
    rules: {
      required: t('label.please-select-entity', { entity: t('label.table') }),
    },
    id: 'root/table',
    placeholder: t('label.select-entity', { entity: t('label.table') }),
    props: {
      'data-testid': 'selectedTable',
      isDisabled: Boolean(table),
      isLoading: isTableLoading,
      options: tableOptions,
      onSearchChange: debouncedFetchTables,
      onFocus: () => {
        if (tableOptions.length === 0) {
          fetchTables();
        }
        handleActiveField('root/table');
      },
    },
  } as FieldProp;

  const selectedColumnField: FieldProp = {
    name: 'selectedColumn',
    label: t('label.select-entity', { entity: t('label.column') }),
    type: FieldTypes.SELECT,
    required: true,
    rules: {
      required: t('label.please-select-entity', { entity: t('label.column') }),
    },
    id: 'root/column',
    placeholder: t('label.select-entity', { entity: t('label.column') }),
    props: {
      'data-testid': 'selectedColumn',
      isDisabled: !selectedTableFqn,
      options: columnOptions,
    },
  };

  const dimensionColumnsField: FieldProp = {
    name: 'dimensionColumns',
    label: t('label.select-entity', { entity: t('label.dimension-plural') }),
    type: FieldTypes.MULTI_SELECT,
    id: 'root/dimensionColumns',
    placeholder: t('label.select-entity', {
      entity: t('label.dimension-plural'),
    }),
    props: {
      'data-testid': 'dimensionColumns',
      isDisabled: !selectedTableFqn,
      multiple: true,
      options: dimensionColumnOptions,
    },
  };

  const topDimensionsField = {
    name: 'topDimensions',
    label: t('label.top-dimension-plural'),
    type: FieldTypes.NUMBER,
    id: 'root/topDimensions',
    placeholder: '5',
    props: {
      'data-testid': 'topDimensions',
      min: 1,
      max: 50,
    },
  } as FieldProp;

  const testTypeField: FieldProp = {
    name: 'testTypeId',
    label: t('label.select-test-type'),
    type: FieldTypes.SELECT,
    required: true,
    rules: {
      required: t('label.select-test-type'),
    },
    id: selectedTestType ? `root/${selectedTestType}` : 'root/testType',
    placeholder: t('label.select-test-type'),
    helperText: selectedTestDefinition?.description,
    props: {
      'data-testid': 'test-type',
      popoverClassName: 'test-type-popover',
      options: testTypeOptions,
      onSelectionChange: () => handleActiveField('root/testType'),
    },
  };

  const dynamicAssertionField = {
    name: 'useDynamicAssertion',
    label: t('label.dynamic-assertion'),
    type: FieldTypes.SWITCH,
    required: false,
    id: 'root/useDynamicAssertion',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'use-dynamic-assertion',
    },
  } as FieldProp;

  const computeRowCountField = {
    name: 'computePassedFailedRowCount',
    label: t('label.compute-row-count'),
    type: FieldTypes.SWITCH,
    required: false,
    helperText: t('message.compute-row-count-helper-text'),
    id: 'root/computePassedFailedRowCount',
    formItemLayout: FormItemLayout.HORIZONTAL,
    props: {
      'data-testid': 'compute-passed-failed-row-count',
    },
  } as FieldProp;

  const additionalFields = testCaseClassBase.createFormAdditionalFields(
    selectedTestDefinition?.supportsDynamicAssertion ?? false
  );

  const testNameField: FieldProp = {
    name: 'testName',
    label: t('label.name'),
    type: FieldTypes.TEXT,
    required: false,
    id: 'root/name',
    placeholder: t('message.enter-test-case-name'),
    rules: {
      pattern: {
        value: TEST_CASE_NAME_REGEX,
        message: t('message.test-case-name-validation'),
      },
      maxLength: {
        value: MAX_NAME_LENGTH,
        message: t('message.entity-maximum-size', {
          entity: t('label.name'),
          max: MAX_NAME_LENGTH,
        }),
      },
      validate: (value: string) => {
        let result: string | boolean = true;
        if (value && existingTestCases.includes(value)) {
          result = t('message.entity-already-exists', {
            entity: t('label.name'),
          });
        }

        return result;
      },
    },
    props: {
      'data-testid': 'test-case-name',
      onChange: () => setIsTestNameManuallyEdited(true),
    },
  };

  return (
    <div
      className="test-case-form-v1 drawer-mode test-case-form-body"
      onFocusCapture={handleFormFocusCapture}>
      {errorMessage && (
        <div className="floating-error-alert">
          <Alert
            closable
            title={t('label.error')}
            variant="error"
            onClose={onErrorDismiss}>
            {errorMessage}
          </Alert>
        </div>
      )}

      <div className="form-card-section" data-testid="select-table-card">
        <FormField control={form.control} name="testLevel">
          {({ field }) => (
            <>
              <FormItemLabel required label={t('message.select-test-level')} />
              <SelectionCardGroup
                options={testLevelOptions}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  handleActiveField('root/testLevel');
                }}
              />
            </>
          )}
        </FormField>

        {getField(selectedTableField)}

        {selectedTestLevel === TestLevel.COLUMN &&
          getField(selectedColumnField)}

        {testLevelFieldValue === TestLevel.COLUMN_DIMENSION &&
          getField(dimensionColumnsField)}

        {testLevelFieldValue === TestLevel.COLUMN_DIMENSION &&
          getField(topDimensionsField)}
      </div>

      <div
        className="form-card-section test-type-card test-type-section"
        data-testid="test-type-card">
        {selectedTestLevel === TestLevel.TABLE && (
          <div
            className={classNames(
              'custom-test-type-container d-flex items-center',
              isCustomQuery ? 'justify-between' : 'justify-end'
            )}>
            {isCustomQuery && <FormItemLabel label={t('label.test-type')} />}
            <Button
              color="link-color"
              data-testid={isCustomQuery ? 'test-type-btn' : 'custom-query'}
              iconLeading={Edit01}
              size="sm"
              onClick={handleCustomQueryToggle}>
              {isCustomQuery
                ? t('label.select-test-type')
                : t('label.custom-query')}
            </Button>
          </div>
        )}

        {!isCustomQuery && getField(testTypeField)}

        {additionalFields.length === 0 &&
          selectedTestDefinition?.supportsDynamicAssertion &&
          getField(dynamicAssertionField)}

        {showParameterFields && selectedTestDefinition && (
          <ParameterFields
            definition={selectedTestDefinition}
            form={form}
            table={selectedTableData}
          />
        )}

        {isComputeRowCountFieldVisible && getField(computeRowCountField)}
      </div>

      <div
        className="form-card-section test-details-section"
        data-testid="test-details-card">
        {getField(testNameField)}

        <FormField control={form.control} name="description">
          {({ field }) => (
            <div data-testid="description" id="root/description">
              <FormItemLabel label={t('label.description')} />
              <RichTextEditor
                initialValue={field.value ?? ''}
                onFocus={() => handleActiveField('root/description')}
                onTextChange={field.onChange}
              />
            </div>
          )}
        </FormField>

        <FormField control={form.control} name="tags">
          {({ field }) => (
            <div data-testid="tags-selector" id="root/tags">
              <TagSuggestion
                label={t('label.tag-plural')}
                placeholder={t('label.select-field', {
                  field: t('label.tag-plural'),
                })}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            </div>
          )}
        </FormField>

        <FormField control={form.control} name="glossaryTerms">
          {({ field }) => (
            <div data-testid="glossary-terms-selector" id="root/glossaryTerms">
              <TagSuggestion
                label={t('label.glossary-term-plural')}
                placeholder={t('label.select-field', {
                  field: t('label.glossary-term-plural'),
                })}
                tagType={TagSource.Glossary}
                value={field.value ?? []}
                onChange={field.onChange}
              />
            </div>
          )}
        </FormField>
      </div>

      {selectedTableFqn && canCreatePipeline && (
        <TestCaseSchedulerSection
          canCreatePipeline={canCreatePipeline}
          form={form}
          hasTestSuite={hasTestSuite}
          schedulerOptions={schedulerOptions}
          selectedTableData={selectedTableData}
          table={table}
          testSuite={testSuite}
          onActiveFieldChange={onActiveFieldChange}
        />
      )}
    </div>
  );
};

export default TestCaseFormBody;
