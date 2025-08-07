/*
 *  Copyright 2024 Collate.
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

import { act, render, screen, waitFor } from '@testing-library/react';
import { GlossaryTerm } from '../../../../../generated/entity/data/glossaryTerm';
import {
  WorkflowInstanceState,
  WorkflowStatus,
} from '../../../../../generated/governance/workflows/workflowInstanceState';
import WorkflowHistory from './WorkflowHistory.component';

// Import mocked modules
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../../../../rest/workflowAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
  getShortRelativeTime,
} from '../../../../../utils/date-time/DateTimeUtils';
import { createGlossaryTermEntityLink } from '../../../../../utils/GlossaryTerm/GlossaryTermUtil';
import { showErrorToast } from '../../../../../utils/ToastUtils';
import { useGenericContext } from '../../../../Customization/GenericProvider/GenericProvider';

// Mock dependencies
jest.mock('../../../../Customization/GenericProvider/GenericProvider');
jest.mock('../../../../../rest/workflowAPI');
jest.mock('../../../../../utils/ToastUtils');
jest.mock('../../../../../utils/date-time/DateTimeUtils');
jest.mock('../../../../../utils/GlossaryTerm/GlossaryTermUtil');

// Mock SVG components
jest.mock('../../../../../assets/svg/ic-check-circle-new.svg', () => ({
  ReactComponent: ({
    'data-testid': testId,
  }: {
    'data-testid'?: string;
    [key: string]: unknown;
  }) => <div data-testid={testId} />,
}));

jest.mock('../../../../../assets/svg/pending-badge.svg', () => ({
  ReactComponent: ({
    'data-testid': testId,
  }: {
    'data-testid'?: string;
    [key: string]: unknown;
  }) => <div data-testid={testId} />,
}));

const mockGlossaryTerm: GlossaryTerm = {
  id: 'test-glossary-term-id',
  name: 'TestTerm',
  fullyQualifiedName: 'Business Glossary.TestTerm',
  displayName: 'Test Term',
  description: 'A test glossary term',
  glossary: {
    id: 'test-glossary-id',
    type: 'glossary',
    name: 'Business Glossary',
    fullyQualifiedName: 'Business Glossary',
  },
  version: 1.0,
  updatedAt: 1647931273177,
  updatedBy: 'testuser',
  deleted: false,
  children: [],
};

const mockWorkflowHistory: WorkflowInstanceState[] = [
  {
    id: 'workflow-1',
    status: WorkflowStatus.Finished,
    timestamp: 1647931273177,
    stage: {
      name: 'approval-stage',
      displayName: 'Approval Stage',
    },
  },
  {
    id: 'workflow-2',
    status: WorkflowStatus.Running,
    timestamp: 1647931273000,
    stage: {
      name: 'review-stage',
      displayName: 'Review Stage',
    },
  },
  {
    id: 'workflow-3',
    status: WorkflowStatus.Exception,
    timestamp: 1647931272000,
    stage: {
      name: 'initial-stage',
      displayName: 'Initial Stage',
    },
  },
];

const mockWorkflowInstances = {
  data: [
    {
      id: 'instance-1',
      workflowDefinitionName: 'GlossaryTermApprovalWorkflow',
    },
  ],
};

const mockWorkflowInstanceState = {
  data: mockWorkflowHistory,
};

// Mock implementation setup
(useGenericContext as jest.Mock).mockReturnValue({ data: undefined });

// Use immediate resolution to avoid loading state issues
(getWorkflowInstancesForApplication as jest.Mock).mockResolvedValue(
  mockWorkflowInstances
);
(getWorkflowInstanceStateById as jest.Mock).mockResolvedValue(
  mockWorkflowInstanceState
);

(getCurrentMillis as jest.Mock).mockReturnValue(1647931273177);
(getEpochMillisForPastDays as jest.Mock).mockReturnValue(1647931273000);
(getShortRelativeTime as jest.Mock).mockImplementation(
  (timestamp: number) => `${timestamp} ago`
);
(createGlossaryTermEntityLink as jest.Mock).mockReturnValue('entity-link');
(showErrorToast as jest.Mock).mockImplementation(() => undefined);

// Mock translation
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { entity?: string }) => {
      if (options?.entity) {
        return `No ${options.entity} available`;
      }
      switch (key) {
        case 'label.workflow-history':
          return 'Workflow History';
        case 'label.no-entity-available':
          return 'No Workflow History available';
        default:
          return key;
      }
    },
  }),
}));

describe('WorkflowHistory Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default mock values
    (getWorkflowInstancesForApplication as jest.Mock).mockResolvedValue(
      mockWorkflowInstances
    );
    (getWorkflowInstanceStateById as jest.Mock).mockResolvedValue(
      mockWorkflowInstanceState
    );
  });

  describe('Rendering', () => {
    it('should render empty state when no workflow history exists', async () => {
      (getWorkflowInstancesForApplication as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(
          screen.getByText('No Workflow History available')
        ).toBeInTheDocument();
      });
    });

    it('should render workflow history when data exists', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Workflow History')).toBeInTheDocument();
        expect(screen.getByText('1/3')).toBeInTheDocument(); // completedSteps/totalSteps
        expect(screen.getByText('Approval Stage')).toBeInTheDocument();
        expect(screen.getByText('Review Stage')).toBeInTheDocument();
        expect(screen.getByText('Initial Stage')).toBeInTheDocument();
      });
    });

    it('should use context glossary term when prop is not provided', async () => {
      (useGenericContext as jest.Mock).mockReturnValueOnce({
        data: mockGlossaryTerm,
      });

      await act(async () => {
        render(<WorkflowHistory />);
      });

      await waitFor(() => {
        expect(getWorkflowInstancesForApplication).toHaveBeenCalledWith({
          startTs: expect.any(Number),
          endTs: expect.any(Number),
          entityLink: 'entity-link',
          workflowDefinitionName: 'GlossaryTermApprovalWorkflow',
        });
      });
    });

    it('should not fetch data when no glossary term is available', async () => {
      (useGenericContext as jest.Mock).mockReturnValueOnce({ data: undefined });

      await act(async () => {
        render(<WorkflowHistory />);
      });

      expect(getWorkflowInstancesForApplication).not.toHaveBeenCalled();
    });
  });

  describe('Status Icons', () => {
    it('should render completed icon for finished status', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('completed-icon')).toBeInTheDocument();
      });
    });

    it('should render pending icon for non-finished statuses', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        const pendingIcons = screen.getAllByTestId('pending-icon');

        expect(pendingIcons).toHaveLength(2); // Running and Exception statuses
      });
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate correct completed steps', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        // Only 1 workflow with Finished status out of 3 total
        expect(screen.getByText('1/3')).toBeInTheDocument();
      });
    });

    it('should handle all completed workflows', async () => {
      const allCompletedHistory = mockWorkflowHistory.map((item) => ({
        ...item,
        status: WorkflowStatus.Finished,
      }));

      (getWorkflowInstanceStateById as jest.Mock).mockResolvedValueOnce({
        data: allCompletedHistory,
      });

      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(screen.getByText('3/3')).toBeInTheDocument();
      });
    });

    it('should handle no completed workflows', async () => {
      const noCompletedHistory = mockWorkflowHistory.map((item) => ({
        ...item,
        status: WorkflowStatus.Running,
      }));

      (getWorkflowInstanceStateById as jest.Mock).mockResolvedValueOnce({
        data: noCompletedHistory,
      });

      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(screen.getByText('0/3')).toBeInTheDocument();
      });
    });
  });

  describe('API Calls', () => {
    it('should call workflow APIs with correct parameters', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(getWorkflowInstancesForApplication).toHaveBeenCalledWith({
          startTs: expect.any(Number),
          endTs: expect.any(Number),
          entityLink: 'entity-link',
          workflowDefinitionName: 'GlossaryTermApprovalWorkflow',
        });

        expect(getWorkflowInstanceStateById).toHaveBeenCalledWith(
          'GlossaryTermApprovalWorkflow',
          'instance-1',
          {
            startTs: expect.any(Number),
            endTs: expect.any(Number),
          }
        );
      });
    });

    it('should create correct entity link', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(createGlossaryTermEntityLink).toHaveBeenCalledWith(
          'Business Glossary.TestTerm'
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const errorMessage = 'API Error';
      (getWorkflowInstancesForApplication as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error));
      });

      // Should render empty state after error
      expect(
        screen.getByText('No Workflow History available')
      ).toBeInTheDocument();
    });

    it('should handle workflow instance state API errors', async () => {
      (getWorkflowInstanceStateById as jest.Mock).mockRejectedValueOnce(
        new Error('State API Error')
      );

      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('Timeline Rendering', () => {
    it('should render timeline items with correct information', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(screen.getByText('Approval Stage')).toBeInTheDocument();
        expect(screen.getByText('Review Stage')).toBeInTheDocument();
        expect(screen.getByText('Initial Stage')).toBeInTheDocument();

        // Check that relative times are displayed
        expect(screen.getByText('1647931273177 ago')).toBeInTheDocument();
        expect(screen.getByText('1647931273000 ago')).toBeInTheDocument();
        expect(screen.getByText('1647931272000 ago')).toBeInTheDocument();
      });
    });

    it('should render stage name when displayName is not available', async () => {
      const historyWithoutDisplayName = [
        {
          ...mockWorkflowHistory[0],
          stage: {
            name: 'stage-name-only',
          },
        },
      ];

      (getWorkflowInstanceStateById as jest.Mock).mockResolvedValueOnce({
        data: historyWithoutDisplayName,
      });

      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        expect(screen.getByText('stage-name-only')).toBeInTheDocument();
      });
    });
  });

  describe('Workflow Steps', () => {
    it('should render correct number of workflow steps', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        const workflowSteps = screen
          .getByText('Workflow History')
          .closest('.workflow-history-widget')
          ?.querySelectorAll('.workflow-step');

        expect(workflowSteps).toHaveLength(3);
      });
    });

    it('should mark completed steps correctly', async () => {
      await act(async () => {
        render(<WorkflowHistory glossaryTerm={mockGlossaryTerm} />);
      });

      await waitFor(() => {
        const workflowWidget = screen
          .getByText('Workflow History')
          .closest('.workflow-history-widget');
        const completedSteps = workflowWidget?.querySelectorAll(
          '.workflow-step.completed'
        );
        const pendingSteps = workflowWidget?.querySelectorAll(
          '.workflow-step.pending'
        );

        expect(completedSteps).toHaveLength(1);
        expect(pendingSteps).toHaveLength(2);
      });
    });
  });
});
