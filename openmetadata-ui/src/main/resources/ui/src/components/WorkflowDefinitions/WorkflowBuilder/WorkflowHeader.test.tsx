/*
 *  Copyright 2026 Collate.
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
import React from 'react';
import { useWorkflowModeContext } from '../../../contexts/WorkflowModeContext';
import { WorkflowHeader } from './WorkflowHeader';

jest.mock('../../../contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <span {...rest}>{children}</span>,
  Button: ({
    children,
    onPress,
    ...rest
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    [key: string]: unknown;
  }) => (
    <button onClick={onPress} {...rest}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="workflow-header">{children}</div>
  ),
  Dialog: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
  }) => (
    <div data-title={title}>
      {children}
    </div>
  ),
  Input: ({ label }: { label?: string }) => <input aria-label={label} />,
  Modal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ModalOverlay: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <>{children}</> : null),
  Tooltip: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
  }) => <div data-testid="tooltip" data-title={title}>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Typography: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <span {...rest}>{children}</span>,
}));

jest.mock('../../../assets/svg/edit-new.svg', () => ({
  ReactComponent: () => null,
}));

jest.mock('../../../assets/svg/workflow.svg', () => ({
  ReactComponent: () => null,
}));

jest.mock('./WorkflowControls', () => ({
  WorkflowControls: () => <div data-testid="workflow-controls" />,
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockUseWorkflowModeContext =
  useWorkflowModeContext as jest.MockedFunction<typeof useWorkflowModeContext>;

const defaultProps = {
  title: 'Glossary Approval Workflow',
  workflowName: 'GlossaryTermApprovalWorkflow',
  handleTestWorkflow: jest.fn(),
  handleSaveWorkflow: jest.fn().mockResolvedValue(undefined),
  handleDeleteWorkflow: jest.fn(),
  handleRevertAndCancel: jest.fn(),
};

const buildContextMock = (
  overrides: Partial<ReturnType<typeof useWorkflowModeContext>> = {}
): ReturnType<typeof useWorkflowModeContext> => ({
  isViewMode: true,
  isEditMode: false,
  isNoOp: false,
  mode: 'view',
  showEditButton: true,
  showSaveButton: false,
  showCancelButton: false,
  showTestButton: false,
  showDeleteButton: false,
  showRunButton: false,
  canEdit: false,
  canSave: false,
  canDelete: false,
  canDragNodes: false,
  canAccessSidebar: false,
  isFormDisabled: true,
  isInputDisabled: true,
  isDropdownDisabled: true,
  allowStructuralGraphEdits: false,
  showWorkflowNodePalette: false,
  allowFullStartNodeConfiguration: false,
  allowStartNodeFilterScheduleAndBatchEdit: false,
  allowScheduledTrigger: false,
  enterEditMode: jest.fn(),
  enterViewMode: jest.fn(),
  toggleMode: jest.fn(),
  ...overrides,
});

describe('WorkflowHeader — System badge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the workflow title and name', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(<WorkflowHeader {...defaultProps} />);

    expect(screen.getByTestId('workflow-title')).toHaveTextContent(
      'Glossary Approval Workflow'
    );
    expect(screen.getByTestId('workflow-description')).toHaveTextContent(
      'GlossaryTermApprovalWorkflow'
    );
  });

  it('shows the System badge when isNoOp is true', () => {
    mockUseWorkflowModeContext.mockReturnValue(
      buildContextMock({ isNoOp: true, showEditButton: false })
    );

    render(<WorkflowHeader {...defaultProps} />);

    expect(screen.getByTestId('system-workflow-badge')).toBeInTheDocument();
    expect(screen.getByTestId('system-workflow-badge')).toHaveTextContent(
      'label.system'
    );
  });

  it('wraps the System badge in a Tooltip with the restriction message', () => {
    mockUseWorkflowModeContext.mockReturnValue(
      buildContextMock({ isNoOp: true, showEditButton: false })
    );

    render(<WorkflowHeader {...defaultProps} />);

    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute(
      'data-title',
      'message.system-workflow-edit-restriction'
    );
  });

  it('does not show the System badge when isNoOp is false', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(<WorkflowHeader {...defaultProps} />);

    expect(
      screen.queryByTestId('system-workflow-badge')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('tooltip')).not.toBeInTheDocument();
  });

  it('hides the title-edit button when isNoOp is true', () => {
    mockUseWorkflowModeContext.mockReturnValue(
      buildContextMock({ isNoOp: true, isViewMode: false, isEditMode: true })
    );

    render(<WorkflowHeader {...defaultProps} />);

    expect(
      screen.queryByTestId('edit-workflow-title-button')
    ).not.toBeInTheDocument();
  });

  it('shows the title-edit button in edit mode when isNoOp is false', () => {
    mockUseWorkflowModeContext.mockReturnValue(
      buildContextMock({
        isNoOp: false,
        isViewMode: false,
        isEditMode: true,
      })
    );

    render(<WorkflowHeader {...defaultProps} />);

    expect(screen.getByTestId('edit-workflow-title-button')).toBeInTheDocument();
  });

  it('hides the title-edit button in view mode even when isNoOp is false', () => {
    mockUseWorkflowModeContext.mockReturnValue(
      buildContextMock({ isNoOp: false, isViewMode: true })
    );

    render(<WorkflowHeader {...defaultProps} />);

    expect(
      screen.queryByTestId('edit-workflow-title-button')
    ).not.toBeInTheDocument();
  });
});
