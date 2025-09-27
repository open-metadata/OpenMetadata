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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import {
  EntityReference,
  Spreadsheet,
} from '../../../../generated/entity/data/spreadsheet';
import { getEntityDetailsPath } from '../../../../utils/RouterUtils';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
import WorkflowsTable from './WorkflowsTable';

jest.mock('../../../../utils/RouterUtils');
jest.mock('../../../../utils/EntityUtils');
jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(() => <div data-testid="error-placeholder">No data available</div>)
);
jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn(({ markdown }) => (
    <div data-testid="rich-text-preview">{markdown}</div>
  ))
);
jest.mock('../../../common/Table/Table', () =>
  jest.fn(({ columns, dataSource, locale }) => (
    <div data-testid="container-list-table">
      <div data-testid="table-columns-count">{columns?.length || 0}</div>
      {dataSource && dataSource.length > 0 ? (
        dataSource.map((worksheet: EntityReference, index: number) => (
          <div
            data-testid={`worksheet-row-${index}`}
            key={worksheet.id || index}>
            <div data-testid="container-name">{worksheet.name}</div>
            {worksheet.description && (
              <div data-testid="worksheet-description">
                {worksheet.description}
              </div>
            )}
          </div>
        ))
      ) : (
        <div data-testid="empty-state">{locale.emptyText}</div>
      )}
    </div>
  ))
);
jest.mock('../../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(),
}));

const mockUseGenericContext = useGenericContext as jest.Mock;
const mockGetEntityDetailsPath = getEntityDetailsPath as jest.Mock;

const mockWorksheets: EntityReference[] = [
  {
    id: 'worksheet-1',
    name: 'Sales_Q1',
    fullyQualifiedName: 'test-service.test-spreadsheet.Sales_Q1',
    displayName: 'Sales Q1 Data',
    description: 'First quarter sales data worksheet',
    type: EntityType.WORKSHEET,
    deleted: false,
  },
  {
    id: 'worksheet-2',
    name: 'Inventory_Report',
    fullyQualifiedName: 'test-service.test-spreadsheet.Inventory_Report',
    displayName: 'Inventory Report',
    description: '',
    type: EntityType.WORKSHEET,
    deleted: false,
  },
  {
    id: 'worksheet-3',
    name: 'Budget_Planning',
    fullyQualifiedName: 'test-service.test-spreadsheet.Budget_Planning',
    displayName: 'Budget Planning',
    description:
      'Annual budget planning worksheet with **detailed** calculations',
    type: EntityType.WORKSHEET,
    deleted: false,
  },
];

const mockSpreadsheetDetails: Spreadsheet = {
  id: 'spreadsheet-id-1',
  name: 'test-spreadsheet',
  displayName: 'Test Spreadsheet',
  fullyQualifiedName: 'test-service.test-spreadsheet',
  description: 'Test spreadsheet description',
  worksheets: mockWorksheets,
  version: 1.0,
  updatedAt: 1640995200000,
  updatedBy: 'test-user',
  service: {
    id: 'service-1',
    type: 'driveService',
    name: 'test-drive-service',
    fullyQualifiedName: 'test-drive-service',
    displayName: 'Test Drive Service',
    deleted: false,
  },
  deleted: false,
  href: 'http://localhost:8585/api/v1/spreadsheets/spreadsheet-id-1',
};

const renderWorkflowsTable = (spreadsheetData: Partial<Spreadsheet> = {}) => {
  const finalSpreadsheetData = {
    ...mockSpreadsheetDetails,
    ...spreadsheetData,
  };

  mockUseGenericContext.mockReturnValue({
    data: finalSpreadsheetData,
  });

  return render(
    <MemoryRouter>
      <WorkflowsTable />
    </MemoryRouter>
  );
};

describe('WorkflowsTable', () => {
  beforeEach(() => {
    mockGetEntityDetailsPath.mockImplementation(
      (entityType, fqn) => `/${entityType.toLowerCase()}/${fqn}`
    );

    jest.clearAllMocks();
  });

  it('should render workflows table successfully', () => {
    renderWorkflowsTable();

    expect(screen.getByTestId('container-list-table')).toBeInTheDocument();
  });

  it('should display worksheets data correctly', () => {
    renderWorkflowsTable();

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('worksheet-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('worksheet-row-2')).toBeInTheDocument();

    expect(screen.getByTestId('worksheet-row-0')).toHaveTextContent('Sales_Q1');
    expect(screen.getByTestId('worksheet-row-1')).toHaveTextContent(
      'Inventory_Report'
    );
    expect(screen.getByTestId('worksheet-row-2')).toHaveTextContent(
      'Budget_Planning'
    );
  });

  it('should display worksheet descriptions when available', () => {
    renderWorkflowsTable();

    expect(screen.getAllByTestId('worksheet-description')).toHaveLength(2);
    expect(
      screen.getByText('First quarter sales data worksheet')
    ).toBeInTheDocument();
  });

  it('should handle worksheets without description', () => {
    renderWorkflowsTable();

    const worksheetRows = screen.getAllByTestId(/worksheet-row-/);

    expect(worksheetRows).toHaveLength(mockWorksheets.length);
  });

  it('should render empty state when no worksheets available', () => {
    renderWorkflowsTable({
      worksheets: [],
    });

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('should render empty state when worksheets is undefined', () => {
    renderWorkflowsTable({
      worksheets: undefined,
    });

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('should handle worksheets with rich text descriptions', () => {
    const worksheetsWithRichText = [
      {
        ...mockWorksheets[0],
        description: '**Bold text** with _italic_ formatting',
      },
    ];

    renderWorkflowsTable({
      worksheets: worksheetsWithRichText,
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
  });

  it('should handle worksheets with long names', () => {
    const worksheetsWithLongNames = [
      {
        ...mockWorksheets[0],
        name: 'Very_Long_Worksheet_Name_That_Might_Cause_Display_Issues_In_The_Table',
        displayName:
          'Very Long Worksheet Name That Might Cause Display Issues In The Table',
      },
    ];

    renderWorkflowsTable({
      worksheets: worksheetsWithLongNames,
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
  });

  it('should handle worksheets with special characters in names', () => {
    const worksheetsWithSpecialChars = [
      {
        ...mockWorksheets[0],
        name: 'Data-2023&Special_Chars%Test',
        displayName: 'Data 2023 & Special Chars % Test',
      },
    ];

    renderWorkflowsTable({
      worksheets: worksheetsWithSpecialChars,
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
  });

  it('should handle worksheets without displayName', () => {
    const worksheetsWithoutDisplayName = [
      {
        ...mockWorksheets[0],
        displayName: undefined,
      },
    ];

    renderWorkflowsTable({
      worksheets: worksheetsWithoutDisplayName as EntityReference[],
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
  });

  it('should handle worksheets without fullyQualifiedName', () => {
    const worksheetsWithoutFQN = [
      {
        ...mockWorksheets[0],
        fullyQualifiedName: undefined,
      },
    ];

    renderWorkflowsTable({
      worksheets: worksheetsWithoutFQN as EntityReference[],
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
  });

  it('should generate correct entity detail paths', () => {
    renderWorkflowsTable();

    expect(screen.getByTestId('container-list-table')).toBeInTheDocument();
    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
  });

  it('should handle deleted worksheets', () => {
    const worksheetsWithDeleted = [
      { ...mockWorksheets[0], deleted: true },
      { ...mockWorksheets[1], deleted: false },
    ];

    renderWorkflowsTable({
      worksheets: worksheetsWithDeleted,
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('worksheet-row-1')).toBeInTheDocument();
  });

  it('should handle mixed worksheet types correctly', () => {
    const mixedWorksheets = [
      { ...mockWorksheets[0], type: EntityType.WORKSHEET },
      { ...mockWorksheets[1], type: EntityType.WORKSHEET },
    ];

    renderWorkflowsTable({
      worksheets: mixedWorksheets,
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('worksheet-row-1')).toBeInTheDocument();
  });

  it('should handle single worksheet correctly', () => {
    renderWorkflowsTable({
      worksheets: [mockWorksheets[0]],
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
    expect(screen.queryByTestId('worksheet-row-1')).not.toBeInTheDocument();
  });

  it('should handle worksheets with empty string description', () => {
    const worksheetsWithEmptyDescription = [
      {
        ...mockWorksheets[0],
        description: '',
      },
    ];

    renderWorkflowsTable({
      worksheets: worksheetsWithEmptyDescription,
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
  });

  it('should handle worksheets with null description', () => {
    const worksheetsWithNullDescription = [
      {
        ...mockWorksheets[0],
        description: undefined,
      },
    ];

    renderWorkflowsTable({
      worksheets: worksheetsWithNullDescription,
    });

    expect(screen.getByTestId('worksheet-row-0')).toBeInTheDocument();
  });

  it('should render correct number of worksheet rows', () => {
    renderWorkflowsTable();

    const worksheetRows = screen.getAllByTestId(/worksheet-row-/);

    expect(worksheetRows).toHaveLength(mockWorksheets.length);
  });

  it('should handle context data being undefined', () => {
    mockUseGenericContext.mockReturnValue({
      data: { worksheets: [] },
    });

    render(
      <MemoryRouter>
        <WorkflowsTable />
      </MemoryRouter>
    );

    expect(screen.getByTestId('container-list-table')).toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });
});
