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
import React from 'react';
import { TestSuite } from '../../../generated/tests/testSuite';
import {
  addIngestionPipeline,
  deployIngestionPipelineById,
} from '../../../rest/ingestionPipelineAPI';
import {
  addTestCasesToLogicalTestSuiteBulk,
  createTestSuites,
} from '../../../rest/testAPI';
import * as ToastUtils from '../../../utils/ToastUtils';
import BundleSuiteFormDrawer from './BundleSuiteFormDrawer';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('../../../rest/testAPI', () => ({
  createTestSuites: jest.fn(),
  addTestCasesToLogicalTestSuiteBulk: jest.fn(),
}));

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  addIngestionPipeline: jest.fn(),
  deployIngestionPipelineById: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'user-1', name: 'tester' },
  }),
}));

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockReturnValue({ isAirflowAvailable: true }),
  })
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      ingestionPipeline: { Create: true },
    },
  }),
}));

// Mock BundleSuiteFormBody so tests can drive form values directly
jest.mock('./BundleSuiteFormBody', () => ({
  __esModule: true,
  default: jest.fn(({ errorMessage }: { errorMessage?: string }) => (
    <div data-testid="bundle-suite-form-body">
      {errorMessage && <div data-testid="error-message">{errorMessage}</div>}
    </div>
  )),
}));

// Minimal useFormDrawerWithHook mock: renders form content and exposes a submit
// trigger so tests can exercise the submit path without real Drawer chrome.
let capturedOnSubmit: ((data: unknown) => Promise<void>) | undefined;
let capturedOnCancel: (() => void) | undefined;

jest.mock('../../common/atoms/drawer/useFormDrawer', () => ({
  useFormDrawerWithHook: jest.fn(
    ({
      form: formNode,
      onSubmit,
      onCancel,
    }: {
      form: React.ReactNode;
      onSubmit: (data: unknown) => Promise<void>;
      onCancel?: () => void;
    }) => {
      capturedOnSubmit = onSubmit;
      capturedOnCancel = onCancel;

      return {
        formDrawer: (
          <div data-testid="form-drawer">
            {formNode}
            <button
              data-testid="trigger-submit"
              onClick={() => capturedOnSubmit?.({})}>
              submit
            </button>
            <button
              data-testid="trigger-cancel"
              onClick={() => capturedOnCancel?.()}>
              cancel
            </button>
          </div>
        ),
        openDrawer: jest.fn(),
        // Mirror useCompositeDrawer.closeDrawer: it fires onBeforeClose (= onCancel)
        // on every programmatic close, including the success path.
        closeDrawer: jest.fn(() => onCancel?.()),
        isOpen: false,
        isSubmitting: false,
        toggleDrawer: jest.fn(),
      };
    }
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockTestSuite: TestSuite = {
  id: 'ts-1',
  name: 'my-suite',
  fullyQualifiedName: 'my-suite',
};

const mockCreateTestSuites = createTestSuites as jest.Mock;
const mockAddBulk = addTestCasesToLogicalTestSuiteBulk as jest.Mock;
const mockAddIngestionPipeline = addIngestionPipeline as jest.Mock;
const mockDeployPipeline = deployIngestionPipelineById as jest.Mock;
const mockShowSuccessToast = ToastUtils.showSuccessToast as jest.Mock;

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  onSuccess: jest.fn(),
};

const renderDrawer = (
  props: Partial<React.ComponentProps<typeof BundleSuiteFormDrawer>> = {}
) => render(<BundleSuiteFormDrawer {...defaultProps} {...props} />);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BundleSuiteFormDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnSubmit = undefined;
    capturedOnCancel = undefined;
    mockCreateTestSuites.mockResolvedValue(mockTestSuite);
    mockAddBulk.mockResolvedValue({});
    mockAddIngestionPipeline.mockResolvedValue({ id: 'pipe-1' });
    mockDeployPipeline.mockResolvedValue({});
  });

  it('wires onCancel to onClose so cancel/X notifies the parent exactly once', async () => {
    const onClose = jest.fn();
    await act(async () => {
      renderDrawer({ onClose });
    });

    expect(capturedOnCancel).toBeDefined();

    await act(async () => {
      capturedOnCancel?.();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose exactly once on a successful submit', async () => {
    const onClose = jest.fn();
    await act(async () => {
      renderDrawer({ onClose });
    });

    await act(async () => {
      await capturedOnSubmit?.({
        name: 'my-suite',
        testCaseSelection: { selectAll: true, includeIds: [], excludeIds: [] },
        enableScheduler: false,
      });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('renders the form drawer and body when open is true', async () => {
    await act(async () => {
      renderDrawer();
    });

    expect(screen.getByTestId('form-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('bundle-suite-form-body')).toBeInTheDocument();
  });

  it('calls createTestSuites then addTestCasesToLogicalTestSuiteBulk on submit', async () => {
    await act(async () => {
      renderDrawer();
    });

    const formValues = {
      name: 'my-suite',
      testCaseSelection: {
        selectAll: false,
        includeIds: ['tc-1'],
        excludeIds: [],
      },
      enableScheduler: false,
    };

    await act(async () => {
      await capturedOnSubmit?.(formValues);
    });

    await waitFor(() => {
      expect(mockCreateTestSuites).toHaveBeenCalledTimes(1);
      expect(mockAddBulk).toHaveBeenCalledWith('ts-1', {
        selectAll: false,
        includeIds: ['tc-1'],
        excludeIds: [],
      });
    });
  });

  it('calls onSuccess and shows success toast after successful submit', async () => {
    const onSuccess = jest.fn();
    await act(async () => {
      renderDrawer({ onSuccess });
    });

    const formValues = {
      name: 'my-suite',
      testCaseSelection: {
        selectAll: false,
        includeIds: ['tc-1'],
        excludeIds: [],
      },
      enableScheduler: false,
    };

    await act(async () => {
      await capturedOnSubmit?.(formValues);
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockTestSuite);
      expect(mockShowSuccessToast).toHaveBeenCalled();
    });
  });

  it('calls addIngestionPipeline and deployIngestionPipelineById when enableScheduler is true and Create permission exists', async () => {
    await act(async () => {
      renderDrawer();
    });

    const formValues = {
      name: 'my-suite',
      testCaseSelection: {
        selectAll: true,
        includeIds: [],
        excludeIds: [],
      },
      enableScheduler: true,
      cron: '0 0 * * *',
      enableDebugLog: false,
      raiseOnError: true,
    };

    await act(async () => {
      await capturedOnSubmit?.(formValues);
    });

    await waitFor(() => {
      expect(mockAddIngestionPipeline).toHaveBeenCalledTimes(1);
      expect(mockDeployPipeline).toHaveBeenCalledWith('pipe-1');
    });
  });

  it('does not call addIngestionPipeline when enableScheduler is false', async () => {
    await act(async () => {
      renderDrawer();
    });

    const formValues = {
      name: 'my-suite',
      testCaseSelection: {
        selectAll: true,
        includeIds: [],
        excludeIds: [],
      },
      enableScheduler: false,
    };

    await act(async () => {
      await capturedOnSubmit?.(formValues);
    });

    await waitFor(() => {
      expect(mockAddIngestionPipeline).not.toHaveBeenCalled();
      expect(mockDeployPipeline).not.toHaveBeenCalled();
    });
  });

  it('does not deploy pipeline when airflow is not available', async () => {
    const { useAirflowStatus } = jest.requireMock(
      '../../../context/AirflowStatusProvider/AirflowStatusProvider'
    );
    (useAirflowStatus as jest.Mock).mockReturnValue({
      isAirflowAvailable: false,
    });

    await act(async () => {
      renderDrawer();
    });

    const formValues = {
      name: 'my-suite',
      testCaseSelection: { selectAll: true, includeIds: [], excludeIds: [] },
      enableScheduler: true,
      cron: '0 0 * * *',
    };

    await act(async () => {
      await capturedOnSubmit?.(formValues);
    });

    await waitFor(() => {
      expect(mockAddIngestionPipeline).toHaveBeenCalledTimes(1);
      expect(mockDeployPipeline).not.toHaveBeenCalled();
    });
  });

  it('keeps drawer open and shows error message when createTestSuites rejects', async () => {
    mockCreateTestSuites.mockRejectedValue({
      response: { data: { message: 'Suite already exists' } },
    });
    const onClose = jest.fn();
    const onSuccess = jest.fn();

    await act(async () => {
      renderDrawer({ onClose, onSuccess });
    });

    const formValues = {
      name: 'my-suite',
      testCaseSelection: { selectAll: true, includeIds: [], excludeIds: [] },
      enableScheduler: false,
    };

    let threw = false;
    await act(async () => {
      try {
        await capturedOnSubmit?.(formValues);
      } catch {
        threw = true;
      }
    });

    await waitFor(() => {
      expect(threw).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
      expect(screen.getByTestId('error-message')).toHaveTextContent(
        'Suite already exists'
      );
    });
  });

  it('shows a pipeline error toast but still calls onSuccess when pipeline creation fails', async () => {
    mockAddIngestionPipeline.mockRejectedValue(new Error('pipe error'));
    const onSuccess = jest.fn();

    await act(async () => {
      renderDrawer({ onSuccess });
    });

    const formValues = {
      name: 'my-suite',
      testCaseSelection: { selectAll: true, includeIds: [], excludeIds: [] },
      enableScheduler: true,
      cron: '0 0 * * *',
    };

    await act(async () => {
      await capturedOnSubmit?.(formValues);
    });

    await waitFor(() => {
      expect(ToastUtils.showErrorToast).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(mockTestSuite);
    });
  });

  it('does not call addIngestionPipeline when ingestionPipeline.Create is false', async () => {
    const { usePermissionProvider } = jest.requireMock(
      '../../../context/PermissionProvider/PermissionProvider'
    );
    (usePermissionProvider as jest.Mock).mockReturnValue({
      permissions: { ingestionPipeline: { Create: false } },
    });

    await act(async () => {
      renderDrawer();
    });

    const formValues = {
      name: 'my-suite',
      testCaseSelection: { selectAll: true, includeIds: [], excludeIds: [] },
      enableScheduler: true,
    };

    await act(async () => {
      await capturedOnSubmit?.(formValues);
    });

    await waitFor(() => {
      expect(mockAddIngestionPipeline).not.toHaveBeenCalled();
    });
  });

  describe('ai variant', () => {
    it('renders a centered modal (role=dialog) instead of the slideout drawer when open', async () => {
      await act(async () => {
        renderDrawer({ variant: 'ai' });
      });

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('bundle-suite-form-body')).toBeInTheDocument();
      expect(screen.queryByTestId('form-drawer')).not.toBeInTheDocument();
    });

    it('renders the default ai header title', async () => {
      await act(async () => {
        renderDrawer({ variant: 'ai' });
      });

      await screen.findByRole('dialog');

      expect(screen.getByText('label.add-entity')).toBeInTheDocument();
    });

    it('does not render a Show Hint toggle in the bundle ai modal', async () => {
      await act(async () => {
        renderDrawer({ variant: 'ai' });
      });

      await screen.findByRole('dialog');

      expect(
        screen.queryByRole('switch', { name: 'label.show-hint' })
      ).not.toBeInTheDocument();
    });

    it('calls onClose exactly once when the cancel button is clicked', async () => {
      const onClose = jest.fn();
      await act(async () => {
        renderDrawer({ variant: 'ai', onClose });
      });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'label.cancel' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose exactly once when the X close button is clicked', async () => {
      const onClose = jest.fn();
      await act(async () => {
        renderDrawer({ variant: 'ai', onClose });
      });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls createTestSuites and onClose once on a successful submit', async () => {
      const onSuccess = jest.fn();
      const onClose = jest.fn();
      await act(async () => {
        renderDrawer({ variant: 'ai', onSuccess, onClose });
      });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'label.create' }));
      });

      await waitFor(() => {
        expect(mockCreateTestSuites).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockTestSuite);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('keeps the modal open and shows the inline error when createTestSuites rejects', async () => {
      mockCreateTestSuites.mockRejectedValue({
        response: { data: { message: 'Suite already exists' } },
      });
      const onClose = jest.fn();
      await act(async () => {
        renderDrawer({ variant: 'ai', onClose });
      });

      await screen.findByRole('dialog');

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'label.create' }));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent(
          'Suite already exists'
        );
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
