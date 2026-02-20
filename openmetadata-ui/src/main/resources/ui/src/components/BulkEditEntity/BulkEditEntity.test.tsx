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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Column } from 'react-data-grid';
import { MemoryRouter } from 'react-router-dom';
import { VALIDATION_STEP } from '../../constants/BulkImport.constant';
import { EntityType } from '../../enums/entity.enum';
import { CSVImportResult, Status } from '../../generated/type/csvImportResult';
import BulkEditEntity from './BulkEditEntity.component';
import { BulkEditEntityProps } from './BulkEditEntity.interface';

const mockNavigate = jest.fn();
const mockTriggerExportForBulkEdit = jest.fn();
const mockClearCSVExportData = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({
    fqn: 'test.entity.fqn',
  })),
}));

let mockEntityType = EntityType.TABLE;
jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({
    entityType: mockEntityType,
  })),
}));

let mockCsvExportData: string | undefined = 'col1,col2\nval1,val2';
jest.mock(
  '../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: jest.fn(() => ({
      triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
      csvExportData: mockCsvExportData,
      clearCSVExportData: mockClearCSVExportData,
    })),
  })
);

jest.mock('react-papaparse', () => ({
  readString: jest.fn((_data, options) => {
    if (options?.complete) {
      options.complete({
        data: [
          ['col1', 'col2'],
          ['val1', 'val2'],
        ],
      });
    }
  }),
}));

jest.mock('react-data-grid', () => {
  const MockDataGrid = jest.fn(({ rows, columns }) => (
    <div data-testid="data-grid">
      <span data-testid="row-count">{rows?.length ?? 0}</span>
      <span data-testid="column-count">{columns?.length ?? 0}</span>
    </div>
  ));

  return {
    __esModule: true,
    default: MockDataGrid,
  };
});

jest.mock('../common/TitleBreadcrumb/TitleBreadcrumb.component', () => {
  return jest.fn(({ titleLinks }) => (
    <div data-testid="title-breadcrumb">
      {titleLinks?.map((link: { name: string }, idx: number) => (
        <span data-testid="breadcrumb-item" key={idx}>
          {link.name}
        </span>
      ))}
    </div>
  ));
});

jest.mock(
  '../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => {
    return jest.fn(({ activeStep, steps }) => (
      <div data-testid="stepper">
        <span data-testid="active-step">{activeStep}</span>
        <span data-testid="step-count">{steps?.length ?? 0}</span>
      </div>
    ));
  }
);

jest.mock('../common/Banner/Banner', () => {
  return jest.fn(({ message, type, isLoading }) => (
    <div data-testid="banner">
      <span data-testid="banner-message">{message}</span>
      <span data-testid="banner-type">{type}</span>
      <span data-testid="banner-loading">{isLoading ? 'true' : 'false'}</span>
    </div>
  ));
});

jest.mock('../common/EntityImport/ImportStatus/ImportStatus.component', () => ({
  ImportStatus: jest.fn(({ csvImportResult }) => (
    <div data-testid="import-status">
      <span data-testid="import-status-value">{csvImportResult?.status}</span>
    </div>
  )),
}));

jest.mock('../common/Loader/Loader', () => {
  return jest.fn(() => <div data-testid="loader">Loading...</div>);
});

jest.mock('../../utils/EntityBulkEdit/EntityBulkEditUtils', () => ({
  getBulkEditCSVExportEntityApi: jest.fn(() => jest.fn()),
  getBulkEntityNavigationPath: jest.fn(
    (entityType, fqn) => `/${entityType}/${fqn}`
  ),
}));

const { useEntityExportModalProvider } = jest.requireMock(
  '../Entity/EntityExportModalProvider/EntityExportModalProvider.component'
);

const mockColumns: Column<Record<string, string>>[] = [
  { key: 'col1', name: 'Column 1' },
  { key: 'col2', name: 'Column 2' },
];

const mockDataSource: Record<string, string>[] = [
  { col1: 'value1', col2: 'value2' },
  { col1: 'value3', col2: 'value4' },
];

const mockBreadcrumbList = [
  { name: 'Home', url: '/' },
  { name: 'Entity', url: '/entity' },
];

const mockValidationData: CSVImportResult = {
  status: Status.Success,
  numberOfRowsPassed: 2,
  numberOfRowsFailed: 0,
};

const mockValidateCSVData = {
  columns: mockColumns,
  dataSource: mockDataSource,
};

const defaultProps: BulkEditEntityProps = {
  dataSource: mockDataSource,
  columns: mockColumns as unknown as Column<Record<string, string>[]>[],
  breadcrumbList: mockBreadcrumbList,
  activeStep: VALIDATION_STEP.EDIT_VALIDATE,
  isValidating: false,
  handleBack: jest.fn(),
  handleValidate: jest.fn().mockResolvedValue(undefined),
  onCSVReadComplete: jest.fn(),
  setGridContainer: jest.fn(),
  handleCopy: jest.fn(),
  handlePaste: jest.fn().mockReturnValue({}),
  pushToUndoStack: jest.fn(),
  handleOnRowsChange: jest.fn(),
};

const renderComponent = (props: Partial<BulkEditEntityProps> = {}) => {
  return render(
    <MemoryRouter>
      <BulkEditEntity {...defaultProps} {...props} />
    </MemoryRouter>
  );
};

describe('BulkEditEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEntityType = EntityType.TABLE;
    mockCsvExportData = 'col1,col2\nval1,val2';
    useEntityExportModalProvider.mockReturnValue({
      triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
      csvExportData: mockCsvExportData,
      clearCSVExportData: mockClearCSVExportData,
    });
  });

  describe('Render & Initial State', () => {
    it('should render without crashing', () => {
      renderComponent();

      expect(screen.getByTestId('title-breadcrumb')).toBeInTheDocument();
      expect(screen.getByTestId('stepper')).toBeInTheDocument();
    });

    it('should render breadcrumb with correct links', () => {
      renderComponent();

      const breadcrumbItems = screen.getAllByTestId('breadcrumb-item');

      expect(breadcrumbItems).toHaveLength(2);
      expect(breadcrumbItems[0]).toHaveTextContent('Home');
      expect(breadcrumbItems[1]).toHaveTextContent('Entity');
    });

    it('should render stepper with correct active step', () => {
      renderComponent({ activeStep: VALIDATION_STEP.EDIT_VALIDATE });

      expect(screen.getByTestId('active-step')).toHaveTextContent('1');
    });

    it('should render Loader when csvExportData is empty', () => {
      mockCsvExportData = undefined;
      useEntityExportModalProvider.mockReturnValue({
        triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
        csvExportData: undefined,
        clearCSVExportData: mockClearCSVExportData,
      });

      renderComponent();

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should render DataGrid when csvExportData is available', () => {
      renderComponent();

      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
    });
  });

  describe('Step Navigation', () => {
    it('should show cancel button at step 1 (EDIT_VALIDATE)', () => {
      renderComponent({ activeStep: VALIDATION_STEP.EDIT_VALIDATE });

      expect(
        screen.getByRole('button', { name: 'label.cancel' })
      ).toBeInTheDocument();
    });

    it('should show previous button at step 2 (UPDATE)', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.UPDATE,
        validationData: mockValidationData,
      });

      expect(
        screen.getByRole('button', { name: 'label.previous' })
      ).toBeInTheDocument();
    });

    it('should show next button at step 1', () => {
      renderComponent({ activeStep: VALIDATION_STEP.EDIT_VALIDATE });

      expect(
        screen.getByRole('button', { name: 'label.next' })
      ).toBeInTheDocument();
    });

    it('should show update button at step 2', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.UPDATE,
        validationData: mockValidationData,
      });

      expect(
        screen.getByRole('button', { name: 'label.update' })
      ).toBeInTheDocument();
    });

    it('should not show buttons when activeStep is 0', () => {
      renderComponent({ activeStep: VALIDATION_STEP.UPLOAD });

      expect(
        screen.queryByRole('button', { name: 'label.cancel' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'label.next' })
      ).not.toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call handleValidate when next button is clicked', async () => {
      const handleValidate = jest.fn().mockResolvedValue(undefined);
      renderComponent({
        activeStep: VALIDATION_STEP.EDIT_VALIDATE,
        handleValidate,
      });

      const nextButton = screen.getByRole('button', { name: 'label.next' });

      await act(async () => {
        fireEvent.click(nextButton);
      });

      expect(handleValidate).toHaveBeenCalledTimes(1);
    });

    it('should call handleBack when previous button is clicked', () => {
      const handleBack = jest.fn();
      renderComponent({
        activeStep: VALIDATION_STEP.UPDATE,
        validationData: mockValidationData,
        handleBack,
      });

      const previousButton = screen.getByRole('button', {
        name: 'label.previous',
      });
      fireEvent.click(previousButton);

      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('should navigate away and clear data when cancel button is clicked', () => {
      renderComponent({ activeStep: VALIDATION_STEP.EDIT_VALIDATE });

      const cancelButton = screen.getByRole('button', { name: 'label.cancel' });
      fireEvent.click(cancelButton);

      expect(mockClearCSVExportData).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/table/test.entity.fqn');
    });

    it('should disable buttons when isValidating is true', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.EDIT_VALIDATE,
        isValidating: true,
      });

      const cancelButton = screen.getByRole('button', { name: 'label.cancel' });
      const nextButton = screen.getByRole('button', { name: 'label.next' });

      expect(cancelButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  describe('Async Import Job Banner', () => {
    it('should render banner when activeAsyncImportJob has jobId', () => {
      renderComponent({
        activeAsyncImportJob: {
          jobId: 'test-job-123',
          message: 'Processing...',
          type: 'onValidate',
        },
      });

      expect(screen.getByTestId('banner')).toBeInTheDocument();
      expect(screen.getByTestId('banner-message')).toHaveTextContent(
        'Processing...'
      );
    });

    it('should show error type banner when activeAsyncImportJob has error', () => {
      renderComponent({
        activeAsyncImportJob: {
          jobId: 'test-job-123',
          error: 'Something went wrong',
          type: 'onValidate',
        },
      });

      expect(screen.getByTestId('banner-message')).toHaveTextContent(
        'Something went wrong'
      );
      expect(screen.getByTestId('banner-type')).toHaveTextContent('error');
    });

    it('should show success type banner when no error', () => {
      renderComponent({
        activeAsyncImportJob: {
          jobId: 'test-job-123',
          message: 'Processing...',
          type: 'onValidate',
        },
      });

      expect(screen.getByTestId('banner-type')).toHaveTextContent('success');
    });

    it('should not render banner when activeAsyncImportJob has no jobId', () => {
      renderComponent({
        activeAsyncImportJob: {
          type: 'onValidate',
        },
      });

      expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
    });
  });

  describe('Validation Data Display', () => {
    it('should render ImportStatus when at UPDATE step with validationData', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.UPDATE,
        validationData: mockValidationData,
      });

      expect(screen.getByTestId('import-status')).toBeInTheDocument();
      expect(screen.getByTestId('import-status-value')).toHaveTextContent(
        'success'
      );
    });

    it('should render validateCSVData grid at UPDATE step', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.UPDATE,
        validationData: mockValidationData,
        validateCSVData: mockValidateCSVData,
      });

      const dataGrids = screen.getAllByTestId('data-grid');

      expect(dataGrids.length).toBeGreaterThanOrEqual(1);
    });

    it('should not render ImportStatus at EDIT_VALIDATE step', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.EDIT_VALIDATE,
        validationData: mockValidationData,
      });

      expect(screen.queryByTestId('import-status')).not.toBeInTheDocument();
    });
  });

  describe('useEffect Hooks', () => {
    it('should call triggerExportForBulkEdit on mount', () => {
      renderComponent();

      expect(mockTriggerExportForBulkEdit).toHaveBeenCalledTimes(1);
      expect(mockTriggerExportForBulkEdit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test.entity.fqn',
          exportTypes: ['CSV'],
        })
      );
    });

    it('should call clearCSVExportData on unmount', () => {
      const { unmount } = renderComponent();

      unmount();

      expect(mockClearCSVExportData).toHaveBeenCalled();
    });

    it('should call onCSVReadComplete when csvExportData changes', () => {
      const onCSVReadComplete = jest.fn();
      renderComponent({ onCSVReadComplete });

      expect(onCSVReadComplete).toHaveBeenCalled();
    });
  });

  describe('Props Validation', () => {
    it('should handle empty dataSource', () => {
      renderComponent({ dataSource: [] });

      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
      expect(screen.getByTestId('row-count')).toHaveTextContent('0');
    });

    it('should handle empty columns', () => {
      renderComponent({ columns: [] });

      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
      expect(screen.getByTestId('column-count')).toHaveTextContent('0');
    });

    it('should handle empty breadcrumbList', () => {
      renderComponent({ breadcrumbList: [] });

      expect(screen.getByTestId('title-breadcrumb')).toBeInTheDocument();
      expect(screen.queryByTestId('breadcrumb-item')).not.toBeInTheDocument();
    });

    it('should handle undefined validationData at UPDATE step', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.UPDATE,
        validationData: undefined,
      });

      expect(screen.queryByTestId('import-status')).not.toBeInTheDocument();
    });

    it('should handle undefined validateCSVData at UPDATE step', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.UPDATE,
        validationData: mockValidationData,
        validateCSVData: undefined,
      });

      expect(screen.getByTestId('import-status')).toBeInTheDocument();
    });
  });

  describe('Source Entity Type', () => {
    it('should pass sourceEntityType to getBulkEntityNavigationPath on cancel', () => {
      const { getBulkEntityNavigationPath } = jest.requireMock(
        '../../utils/EntityBulkEdit/EntityBulkEditUtils'
      );

      renderComponent({
        activeStep: VALIDATION_STEP.EDIT_VALIDATE,
        sourceEntityType: EntityType.TEST_SUITE,
      });

      const cancelButton = screen.getByRole('button', { name: 'label.cancel' });
      fireEvent.click(cancelButton);

      expect(getBulkEntityNavigationPath).toHaveBeenCalledWith(
        EntityType.TABLE,
        'test.entity.fqn',
        EntityType.TEST_SUITE
      );
    });
  });

  describe('Different Entity Types', () => {
    it('should handle TABLE entity type', () => {
      mockEntityType = EntityType.TABLE;
      renderComponent();

      expect(mockTriggerExportForBulkEdit).toHaveBeenCalled();
    });

    it('should handle DATABASE entity type', () => {
      mockEntityType = EntityType.DATABASE;
      renderComponent();

      expect(mockTriggerExportForBulkEdit).toHaveBeenCalled();
    });

    it('should handle GLOSSARY entity type', () => {
      mockEntityType = EntityType.GLOSSARY;
      renderComponent();

      expect(mockTriggerExportForBulkEdit).toHaveBeenCalled();
    });

    it('should handle TEST_CASE entity type', () => {
      mockEntityType = EntityType.TEST_CASE;
      renderComponent();

      expect(mockTriggerExportForBulkEdit).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null activeAsyncImportJob', () => {
      renderComponent({ activeAsyncImportJob: undefined });

      expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
    });

    it('should handle activeAsyncImportJob with only error (no message)', () => {
      renderComponent({
        activeAsyncImportJob: {
          jobId: 'test-job',
          error: 'Error occurred',
          type: 'onValidate',
        },
      });

      expect(screen.getByTestId('banner-message')).toHaveTextContent(
        'Error occurred'
      );
    });

    it('should handle activeAsyncImportJob with neither error nor message', () => {
      renderComponent({
        activeAsyncImportJob: {
          jobId: 'test-job',
          type: 'onValidate',
        },
      });

      expect(screen.getByTestId('banner-message')).toHaveTextContent('');
    });

    it('should handle step 3 (no next/update button shown)', () => {
      renderComponent({
        activeStep: 3 as VALIDATION_STEP,
        validationData: mockValidationData,
      });

      expect(
        screen.queryByRole('button', { name: 'label.next' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'label.update' })
      ).not.toBeInTheDocument();
    });
  });

  describe('DataGrid Rendering', () => {
    it('should render edit DataGrid at EDIT_VALIDATE step', () => {
      renderComponent({ activeStep: VALIDATION_STEP.EDIT_VALIDATE });

      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
    });

    it('should render validateCSVData DataGrid at UPDATE step instead of edit DataGrid', () => {
      renderComponent({
        activeStep: VALIDATION_STEP.UPDATE,
        validationData: mockValidationData,
        validateCSVData: mockValidateCSVData,
      });

      // At UPDATE step, the validateCSVData grid is rendered (not the edit grid)
      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
    });

    it('should pass correct props to DataGrid', () => {
      renderComponent({
        dataSource: mockDataSource,
        columns: mockColumns as unknown as Column<Record<string, string>[]>[],
      });

      expect(screen.getByTestId('row-count')).toHaveTextContent('2');
      expect(screen.getByTestId('column-count')).toHaveTextContent('2');
    });
  });

  describe('Loading State', () => {
    it('should show loader when csvExportData is empty string', () => {
      useEntityExportModalProvider.mockReturnValue({
        triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
        csvExportData: '',
        clearCSVExportData: mockClearCSVExportData,
      });

      renderComponent();

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should show loader when csvExportData is null', () => {
      useEntityExportModalProvider.mockReturnValue({
        triggerExportForBulkEdit: mockTriggerExportForBulkEdit,
        csvExportData: null,
        clearCSVExportData: mockClearCSVExportData,
      });

      renderComponent();

      expect(screen.getByTestId('loader')).toBeInTheDocument();
    });

    it('should not show loader when csvExportData has content', () => {
      renderComponent();

      expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
    });
  });

  describe('Banner Loading State', () => {
    it('should show loading true when no error in activeAsyncImportJob', () => {
      renderComponent({
        activeAsyncImportJob: {
          jobId: 'test-job',
          message: 'Processing...',
          type: 'onValidate',
        },
      });

      expect(screen.getByTestId('banner-loading')).toHaveTextContent('true');
    });

    it('should show loading false when error exists in activeAsyncImportJob', () => {
      renderComponent({
        activeAsyncImportJob: {
          jobId: 'test-job',
          error: 'Failed',
          type: 'onValidate',
        },
      });

      expect(screen.getByTestId('banner-loading')).toHaveTextContent('false');
    });
  });
});
