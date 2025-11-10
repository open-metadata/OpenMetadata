/* eslint-disable @typescript-eslint/no-explicit-any */
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
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Column } from '../../../generated/entity/data/table';
import { useFqn } from '../../../hooks/useFqn';
import { mockTableData } from '../../../mocks/TableVersion.mock';
import { getTableColumnsByFQN } from '../../../rest/tableAPI';
import { ContractSchemaFormTab } from './ContractScehmaFormTab';

jest.mock('../../../rest/tableAPI', () => ({
  getTableColumnsByFQN: jest.fn(),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    fqn: 'service.database.schema.table',
  })),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    currentPage: 1,
    pageSize: 15,
    paging: { total: 100 },
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    handlePagingChange: jest.fn(),
    showPagination: true,
  })),
}));

jest.mock('../../../utils/TableUtils', () => ({
  pruneEmptyChildren: jest.fn().mockImplementation((columns) => columns),
  getTableExpandableConfig: jest.fn(),
  getAllRowKeysByKeyName: jest.fn(),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: mockTableData,
  })),
}));

jest.mock('../../common/Table/Table', () => {
  return function MockTable({
    columns,
    dataSource,
    loading,
    rowSelection,
    rowKey,
    pagination,
  }: any) {
    return (
      <div data-testid="mock-table">
        <div>Loading: {loading ? 'true' : 'false'}</div>
        <div>Row Selection: {rowSelection ? 'enabled' : 'disabled'}</div>
        <div>Data Source Length: {dataSource?.length || 0}</div>
        <div>Columns: {columns?.length || 0}</div>
        <div>Pagination: {pagination ? 'enabled' : 'disabled'}</div>
        {dataSource?.map((item: any) => (
          <div data-testid={`table-row-${item.name}`} key={item[rowKey]}>
            <span>{item.name}</span>
            <button
              data-testid={`select-row-${item.name}`}
              onClick={() =>
                rowSelection?.onChange?.([item.fullyQualifiedName])
              }>
              Select {item.name}
            </button>
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('../../Database/TableTags/TableTags.component', () => {
  return function MockTableTags({ tags }: any) {
    return (
      <div data-testid="table-tags">
        {tags?.map((tag: any) => (
          <span data-testid={`tag-${tag.tagFQN}`} key={tag.tagFQN}>
            {tag.tagFQN}
          </span>
        ))}
      </div>
    );
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'label.schema': 'Schema',
        'message.schema-description': 'Select schema columns',
        'label.name': 'Name',
        'label.type': 'Type',
        'label.description': 'Description',
        'label.tag-plural': 'Tags',
        'label.constraint': 'Constraint',
        'label.previous': 'Previous',
        'label.next': 'Next',
        'message.no-data-available': 'No data available',
      };

      return translations[key] || key;
    },
  }),
}));

const mockColumns: Column[] = [
  {
    name: 'id',
    dataType: 'BIGINT' as any,
    description: 'Primary key',
    tags: [{ tagFQN: 'PII.Sensitive' }] as any,
    constraint: 'PRIMARY_KEY' as any,
    fullyQualifiedName: 'service.database.schema.table.id',
  },
  {
    name: 'name',
    dataType: 'VARCHAR' as any,
    description: 'User name',
    tags: [{ tagFQN: 'PersonalData.Personal' }] as any,
    fullyQualifiedName: 'service.database.schema.table.name',
  },
  {
    name: 'email',
    dataType: 'VARCHAR' as any,
    description: 'User email',
    tags: [] as any,
    fullyQualifiedName: 'service.database.schema.table.email',
  },
] as any;

const mockOnChange = jest.fn();
const mockOnNext = jest.fn();
const mockOnPrev = jest.fn();

const commonProps = {
  onChange: mockOnChange,
  onPrev: mockOnPrev,
  onNext: mockOnNext,
  buttonProps: {
    nextLabel: 'Next',
    prevLabel: 'Previous',
    isNextVisible: true,
  },
};

describe('ContractSchemaFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getTableColumnsByFQN as jest.Mock).mockResolvedValue({
      data: mockColumns,
      paging: { total: mockColumns.length },
    });
  });

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      expect(screen.getByText('Schema')).toBeInTheDocument();
      expect(
        screen.getByText('message.data-contract-schema-description')
      ).toBeInTheDocument();
      expect(screen.getByTestId('mock-table')).toBeInTheDocument();
    });

    it('should render with selected schema columns', () => {
      render(
        <ContractSchemaFormTab
          selectedSchema={[mockColumns[0], mockColumns[1]]}
          {...commonProps}
        />
      );

      expect(screen.getByTestId('mock-table')).toBeInTheDocument();
    });

    it('should render with custom labels', () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });
  });

  describe('Column Selection', () => {
    it('should handle column selection', async () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      expect(getTableColumnsByFQN).toHaveBeenCalled();

      expect(await screen.findByTestId('select-row-id')).toBeInTheDocument();

      const selectButton = screen.getByTestId('select-row-id');

      await act(async () => {
        fireEvent.click(selectButton);
      });

      expect(mockOnChange).toHaveBeenCalledWith({
        schema: expect.arrayContaining([
          expect.objectContaining({ name: 'id' }),
        ]),
      });
    });

    it('should display selected rows in table', async () => {
      render(
        <ContractSchemaFormTab
          selectedSchema={[mockColumns[0]]}
          {...commonProps}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Row Selection: enabled')).toBeInTheDocument();
      });
    });

    it('should handle multiple column selection', async () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-row-id')).toBeInTheDocument();
      });

      const selectIdButton = screen.getByTestId('select-row-id');
      const selectNameButton = screen.getByTestId('select-row-name');

      await act(async () => {
        fireEvent.click(selectIdButton);
        fireEvent.click(selectNameButton);
      });

      expect(mockOnChange).toHaveBeenCalledWith({
        schema: expect.arrayContaining([
          expect.objectContaining({ name: 'id' }),
        ]),
      });
    });
  });

  describe('Table Rendering', () => {
    it('should display columns in table', async () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      await waitFor(() => {
        expect(screen.getByText('Data Source Length: 3')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-row-id')).toBeInTheDocument();
      expect(screen.getByTestId('table-row-name')).toBeInTheDocument();
      expect(screen.getByTestId('table-row-email')).toBeInTheDocument();
    });

    it('should handle empty columns data', async () => {
      (getTableColumnsByFQN as jest.Mock).mockResolvedValueOnce({
        columns: [],
        paging: { total: 0 },
      });

      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      await waitFor(() => {
        expect(screen.getByText('Data Source Length: 0')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should display navigation buttons', () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    it('should call onNext when next button is clicked', () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);

      expect(mockOnNext).toHaveBeenCalled();
    });

    it('should call onPrev when previous button is clicked', () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      const prevButton = screen.getByText('Previous');
      fireEvent.click(prevButton);

      expect(mockOnPrev).toHaveBeenCalled();
    });
  });

  describe('Table Columns Configuration', () => {
    it('should configure table columns correctly', async () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      await waitFor(() => {
        // Check that table is rendered with correct columns
        expect(screen.getByText('Columns: 4')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty table FQN', () => {
      const mockUseFqn = jest.requireMock('../../../hooks/useFqn').useFqn;
      mockUseFqn.mockReturnValueOnce({ fqn: '' });

      expect(() => {
        render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles and attributes', () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      const nextButton = screen.getByText('Next');
      const prevButton = screen.getByText('Previous');

      expect(nextButton).toBeInTheDocument();
      expect(prevButton).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch table columns on component mount', async () => {
      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      await waitFor(() => {
        expect(getTableColumnsByFQN).toHaveBeenCalledWith(
          'service.database.schema.table',
          expect.objectContaining({ fields: 'tags', limit: 15, offset: 0 })
        );
      });
    });

    it('should show loading state during data fetch', async () => {
      (getTableColumnsByFQN as jest.Mock).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      expect(screen.getByText('Loading: true')).toBeInTheDocument();
    });

    it('should not fetch data when table FQN is missing', () => {
      (useFqn as jest.Mock).mockImplementation(() => ({
        fqn: undefined,
      }));

      render(<ContractSchemaFormTab selectedSchema={[]} {...commonProps} />);

      expect(getTableColumnsByFQN).not.toHaveBeenCalled();
    });
  });
});
