/*
 *  Copyright 2023 Collate.
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

import { render, screen, waitFor } from '@testing-library/react';
import { readString } from 'react-papaparse';
import { ExportTypes } from '../../../constants/Export.constants';
import { LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS } from '../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { useFqn } from '../../../hooks/useFqn';
import { getLineageTableConfig } from '../../../utils/EntityLineageUtils';
import { useEntityExportModalProvider } from '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import LineageTable from './LineageTable.component';

// Mock the dependencies
jest.mock('../../../context/LineageProvider/LineageProvider');
jest.mock('../../../hooks/useFqn');
jest.mock('../../../utils/EntityLineageUtils');
jest.mock(
  '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component'
);
jest.mock('react-papaparse', () => ({
  readString: jest.fn(),
}));

const mockUseLineageProvider = useLineageProvider as jest.MockedFunction<
  typeof useLineageProvider
>;
const mockUseFqn = useFqn as jest.MockedFunction<typeof useFqn>;
const mockUseEntityExportModalProvider =
  useEntityExportModalProvider as jest.MockedFunction<
    typeof useEntityExportModalProvider
  >;
const mockGetLineageColumnsAndDataSourceFromCSV =
  getLineageTableConfig as jest.MockedFunction<typeof getLineageTableConfig>;
const mockReadString = readString as jest.MockedFunction<typeof readString>;

describe('LineageTable Component', () => {
  const mockFqn = 'test.fqn';
  const mockExportLineageData = jest.fn();
  const mockTriggerExportForBulkEdit = jest.fn();
  const mockClearCSVExportData = jest.fn();

  const mockTableConfig = {
    columns: [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        ellipsis: { showTitle: false },
        render: jest.fn(),
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        width: 200,
        ellipsis: { showTitle: false },
        render: jest.fn(),
      },
    ],
    dataSource: [
      { name: 'Test Entity 1', type: 'Table', key: '0' },
      { name: 'Test Entity 2', type: 'Dashboard', key: '1' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    mockUseFqn.mockReturnValue({ fqn: mockFqn } as any);
    mockUseLineageProvider.mockReturnValue({
      exportLineageData: mockExportLineageData,
    } as any);
    mockUseEntityExportModalProvider.mockReturnValue({
      triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
      csvExportData: undefined,
      clearCSVExportData: mockClearCSVExportData,
    } as any);
    mockGetLineageColumnsAndDataSourceFromCSV.mockReturnValue(mockTableConfig);
  });

  it('should render the component', () => {
    render(<LineageTable />);

    expect(screen.getByTestId('lineage-table')).toBeInTheDocument();
  });

  it('should trigger export for bulk edit on mount', () => {
    render(<LineageTable />);

    expect(mockTriggerExportForBulkEdit).toHaveBeenCalledWith({
      name: mockFqn,
      onExport: mockExportLineageData,
      exportTypes: [ExportTypes.CSV],
    });
  });

  it('should clear CSV export data on unmount', () => {
    const { unmount } = render(<LineageTable />);

    unmount();

    expect(mockClearCSVExportData).toHaveBeenCalled();
  });

  it('should render table with empty data initially', () => {
    render(<LineageTable />);

    const table = screen.getByTestId('lineage-table');

    expect(table).toBeInTheDocument();
  });

  it('should handle CSV data processing when csvExportData is available', async () => {
    const mockCSVData =
      'Name,Type\nTest Entity 1,Table\nTest Entity 2,Dashboard';
    const mockParsedData = {
      data: [
        ['Name', 'Type'],
        ['Test Entity 1', 'Table'],
        ['Test Entity 2', 'Dashboard'],
      ],
    };

    mockReadString.mockImplementation((_: string, options: any) => {
      if (options.complete) {
        options.complete(mockParsedData);
      }
    });

    mockUseEntityExportModalProvider.mockReturnValue({
      triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
      csvExportData: mockCSVData,
      clearCSVExportData: mockClearCSVExportData,
    } as any);

    render(<LineageTable />);

    await waitFor(() => {
      expect(mockReadString).toHaveBeenCalledWith(mockCSVData, {
        worker: true,
        skipEmptyLines: true,
        complete: expect.any(Function),
      });
    });

    expect(mockGetLineageColumnsAndDataSourceFromCSV).toHaveBeenCalledWith(
      mockParsedData.data
    );
  });

  it('should not process CSV data when csvExportData is not available', () => {
    render(<LineageTable />);

    expect(mockReadString).not.toHaveBeenCalled();
  });

  it('should handle empty CSV data gracefully', () => {
    mockGetLineageColumnsAndDataSourceFromCSV.mockReturnValue({
      columns: [],
      dataSource: [],
    });

    render(<LineageTable />);

    const table = screen.getByTestId('lineage-table');

    expect(table).toBeInTheDocument();
  });

  it('should handle CSV parsing errors gracefully', () => {
    mockReadString.mockImplementation((_: string, options: any) => {
      if (options.error) {
        options.error(new Error('CSV parsing error'));
      }
    });

    mockUseEntityExportModalProvider.mockReturnValue({
      triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
      csvExportData: 'invalid,csv,data',
      clearCSVExportData: mockClearCSVExportData,
    } as any);

    render(<LineageTable />);

    const table = screen.getByTestId('lineage-table');

    expect(table).toBeInTheDocument();
  });

  it('should update table config when CSV data is processed', async () => {
    const mockCSVData = 'Name,Type\nTest Entity 1,Table';
    const mockParsedData = {
      data: [
        ['Name', 'Type'],
        ['Test Entity 1', 'Table'],
      ],
    };

    mockReadString.mockImplementation((_: string, options: any) => {
      if (options.complete) {
        options.complete(mockParsedData);
      }
    });

    mockUseEntityExportModalProvider.mockReturnValue({
      triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
      csvExportData: mockCSVData,
      clearCSVExportData: mockClearCSVExportData,
    } as any);

    render(<LineageTable />);

    await waitFor(() => {
      expect(mockGetLineageColumnsAndDataSourceFromCSV).toHaveBeenCalledWith(
        mockParsedData.data
      );
    });
  });

  it('should handle multiple CSV data updates', async () => {
    const mockCSVData1 = 'Name,Type\nTest Entity 1,Table';
    const mockCSVData2 = 'Name,Type\nTest Entity 2,Dashboard';
    const mockParsedData1 = {
      data: [
        ['Name', 'Type'],
        ['Test Entity 1', 'Table'],
      ],
    };
    const mockParsedData2 = {
      data: [
        ['Name', 'Type'],
        ['Test Entity 2', 'Dashboard'],
      ],
    };

    mockReadString.mockImplementation((data: string, options: any) => {
      if (data === mockCSVData1 && options.complete) {
        options.complete(mockParsedData1);
      } else if (data === mockCSVData2 && options.complete) {
        options.complete(mockParsedData2);
      }
    });

    const { rerender } = render(<LineageTable />);

    mockUseEntityExportModalProvider.mockReturnValue({
      triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
      csvExportData: mockCSVData1,
      clearCSVExportData: mockClearCSVExportData,
    } as any);

    rerender(<LineageTable />);

    await waitFor(() => {
      expect(mockGetLineageColumnsAndDataSourceFromCSV).toHaveBeenCalledWith(
        mockParsedData1.data
      );
    });

    mockUseEntityExportModalProvider.mockReturnValue({
      triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
      csvExportData: mockCSVData2,
      clearCSVExportData: mockClearCSVExportData,
    } as any);

    rerender(<LineageTable />);

    await waitFor(() => {
      expect(mockGetLineageColumnsAndDataSourceFromCSV).toHaveBeenCalledWith(
        mockParsedData2.data
      );
    });
  });
});

describe('LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS', () => {
  it('should contain all required column keys', () => {
    const expectedKeys = [
      'fromEntityFQN',
      'fromServiceName',
      'fromServiceType',
      'fromOwners',
      'fromDomain',
      'toEntityFQN',
      'toServiceName',
      'toServiceType',
      'toOwners',
      'toDomain',
      'fromChildEntityFQN',
      'toChildEntityFQN',
      'pipelineName',
      'pipelineDisplayName',
      'pipelineType',
      'pipelineDescription',
      'pipelineOwners',
      'pipelineDomain',
      'pipelineServiceName',
      'pipelineServiceType',
    ];

    expectedKeys.forEach((key) => {
      expect(LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS).toHaveProperty(key);
      expect(LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS[key]).toMatch(/^label\./);
    });
  });

  it('should have proper localization key format', () => {
    Object.values(LINEAGE_TABLE_COLUMN_LOCALIZATION_KEYS).forEach((value) => {
      expect(value).toMatch(/^label\.[a-z-]+$/);
    });
  });
});
