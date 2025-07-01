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
import { Card, Drawer, DrawerProps, Form, Select, Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { ReactComponent as ColumnIcon } from '../../../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-format-table.svg';
import {
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../../../constants/constants';
import { SearchIndex } from '../../../../enums/search.enum';
import { Table } from '../../../../generated/entity/data/table';
import {
  EntityType,
  TestDefinition,
  TestPlatform,
} from '../../../../generated/tests/testDefinition';
import { TableSearchSource } from '../../../../interface/search.interface';
import { searchQuery } from '../../../../rest/searchAPI';
import { getTableDetailsByFQN } from '../../../../rest/tableAPI';
import { getListTestDefinitions } from '../../../../rest/testAPI';
import { filterSelectOptions } from '../../../../utils/CommonUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { AsyncSelect } from '../../../common/AsyncSelect/AsyncSelect';
import SelectionCardGroup from '../../../common/SelectionCardGroup/SelectionCardGroup';
import { SelectionOption } from '../../../common/SelectionCardGroup/SelectionCardGroup.interface';
import ParameterForm from './ParameterForm';
import './TestCaseFormV1.less';

export interface TestCaseFormV1Props {
  isDrawer?: boolean;
  drawerProps?: DrawerProps;
  className?: string;
  table?: Table;
  onFormSubmit?: (values: FormValues) => void;
  initialValues?: Partial<FormValues>;
}

interface FormValues {
  testLevel: TestLevel;
  selectedTable?: string;
  selectedColumn?: string;
  testTypeId?: string;
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

/**
 * TestCaseFormV1 - An improved form component for creating test cases
 *
 * Features:
 * - Progressive test level selection (Table/Column)
 * - Smart table caching with column data
 * - Dynamic test type filtering based on column data types
 * - Efficient column selection without additional API calls
 * - Dynamic parameter form rendering based on selected test definition
 */
const TestCaseFormV1: FC<TestCaseFormV1Props> = ({
  className,
  drawerProps,
  initialValues,
  isDrawer = false,
  table,
  onFormSubmit,
}) => {
  const [form] = useForm<FormValues>();
  const [testDefinitions, setTestDefinitions] = useState<TestDefinition[]>([]);
  const [selectedTestDefinition, setSelectedTestDefinition] =
    useState<TestDefinition>();
  const [currentColumnType, setCurrentColumnType] = useState<string>();
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedTableData, setSelectedTableData] = useState<Table | undefined>(
    table
  );
  const [tablesCache, setTablesCache] = useState<TablesCache>(new Map());
  const selectedTestLevel = Form.useWatch('testLevel', form);
  const selectedTable = Form.useWatch('selectedTable', form);
  const selectedColumn = Form.useWatch('selectedColumn', form);
  const selectedTestType = Form.useWatch('testTypeId', form);

  const handleSubmit = (values: FormValues) => {
    onFormSubmit?.(values);
  };

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

  // Initialize form with default values
  useEffect(() => {
    if (!isInitialized) {
      form.setFieldsValue({ testLevel: TestLevel.TABLE });
      setIsInitialized(true);
    }
  }, [form, isInitialized]);

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
    if (selectedTestDefinition?.parameterDefinition) {
      return (
        <ParameterForm
          definition={selectedTestDefinition}
          table={selectedTableData}
        />
      );
    }

    return null;
  }, [selectedTestDefinition, selectedTableData]);

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
        form={form}
        initialValues={initialValues}
        layout="vertical"
        onFinish={handleSubmit}>
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
              size="large"
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
                size="large"
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
              size="large"
              onChange={handleTestDefinitionChange}
            />
          </Form.Item>

          {selectedTestDefinition && generateParamsField}
        </Card>
      </Form>
    </div>
  );

  if (isDrawer) {
    return (
      <Drawer
        destroyOnClose
        open
        placement="right"
        size="large"
        {...drawerProps}>
        {formContent}
      </Drawer>
    );
  }

  return formContent;
};

export default TestCaseFormV1;
