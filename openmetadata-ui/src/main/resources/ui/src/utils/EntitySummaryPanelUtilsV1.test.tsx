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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { EntityType } from '../enums/entity.enum';
import {
  Container,
  DataType as ContainerDataType,
} from '../generated/entity/data/container';
import {
  DataType as SearchIndexDataType,
  SearchIndex,
  SearchIndexField,
} from '../generated/entity/data/searchIndex';
import {
  Column,
  Table as TableEntity,
  TableType,
} from '../generated/entity/data/table';
import { Topic } from '../generated/entity/data/topic';
import { DataType } from '../generated/settings/settings';
import { DataTypeTopic, Field } from '../generated/type/schema';
import { getEntityChildDetailsV1 } from './EntitySummaryPanelUtilsV1';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'label.show-nested') {
        return 'Show Nested';
      }
      if (key === 'label.show-less') {
        return 'label.show-less';
      }
      if (key === 'message.no-data-available') {
        return 'message.no-data-available';
      }
      if (key === 'label.show-more') {
        return 'Show More';
      }
      if (key === 'message.no-entity-found-for-name') {
        return `No ${options?.entity} found for ${options?.name}`;
      }

      return key;
    },
  }),
}));

jest.mock('../rest/tableAPI', () => ({
  getTableColumnsByFQN: jest.fn(),
  searchTableColumnsByFQN: jest.fn(),
  getTableList: jest.fn(),
}));

jest.mock('../rest/dataModelsAPI', () => ({
  getDataModelColumnsByFQN: jest.fn(),
}));

jest.mock('../components/common/FieldCard', () => ({
  FieldCard: jest.fn(({ fieldName, dataType, description }) => (
    <div data-testid={`field-card-${fieldName}`}>
      <div data-testid={`field-name-${fieldName}`}>{fieldName}</div>
      <div data-testid={`field-type-${fieldName}`}>{dataType}</div>
      <div data-testid={`field-description-${fieldName}`}>{description}</div>
    </div>
  )),
}));

jest.mock('../components/common/Loader/Loader', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="loader">Loading...</div>),
}));

jest.mock('../utils/TableUtils', () => ({
  ...jest.requireActual('../utils/TableUtils'),
  pruneEmptyChildren: jest.fn((columns) => columns),
}));

jest.mock('../assets/svg/nested.svg', () => ({
  ReactComponent: jest.fn(() => (
    <div data-testid="nested-icon">Nested Icon</div>
  )),
}));

const { getTableColumnsByFQN, searchTableColumnsByFQN } =
  jest.requireMock('../rest/tableAPI');

const mockColumnsWithNested: Column[] = [
  {
    name: 'column_0001',
    dataType: DataType.Varchar,
    description: 'Simple column without children',
    fullyQualifiedName: 'test.table.column_0001',
    tags: [],
  },
  {
    name: 'nested_struct_01',
    dataType: DataType.Struct,
    description: 'Nested structure 1 containing customer/order/product data',
    fullyQualifiedName: 'test.table.nested_struct_01',
    tags: [],
    children: [
      {
        name: 'customer_id',
        dataType: DataType.Varchar,
        description: 'Customer ID',
        fullyQualifiedName: 'test.table.nested_struct_01.customer_id',
        tags: [],
      },
      {
        name: 'order_data',
        dataType: DataType.Struct,
        description: 'Order information',
        fullyQualifiedName: 'test.table.nested_struct_01.order_data',
        tags: [],
        children: [
          {
            name: 'order_id',
            dataType: DataType.Varchar,
            description: 'Order ID',
            fullyQualifiedName:
              'test.table.nested_struct_01.order_data.order_id',
            tags: [],
          },
          {
            name: 'order_date',
            dataType: DataType.Date,
            description: 'Order date',
            fullyQualifiedName:
              'test.table.nested_struct_01.order_data.order_date',
            tags: [],
          },
        ],
      },
      {
        name: 'product_name',
        dataType: DataType.Varchar,
        description: 'Product name',
        fullyQualifiedName: 'test.table.nested_struct_01.product_name',
        tags: [],
      },
    ],
  },
  {
    name: 'deeply_nested_data',
    dataType: DataType.Struct,
    description: 'Deeply nested structure for testing recursive search',
    fullyQualifiedName: 'test.table.deeply_nested_data',
    tags: [],
    children: [
      {
        name: 'level_1',
        dataType: DataType.Struct,
        description: 'Level 1 nested data',
        fullyQualifiedName: 'test.table.deeply_nested_data.level_1',
        tags: [],
        children: [
          {
            name: 'level_2',
            dataType: DataType.Varchar,
            description: 'Level 2 data',
            fullyQualifiedName: 'test.table.deeply_nested_data.level_1.level_2',
            tags: [],
          },
        ],
      },
    ],
  },
];

const mockEntityInfo: TableEntity = {
  id: 'test-table-id',
  name: 'test_table',
  fullyQualifiedName: 'test.database.schema.test_table',
  tableType: TableType.Regular,
  columns: mockColumnsWithNested,
};

describe('EntitySummaryPanelUtilsV1 - Nested Columns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getTableColumnsByFQN.mockResolvedValue({
      data: mockColumnsWithNested,
      paging: { total: mockColumnsWithNested.length, offset: 0 },
    });
  });

  describe('getEntityChildDetailsV1 - Table with nested columns', () => {
    it('should render schema field cards for table entity', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        true,
        ''
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });
  });

  describe('Nested Column Rendering', () => {
    it('should render all top-level columns', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the field cards to appear
      await waitFor(() => {
        expect(
          screen.getByTestId('field-card-column_0001')
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('field-card-nested_struct_01')
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('field-card-deeply_nested_data')
        ).toBeInTheDocument();
      });
    });

    it('should show "Show Nested" button for columns with children', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the buttons to appear
      await waitFor(() => {
        const showNestedButtons = screen.getAllByText(/label.show-nested/);

        expect(showNestedButtons).toHaveLength(2);
      });
    });

    it('should display correct count of nested children in button', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the buttons with counts to appear
      await waitFor(() => {
        expect(screen.getByText('label.show-nested (3)')).toBeInTheDocument();
        expect(screen.getByText('label.show-nested (1)')).toBeInTheDocument();
      });
    });

    it('should not show "Show Nested" button for columns without children', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the field card to appear
      await waitFor(() => {
        expect(
          screen.getByTestId('field-card-column_0001')
        ).toBeInTheDocument();
      });

      const simpleColumnCard = screen.getByTestId('field-card-column_0001')
        .parentElement?.parentElement;

      expect(simpleColumnCard).not.toHaveTextContent('Show Nested');
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should expand nested columns when "Show Nested" is clicked', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the button to appear
      await waitFor(() => {
        expect(screen.getByText('label.show-nested (3)')).toBeInTheDocument();
      });

      const showNestedButton = screen.getByText('label.show-nested (3)');

      await act(async () => {
        fireEvent.click(showNestedButton);
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('field-card-customer_id')
        ).toBeInTheDocument();
        expect(screen.getByTestId('field-card-order_data')).toBeInTheDocument();
        expect(
          screen.getByTestId('field-card-product_name')
        ).toBeInTheDocument();
      });
    });

    it('should show "Show Less" button when nested columns are expanded', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the button to appear
      await waitFor(() => {
        expect(screen.getByText('label.show-nested (3)')).toBeInTheDocument();
      });

      const showNestedButton = screen.getByText('label.show-nested (3)');

      await act(async () => {
        fireEvent.click(showNestedButton);
      });

      await waitFor(() => {
        expect(screen.getByText('label.show-less')).toBeInTheDocument();
      });
    });

    it('should collapse nested columns when "Show Less" is clicked', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the button to appear
      await waitFor(() => {
        expect(screen.getByText('label.show-nested (3)')).toBeInTheDocument();
      });

      const showNestedButton = screen.getByText('label.show-nested (3)');

      await act(async () => {
        fireEvent.click(showNestedButton);
      });

      await waitFor(() => {
        expect(screen.getByText('label.show-less')).toBeInTheDocument();
      });

      const showLessButton = screen.getByText('label.show-less');

      await act(async () => {
        fireEvent.click(showLessButton);
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId('field-card-customer_id')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByTestId('field-card-order_data')
        ).not.toBeInTheDocument();
      });
    });

    it('should handle deeply nested columns correctly', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the button to appear
      await waitFor(() => {
        expect(screen.getByText('label.show-nested (1)')).toBeInTheDocument();
      });

      const firstLevelButton = screen.getByText('label.show-nested (1)');

      await act(async () => {
        fireEvent.click(firstLevelButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('field-card-level_1')).toBeInTheDocument();
      });

      const secondLevelButtons = screen.getAllByText('label.show-nested (1)');

      expect(secondLevelButtons.length).toBeGreaterThan(0);

      await act(async () => {
        fireEvent.click(secondLevelButtons[0]);
      });

      await waitFor(() => {
        expect(screen.getByTestId('field-card-level_2')).toBeInTheDocument();
      });
    });
  });

  describe('Nested Column Indentation', () => {
    it('should apply correct indentation for nested levels', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the button to appear
      await waitFor(() => {
        expect(screen.getByText('label.show-nested (3)')).toBeInTheDocument();
      });

      const showNestedButton = screen.getByText('label.show-nested (3)');

      await act(async () => {
        fireEvent.click(showNestedButton);
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('field-card-customer_id')
        ).toBeInTheDocument();
      });

      const nestedWrappers = container.querySelectorAll(
        '.nested-field-card-wrapper'
      );

      const hasIndentation = Array.from(nestedWrappers).some((wrapper) => {
        const style = (wrapper as HTMLElement).style.paddingLeft;

        return style === '24px';
      });

      expect(hasIndentation).toBe(true);
    });
  });

  describe('Search Functionality with Nested Columns', () => {
    it('should search through nested columns', async () => {
      searchTableColumnsByFQN.mockResolvedValue({
        data: [mockColumnsWithNested[1]],
        paging: { total: 1, offset: 0 },
      });

      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        'nested_struct'
      );

      render(<div>{result}</div>);

      await waitFor(() => {
        expect(searchTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            q: 'nested_struct',
          })
        );
      });
    });
  });

  describe('Nested Icon Display', () => {
    it('should show nested icon when columns with children are collapsed', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the nested icons to appear
      await waitFor(() => {
        const nestedIcons = screen.getAllByTestId('nested-icon');

        expect(nestedIcons).toHaveLength(2);
      });
    });

    it('should hide nested icon when column is expanded', async () => {
      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the button to appear
      await waitFor(() => {
        expect(screen.getByText('label.show-nested (3)')).toBeInTheDocument();
      });

      const nestedIconsBefore = screen.getAllByTestId('nested-icon');

      expect(nestedIconsBefore).toHaveLength(2);

      const showNestedButton = screen.getByText('label.show-nested (3)');

      await act(async () => {
        fireEvent.click(showNestedButton);
      });

      await waitFor(() => {
        const nestedIconsAfter = screen.queryAllByTestId('nested-icon');

        expect(nestedIconsAfter.length).toBeGreaterThan(0);
        expect(nestedIconsAfter.length).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('Empty State', () => {
    it('should show no data message when no columns are returned', async () => {
      // Override the beforeEach mock to return empty data
      // Include limit to match PAGE_SIZE_LARGE (50) to avoid dependency issues
      getTableColumnsByFQN.mockClear();
      getTableColumnsByFQN.mockResolvedValue({
        data: [],
        paging: { total: 0, offset: 0, limit: 50 },
      });

      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      render(<div>{result}</div>);

      // Wait for the API call to be made
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the no-data message to appear
      // Using findByText which automatically waits and handles async state updates
      const noDataMessage = await screen.findByText(
        'message.no-data-available',
        {},
        { timeout: 10000 }
      );

      expect(noDataMessage).toBeInTheDocument();
      // Verify loader is gone
      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });
  });

  describe('Pagination with Nested Columns', () => {
    it('should show load more button when there are more columns', async () => {
      // Reset and set up the mock to return data with pagination info
      getTableColumnsByFQN.mockReset();
      getTableColumnsByFQN.mockResolvedValue({
        data: mockColumnsWithNested,
        paging: { total: 200, offset: 0 },
      });

      const result = getEntityChildDetailsV1(
        EntityType.TABLE,
        mockEntityInfo,
        undefined,
        false,
        ''
      );

      const { container } = render(<div>{result}</div>);

      // Wait for the API call to complete first
      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          mockEntityInfo.fullyQualifiedName,
          expect.objectContaining({
            offset: 0,
            fields: 'tags,customMetrics,description,extension',
          })
        );
      });

      // Wait for the loader to disappear, indicating the component has finished loading
      await waitFor(
        () => {
          expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      // Wait for the container to appear
      await waitFor(() => {
        expect(
          container.querySelector('.schema-field-cards-container')
        ).toBeInTheDocument();
      });

      // Then wait for the load more button to appear
      await waitFor(() => {
        expect(screen.getByText('label.show-more')).toBeInTheDocument();
      });
    });
  });
});

describe('EntitySummaryPanelUtilsV1 - Nested Search (Topic, Container, SearchIndex)', () => {
  const mockTopicWithNestedFields: Topic = {
    id: 'topic-id',
    name: 'test_topic',
    fullyQualifiedName: 'service.test_topic',
    messageSchema: {
      schemaFields: [
        {
          name: 'top_level_field',
          dataType: DataTypeTopic.String,
          description: 'A top-level field',
        } as Field,
        {
          name: 'parent_record',
          dataType: DataTypeTopic.Record,
          description: 'A record with nested children',
          children: [
            {
              name: 'nested_child_field',
              dataType: DataTypeTopic.String,
              description: 'A nested child',
            } as Field,
            {
              name: 'another_child',
              dataType: DataTypeTopic.Int,
              description: 'Another nested child',
              children: [
                {
                  name: 'deeply_nested',
                  dataType: DataTypeTopic.String,
                  description: 'Deeply nested field',
                } as Field,
              ],
            } as Field,
          ],
        } as Field,
      ],
    },
  } as Topic;

  const mockContainerWithNestedColumns: Container = {
    id: 'container-id',
    name: 'test_container',
    fullyQualifiedName: 'service.test_container',
    dataModel: {
      columns: [
        {
          name: 'top_column',
          dataType: ContainerDataType.String,
          description: 'Top-level column',
        },
        {
          name: 'struct_column',
          dataType: ContainerDataType.Struct,
          description: 'Struct column with children',
          children: [
            {
              name: 'nested_column_child',
              dataType: ContainerDataType.String,
              description: 'Nested column child',
            },
            {
              name: 'deep_parent',
              dataType: ContainerDataType.Struct,
              description: 'Deep parent',
              children: [
                {
                  name: 'deeply_nested_column',
                  dataType: ContainerDataType.String,
                  description: 'Deeply nested column',
                },
              ],
            },
          ],
        },
      ],
    },
  } as Container;

  const mockSearchIndexWithNestedFields: SearchIndex = {
    id: 'search-index-id',
    name: 'test_search_index',
    fullyQualifiedName: 'service.test_search_index',
    fields: [
      {
        name: 'top_si_field',
        dataType: SearchIndexDataType.Text,
        description: 'Top-level search index field',
      } as SearchIndexField,
      {
        name: 'nested_si_parent',
        dataType: SearchIndexDataType.Object,
        description: 'Parent with nested children',
        children: [
          {
            name: 'nested_si_child',
            dataType: SearchIndexDataType.Keyword,
            description: 'Nested search index child',
          } as SearchIndexField,
          {
            name: 'si_deep_parent',
            dataType: SearchIndexDataType.Object,
            description: 'Deep parent',
            children: [
              {
                name: 'deeply_nested_si_field',
                dataType: SearchIndexDataType.Text,
                description: 'Deeply nested search index field',
              } as SearchIndexField,
            ],
          } as SearchIndexField,
        ],
      } as SearchIndexField,
    ],
  } as SearchIndex;

  describe('TopicFieldCardsV1 - recursive nested field search', () => {
    it('should render all top-level fields when no search text is provided', () => {
      const result = getEntityChildDetailsV1(
        EntityType.TOPIC,
        mockTopicWithNestedFields,
        undefined,
        false,
        ''
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-top_level_field')).toBeInTheDocument();
      expect(screen.getByTestId('field-card-parent_record')).toBeInTheDocument();
    });

    it('should find top-level field by name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.TOPIC,
        mockTopicWithNestedFields,
        undefined,
        false,
        'top_level'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-top_level_field')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-parent_record')).not.toBeInTheDocument();
    });

    it('should find nested child field when searching by nested name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.TOPIC,
        mockTopicWithNestedFields,
        undefined,
        false,
        'nested_child_field'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-nested_child_field')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-top_level_field')).not.toBeInTheDocument();
      expect(screen.queryByTestId('field-card-parent_record')).not.toBeInTheDocument();
    });

    it('should find deeply nested field when searching by its name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.TOPIC,
        mockTopicWithNestedFields,
        undefined,
        false,
        'deeply_nested'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-deeply_nested')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-top_level_field')).not.toBeInTheDocument();
    });

    it('should show no-data when search text matches nothing', () => {
      const result = getEntityChildDetailsV1(
        EntityType.TOPIC,
        mockTopicWithNestedFields,
        undefined,
        false,
        'nonexistent_field_xyz'
      );

      render(<div>{result}</div>);

      expect(screen.getByText('message.no-data-available')).toBeInTheDocument();
    });
  });

  describe('ContainerFieldCardsV1 - recursive nested column search', () => {
    it('should render all top-level columns when no search text is provided', () => {
      const result = getEntityChildDetailsV1(
        EntityType.CONTAINER,
        mockContainerWithNestedColumns,
        undefined,
        false,
        ''
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-top_column')).toBeInTheDocument();
      expect(screen.getByTestId('field-card-struct_column')).toBeInTheDocument();
    });

    it('should find top-level column by name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.CONTAINER,
        mockContainerWithNestedColumns,
        undefined,
        false,
        'top_column'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-top_column')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-struct_column')).not.toBeInTheDocument();
    });

    it('should find nested child column when searching by nested name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.CONTAINER,
        mockContainerWithNestedColumns,
        undefined,
        false,
        'nested_column_child'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-nested_column_child')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-top_column')).not.toBeInTheDocument();
      expect(screen.queryByTestId('field-card-struct_column')).not.toBeInTheDocument();
    });

    it('should find deeply nested column when searching by its name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.CONTAINER,
        mockContainerWithNestedColumns,
        undefined,
        false,
        'deeply_nested_column'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-deeply_nested_column')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-top_column')).not.toBeInTheDocument();
    });

    it('should show no-data when search text matches nothing', () => {
      const result = getEntityChildDetailsV1(
        EntityType.CONTAINER,
        mockContainerWithNestedColumns,
        undefined,
        false,
        'nonexistent_column_xyz'
      );

      render(<div>{result}</div>);

      expect(
        screen.getByText('message.no-data-available')
      ).toBeInTheDocument();
    });
  });

  describe('SearchIndexFieldCardsV1 - recursive nested field search', () => {
    it('should render all top-level fields when no search text is provided', () => {
      const result = getEntityChildDetailsV1(
        EntityType.SEARCH_INDEX,
        mockSearchIndexWithNestedFields,
        undefined,
        false,
        ''
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-top_si_field')).toBeInTheDocument();
      expect(screen.getByTestId('field-card-nested_si_parent')).toBeInTheDocument();
    });

    it('should find top-level field by name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.SEARCH_INDEX,
        mockSearchIndexWithNestedFields,
        undefined,
        false,
        'top_si_field'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-top_si_field')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-nested_si_parent')).not.toBeInTheDocument();
    });

    it('should find nested child field when searching by nested name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.SEARCH_INDEX,
        mockSearchIndexWithNestedFields,
        undefined,
        false,
        'nested_si_child'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-nested_si_child')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-top_si_field')).not.toBeInTheDocument();
      expect(screen.queryByTestId('field-card-nested_si_parent')).not.toBeInTheDocument();
    });

    it('should find deeply nested field when searching by its name', () => {
      const result = getEntityChildDetailsV1(
        EntityType.SEARCH_INDEX,
        mockSearchIndexWithNestedFields,
        undefined,
        false,
        'deeply_nested_si_field'
      );

      render(<div>{result}</div>);

      expect(screen.getByTestId('field-card-deeply_nested_si_field')).toBeInTheDocument();
      expect(screen.queryByTestId('field-card-top_si_field')).not.toBeInTheDocument();
    });

    it('should show no-data when search text matches nothing', () => {
      const result = getEntityChildDetailsV1(
        EntityType.SEARCH_INDEX,
        mockSearchIndexWithNestedFields,
        undefined,
        false,
        'nonexistent_si_field_xyz'
      );

      render(<div>{result}</div>);

      expect(
        screen.getByText('message.no-data-available')
      ).toBeInTheDocument();
    });
  });
});
