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
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import BulkEntityImportPage from './BulkEntityImportPage';

// Mock data
const mockEntity = {
  id: 'test-id',
  name: 'test-table',
  displayName: 'Test Table',
  fullyQualifiedName: 'test.table',
};

const mockCSVImportResult = {
  status: 'success',
  numberOfRowsProcessed: 10,
  numberOfRowsPassed: 8,
  numberOfRowsFailed: 2,
  importResultsCsv: 'name,status\nrow1,success\nrow2,failed',
};

const mockCSVImportResultFailure = {
  status: 'failure',
  numberOfRowsProcessed: 10,
  numberOfRowsPassed: 0,
  numberOfRowsFailed: 10,
  importResultsCsv: 'name,status\nrow1,failed\nrow2,failed',
};

const mockCSVImportResultAborted = {
  status: 'aborted',
  abortReason: 'CSV file contains invalid data',
};

const mockWebSocketResponse = {
  jobId: 'test-job-id',
  status: 'COMPLETED' as const,
  result: mockCSVImportResult,
  error: null,
};

// Mock navigation
const mockNavigate = jest.fn();
const mockLocation = {
  pathname: '/table/test-table/import',
  search: '',
  hash: '',
  state: null,
};

// Mock hooks
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({ entityType: EntityType.TABLE })),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({ fqn: 'test.table' })),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

jest.mock('../../../hooks/useGridEditController', () => ({
  useGridEditController: jest.fn(() => ({
    handleCopy: jest.fn(),
    handlePaste: jest.fn(),
    pushToUndoStack: jest.fn(),
    handleOnRowsChange: jest.fn(),
    setGridContainer: jest.fn(),
    handleAddRow: jest.fn(),
  })),
}));

// Mock WebSocket context
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
};

jest.mock('../../../context/WebSocketProvider/WebSocketProvider', () => ({
  useWebSocketConnector: jest.fn(() => ({ socket: mockSocket })),
}));

// Mock Papa Parse
const mockReadString = jest.fn();
jest.mock('react-papaparse', () => ({
  usePapaParse: jest.fn(() => ({
    readString: mockReadString,
  })),
}));

// Mock entity util
jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityByFqn: jest.fn(),
  },
}));

// Mock CSV utils - use factory function to avoid hoisting issues
jest.mock('../../../utils/CSV/CSV.utils');
jest.mock('../../../utils/CSV/CSVUtilsClassBase', () => ({
  __esModule: true,
  default: {
    hideImportsColumnList: jest.fn(() => []),
  },
}));

// Mock entity import utils
jest.mock('../../../utils/EntityImport/EntityImportUtils');

// Mock entity bulk edit utils
jest.mock('../../../utils/EntityBulkEdit/EntityBulkEditUtils');

// Mock toast utils
const mockShowErrorToast = jest.fn();
const mockShowSuccessToast = jest.fn();

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => mockShowSuccessToast(...args),
}));

// Mock components
jest.mock(
  '../../../components/BulkEditEntity/BulkEditEntity.component',
  () => ({
    __esModule: true,
    default: jest.fn(() => (
      <div data-testid="bulk-edit-entity">Bulk Edit Entity</div>
    )),
  })
);

jest.mock('../../../components/common/Banner/Banner', () => ({
  __esModule: true,
  default: jest.fn(({ message }) => <div data-testid="banner">{message}</div>),
}));

jest.mock(
  '../../../components/common/EntityImport/ImportStatus/ImportStatus.component',
  () => ({
    ImportStatus: jest.fn(() => (
      <div data-testid="import-status">Import Status</div>
    )),
  })
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => ({
    __esModule: true,
    default: jest.fn(() => (
      <div data-testid="title-breadcrumb">Breadcrumb</div>
    )),
  })
);

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest.fn(({ children }) => (
    <div data-testid="page-layout">{children}</div>
  )),
}));

jest.mock(
  '../../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => ({
    __esModule: true,
    default: jest.fn(() => <div data-testid="stepper">Stepper</div>),
  })
);

jest.mock('../../../components/UploadFile/UploadFile', () => ({
  __esModule: true,
  default: jest.fn(({ onCSVUploaded, disabled }) => (
    <div data-testid="upload-file">
      <button
        data-testid="upload-csv-button"
        disabled={disabled}
        onClick={() => {
          const mockEvent = {
            target: {
              result: 'name,description\nrow1,desc1\nrow2,desc2',
            },
          } as ProgressEvent<FileReader>;
          onCSVUploaded(mockEvent);
        }}>
        Upload CSV
      </button>
    </div>
  )),
}));

jest.mock('react-data-grid', () => ({
  __esModule: true,
  default: jest.fn(({ rows, columns }) => (
    <div data-testid="data-grid">
      <div>Rows: {rows.length}</div>
      <div>Columns: {columns.length}</div>
    </div>
  )),
}));

const renderComponent = (initialPath = '/table/test.table/import') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          element={<BulkEntityImportPage />}
          path="/:entityType/:fqn/import"
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('BulkEntityImportPage', () => {
  let mockGetEntityByFqn: jest.Mock;
  let mockValidateCsvString: jest.Mock;
  let mockIsBulkEditRoute: jest.Mock;
  let mockGetEntityColumnsAndDataSourceFromCSV: jest.Mock;
  let mockGetImportValidateAPIEntityType: jest.Mock;

  beforeEach(() => {
    // Get mocked functions from modules
    const EntityUtilClassBase =
      require('../../../utils/EntityUtilClassBase').default;
    mockGetEntityByFqn = EntityUtilClassBase.getEntityByFqn as jest.Mock;

    const CSVUtils = require('../../../utils/CSV/CSV.utils');
    mockGetEntityColumnsAndDataSourceFromCSV =
      CSVUtils.getEntityColumnsAndDataSourceFromCSV as jest.Mock;

    const EntityImportUtils = require('../../../utils/EntityImport/EntityImportUtils');
    mockValidateCsvString = EntityImportUtils.validateCsvString as jest.Mock;
    mockGetImportValidateAPIEntityType =
      EntityImportUtils.getImportValidateAPIEntityType as jest.Mock;

    const EntityBulkEditUtils = require('../../../utils/EntityBulkEdit/EntityBulkEditUtils');
    mockIsBulkEditRoute = EntityBulkEditUtils.isBulkEditRoute as jest.Mock;

    jest.clearAllMocks();
    mockGetEntityByFqn.mockResolvedValue(mockEntity);
    mockValidateCsvString.mockResolvedValue(undefined);
    mockIsBulkEditRoute.mockReturnValue(false);
    mockGetEntityColumnsAndDataSourceFromCSV.mockReturnValue({
      columns: [
        { key: 'name', name: 'Name' },
        { key: 'description', name: 'Description' },
      ],
      dataSource: [
        { name: 'row1', description: 'desc1' },
        { name: 'row2', description: 'desc2' },
      ],
    });
    mockLocation.pathname = '/table/test.table/import';
    mockLocation.search = '';
  });

  describe('Render & Initial State', () => {
    it('should render without crashing', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('page-layout')).toBeInTheDocument();
      });
    });

    it('should render all required UI elements on initial load', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('title-breadcrumb')).toBeInTheDocument();
        expect(screen.getByTestId('stepper')).toBeInTheDocument();
        expect(screen.getByTestId('upload-file')).toBeInTheDocument();
      });
    });

    it('should start at UPLOAD step by default', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-file')).toBeInTheDocument();
      });

      // Data grid should not be visible initially
      expect(screen.queryByTestId('data-grid')).not.toBeInTheDocument();
    });

    it('should fetch entity data on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockGetEntityByFqn).toHaveBeenCalledWith(
          EntityType.TABLE,
          'test.table'
        );
      });
    });

    it('should not fetch entity when fqn is wildcard', async () => {
      const { useFqn } = require('../../../hooks/useFqn');
      useFqn.mockReturnValue({ fqn: '*' });

      renderComponent();

      await waitFor(() => {
        expect(mockGetEntityByFqn).not.toHaveBeenCalled();
      });
    });
  });

  describe('Props Validation', () => {
    it('should handle missing entity gracefully', async () => {
      mockGetEntityByFqn.mockResolvedValue(null);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('page-layout')).toBeInTheDocument();
      });

      // Should not crash
      expect(screen.queryByTestId('title-breadcrumb')).toBeInTheDocument();
    });

    it('should handle entity fetch error gracefully', async () => {
      const mockError = new Error('Failed to fetch entity');
      mockGetEntityByFqn.mockRejectedValue(mockError);

      renderComponent();

      // Component should still render even if entity fetch fails
      await waitFor(() => {
        expect(screen.getByTestId('page-layout')).toBeInTheDocument();
      });

      expect(screen.getByTestId('title-breadcrumb')).toBeInTheDocument();
      expect(screen.getByTestId('upload-file')).toBeInTheDocument();
    });

    it('should handle sourceEntityType from URL for test cases', async () => {
      const { useRequiredParams } = require('../../../utils/useRequiredParams');
      useRequiredParams.mockReturnValue({ entityType: EntityType.TEST_CASE });

      mockLocation.search = '?sourceEntityType=table';

      renderComponent('/testCase/test.table/import?sourceEntityType=table');

      // Component should render without crashing
      await waitFor(() => {
        expect(screen.getByTestId('page-layout')).toBeInTheDocument();
      });

      expect(screen.getByTestId('upload-file')).toBeInTheDocument();
    });
  });

  describe('User Interactions - CSV Upload', () => {
    it('should handle CSV file upload successfully', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');

      await act(async () => {
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(mockValidateCsvString).toHaveBeenCalled();
      });
    });

    it('should disable upload when async job is in progress', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');

      // Simulate upload
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate websocket response with job started
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
        }
      });

      await waitFor(() => {
        const button = screen.getByTestId('upload-csv-button');

        expect(button).toBeDisabled();
      });
    });

    it('should show error toast on CSV upload failure', async () => {
      const mockError = new Error('Invalid CSV format');
      mockValidateCsvString.mockRejectedValue(mockError);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');

      await act(async () => {
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(mockError);
      });
    });
  });

  describe('Async Behavior & WebSocket Integration', () => {
    it('should register websocket listener on mount', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalledWith(
          'csvImportChannel',
          expect.any(Function)
        );
      });
    });

    it('should cleanup websocket listener on unmount', async () => {
      const { unmount } = renderComponent();

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith('csvImportChannel');
    });

    it('should handle websocket STARTED status', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      // Trigger upload to set processing state
      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate websocket STARTED response
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('banner')).toBeInTheDocument();
      });
    });

    it('should handle websocket COMPLETED status with success', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      // Trigger upload
      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate STARTED
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
        }
      });

      // Simulate COMPLETED with success
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(JSON.stringify(mockWebSocketResponse));
        }
      });

      await waitFor(() => {
        expect(mockReadString).toHaveBeenCalled();
      });
    });

    it('should handle websocket COMPLETED status with failure', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate STARTED
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
        }
      });

      // Simulate COMPLETED with failure
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'COMPLETED',
              result: mockCSVImportResultFailure,
              error: null,
            })
          );
        }
      });

      // Should reset to upload step
      await waitFor(() => {
        expect(screen.getByTestId('upload-file')).toBeInTheDocument();
      });
    });

    it('should handle websocket COMPLETED status with aborted', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate STARTED
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
        }
      });

      // Simulate COMPLETED with aborted
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'COMPLETED',
              result: mockCSVImportResultAborted,
              error: null,
            })
          );
        }
      });

      // Should show abort reason
      await waitFor(() => {
        expect(screen.getByTestId('abort-reason')).toBeInTheDocument();
        expect(
          screen.getByText(mockCSVImportResultAborted.abortReason)
        ).toBeInTheDocument();
      });
    });

    it('should handle websocket FAILED status', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate STARTED
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
        }
      });

      // Simulate FAILED
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'FAILED',
              error: 'Processing failed',
            })
          );
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('banner')).toBeInTheDocument();
      });
    });

    it('should ignore websocket messages without jobId', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              status: 'COMPLETED',
              result: mockCSVImportResult,
              error: null,
            })
          );
        }
      });

      // Should not process the message
      expect(mockReadString).not.toHaveBeenCalled();
    });

    it('should ignore websocket messages for different jobs', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate STARTED with job-1
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'job-1',
              status: 'STARTED',
              error: null,
            })
          );
        }
      });

      // Clear mock calls
      mockReadString.mockClear();

      // Simulate COMPLETED for different job (job-2)
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'job-2',
              status: 'COMPLETED',
              result: mockCSVImportResult,
              error: null,
            })
          );
        }
      });

      // Should not process the message
      expect(mockReadString).not.toHaveBeenCalled();
    });
  });

  describe('Conditional & Edge Logic', () => {
    it('should show abort reason when validation is aborted', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate aborted result
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'COMPLETED',
              result: mockCSVImportResultAborted,
              error: null,
            })
          );
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('abort-reason')).toBeInTheDocument();
        expect(
          screen.getByText('CSV file contains invalid data')
        ).toBeInTheDocument();
      });
    });

    it('should handle retry after abort', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate aborted result
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'COMPLETED',
              result: mockCSVImportResultAborted,
              error: null,
            })
          );
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('cancel-button');
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      // Should return to upload step
      await waitFor(() => {
        expect(screen.getByTestId('upload-file')).toBeInTheDocument();
      });
    });

    it('should call isBulkEditRoute to determine route type', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockIsBulkEditRoute).toHaveBeenCalled();
      });

      // Should show regular import UI when not bulk edit
      expect(screen.getByTestId('stepper')).toBeInTheDocument();
    });
  });

  describe('Negative & Failure Scenarios', () => {
    it('should handle network error during entity fetch', async () => {
      const networkError = new Error('Network request failed');
      mockGetEntityByFqn.mockRejectedValue(networkError);

      renderComponent();

      // Component should render without crashing despite network error
      await waitFor(() => {
        expect(screen.getByTestId('page-layout')).toBeInTheDocument();
      });

      expect(screen.getByTestId('upload-file')).toBeInTheDocument();
    });

    it('should handle invalid CSV data', async () => {
      const invalidCSVError = new Error('Invalid CSV format');
      mockValidateCsvString.mockRejectedValue(invalidCSVError);

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(invalidCSVError);
      });
    });

    it('should handle malformed websocket response', async () => {
      renderComponent();

      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      });

      // Send invalid JSON
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          expect(() => {
            socketCallback('invalid json {');
          }).toThrow();
        }
      });

      // Component should not crash
      expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    });

    it('should handle empty CSV file', async () => {
      mockGetEntityColumnsAndDataSourceFromCSV.mockReturnValue({
        columns: [],
        dataSource: [],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Should handle gracefully
      expect(screen.getByTestId('page-layout')).toBeInTheDocument();
    });

    it('should handle API validation error', async () => {
      const apiError = new Error('Validation API failed');
      const mockValidateAPI = jest.fn().mockRejectedValue(apiError);
      mockGetImportValidateAPIEntityType.mockReturnValue(mockValidateAPI);

      renderComponent();

      // First upload CSV to move to edit step
      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate successful initial load
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
          socketCallback(JSON.stringify(mockWebSocketResponse));
        }
      });

      // Trigger CSV read completion
      await act(async () => {
        const readStringCall = mockReadString.mock.calls[0];
        if (readStringCall && readStringCall[1]?.complete) {
          readStringCall[1].complete({
            data: [
              ['name', 'description'],
              ['row1', 'desc1'],
            ],
          });
        }
      });

      // Should show data grid
      await waitFor(() => {
        expect(screen.getByTestId('data-grid')).toBeInTheDocument();
      });

      // Click next/validate button
      const nextButton = screen.getByText('label.next');
      await act(async () => {
        fireEvent.click(nextButton);
      });

      await waitFor(() => {
        expect(mockShowErrorToast).toHaveBeenCalledWith(apiError);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible upload button', async () => {
      renderComponent();

      await waitFor(() => {
        const uploadButton = screen.getByTestId('upload-csv-button');

        expect(uploadButton).toBeInTheDocument();
        expect(uploadButton).toHaveTextContent('Upload CSV');
      });
    });

    it('should have navigation buttons in edit step', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId('upload-csv-button')).toBeInTheDocument();
      });

      const uploadButton = screen.getByTestId('upload-csv-button');
      await act(async () => {
        fireEvent.click(uploadButton);
      });

      // Simulate move to edit step
      await act(async () => {
        const socketCallback = mockSocket.on.mock.calls.find(
          (call) => call[0] === 'csvImportChannel'
        )?.[1];

        if (socketCallback) {
          socketCallback(
            JSON.stringify({
              jobId: 'test-job-id',
              status: 'STARTED',
              error: null,
            })
          );
          socketCallback(JSON.stringify(mockWebSocketResponse));
        }
      });

      await act(async () => {
        const readStringCall = mockReadString.mock.calls[0];
        if (readStringCall && readStringCall[1]?.complete) {
          readStringCall[1].complete({
            data: [
              ['name', 'description'],
              ['row1', 'desc1'],
            ],
          });
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('data-grid')).toBeInTheDocument();
      });

      // Should have navigation buttons
      expect(screen.getByText('label.previous')).toBeInTheDocument();
      expect(screen.getByText('label.next')).toBeInTheDocument();
    });
  });
});
