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

import { fireEvent, render, screen } from '@testing-library/react';
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
  ButtonUtility: ({
    tooltip,
    'data-testid': dataTestId,
  }: {
    tooltip?: string;
    'data-testid'?: string;
  }) => <button aria-label={tooltip} data-testid={dataTestId} />,
  Card: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="workflow-header">{children}</div>
  ),
  FeaturedIcon: jest.requireActual('@openmetadata/ui-core-components')
    .FeaturedIcon,
  Dialog: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
  }) => <div data-title={title}>{children}</div>,
  Dropdown: {
    Root: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Menu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Item: ({
      children,
      label,
      onAction,
      'data-testid': dataTestId,
    }: {
      children?: React.ReactNode;
      label?: string;
      onAction?: () => void;
      'data-testid'?: string;
    }) => (
      <button data-testid={dataTestId} onClick={onAction}>
        {label ?? children}
      </button>
    ),
  },
  Input: ({ label }: { label?: string }) => <input aria-label={label} />,
  Modal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ModalOverlay: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
  }) => (isOpen ? <>{children}</> : null),
  PageLayout: {
    PageHeader: ({
      actions,
      badge,
      breadcrumb,
      icon,
      subtitle,
      title,
      'data-testid': dataTestId,
    }: {
      actions?: React.ReactNode;
      badge?: React.ReactNode;
      breadcrumb?: React.ReactNode;
      icon?: React.ReactNode;
      subtitle?: React.ReactNode;
      title?: React.ReactNode;
      'data-testid'?: string;
    }) => (
      <div data-testid={dataTestId}>
        {breadcrumb}
        {icon}
        {title}
        {badge}
        {subtitle}
        {actions}
      </div>
    ),
  },
  Tooltip: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title?: string;
  }) => (
    <div data-testid="tooltip" data-title={title}>
      {children}
    </div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Typography: ({
    children,
    ellipsis,
    ...rest
  }: {
    children: React.ReactNode;
    ellipsis?: boolean | { tooltip?: boolean };
    [key: string]: unknown;
  }) => (
    <span
      data-ellipsis={ellipsis ? 'true' : undefined}
      data-ellipsis-tooltip={
        typeof ellipsis === 'object' && ellipsis.tooltip ? 'true' : undefined
      }
      {...rest}>
      {children}
    </span>
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  DotsVertical: () => null,
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
  canDragNodesInViewMode: false,
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

  it.each([false, true])(
    'truncates a long title with a full-text tooltip and keeps the actions from shrinking (isAiMode=%s)',
    (isAiMode) => {
      mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

      render(<WorkflowHeader {...defaultProps} isAiMode={isAiMode} />);

      const title = screen.getByTestId('workflow-title');

      expect(title).toHaveAttribute('data-ellipsis', 'true');
      expect(title).toHaveAttribute('data-ellipsis-tooltip', 'true');

      if (!isAiMode) {
        expect(screen.getByTestId('workflow-title-section')).toHaveClass(
          'tw:min-w-0'
        );
        expect(
          screen.getByTestId('edit-workflow-button').parentElement
        ).toHaveClass('tw:shrink-0');
      }
    }
  );

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

    expect(
      screen.getByTestId('edit-workflow-title-button')
    ).toBeInTheDocument();
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

  it('renders the AI-mode header with the breadcrumb when isAiMode is true', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(
      <WorkflowHeader
        {...defaultProps}
        isAiMode
        breadcrumb={<div data-testid="ai-breadcrumb">crumb</div>}
      />
    );

    expect(screen.getByTestId('ai-breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-title')).toHaveTextContent(
      'Glossary Approval Workflow'
    );
  });
});

describe('WorkflowHeader — editor link', () => {
  it('links to the editor that owns the workflow beside Edit Workflow', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(
      <WorkflowHeader
        {...defaultProps}
        editorLink={{
          path: '/workflows/lifecycle/domain',
          labelKey: 'label.edit-stages',
        }}
      />
    );

    expect(screen.getByTestId('workflow-editor-link')).toHaveTextContent(
      'label.edit-stages'
    );
    expect(screen.getByTestId('workflow-editor-link')).toHaveAttribute(
      'href',
      '/workflows/lifecycle/domain'
    );
  });

  it('shows no editor link for a workflow the builder owns', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(<WorkflowHeader {...defaultProps} />);

    expect(
      screen.queryByTestId('workflow-editor-link')
    ).not.toBeInTheDocument();
  });
});

describe('WorkflowHeader — actions variant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders only the controls, for a host page that shows the title', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(<WorkflowHeader {...defaultProps} variant="actions" />);

    expect(screen.getByTestId('workflow-header-actions')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-controls')).toBeInTheDocument();
    expect(screen.getByTestId('edit-workflow-button')).toBeInTheDocument();
    expect(screen.queryByTestId('workflow-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-header')).not.toBeInTheDocument();
  });
});

describe('WorkflowHeader — manage menu', () => {
  const handleToggleSuspend = jest.fn();
  const handleDeleteWorkflow = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers Suspend and a red Delete after Edit Workflow in view mode', () => {
    mockUseWorkflowModeContext.mockReturnValue(
      buildContextMock({ showDeleteButton: true })
    );

    render(
      <WorkflowHeader
        {...defaultProps}
        handleDeleteWorkflow={handleDeleteWorkflow}
        handleToggleSuspend={handleToggleSuspend}
      />
    );

    expect(screen.getByTestId('workflow-manage-button')).toBeInTheDocument();
    expect(
      screen
        .getByTestId('edit-workflow-button')
        .compareDocumentPosition(screen.getByTestId('workflow-manage-button'))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(screen.getByTestId('suspend-workflow-button'));

    expect(handleToggleSuspend).toHaveBeenCalledTimes(1);

    expect(screen.getByText('label.delete')).toHaveClass(
      'tw:text-error-primary'
    );

    fireEvent.click(screen.getByTestId('delete-workflow-button'));

    expect(handleDeleteWorkflow).toHaveBeenCalledTimes(1);
  });

  it('offers Resume for a suspended workflow', () => {
    mockUseWorkflowModeContext.mockReturnValue(
      buildContextMock({ showDeleteButton: true })
    );

    render(
      <WorkflowHeader
        {...defaultProps}
        isSuspended
        handleToggleSuspend={handleToggleSuspend}
      />
    );

    expect(screen.getByTestId('resume-workflow-button')).toHaveTextContent(
      'label.resume'
    );
    expect(
      screen.queryByTestId('suspend-workflow-button')
    ).not.toBeInTheDocument();
  });

  it('offers Suspend without Delete when the workflow cannot be deleted', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(
      <WorkflowHeader
        {...defaultProps}
        handleDeleteWorkflow={handleDeleteWorkflow}
        handleToggleSuspend={handleToggleSuspend}
      />
    );

    expect(screen.getByTestId('suspend-workflow-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('delete-workflow-button')
    ).not.toBeInTheDocument();
  });

  it('shows no menu outside view mode', () => {
    mockUseWorkflowModeContext.mockReturnValue(
      buildContextMock({ showEditButton: false })
    );

    render(
      <WorkflowHeader
        {...defaultProps}
        handleDeleteWorkflow={handleDeleteWorkflow}
        handleToggleSuspend={handleToggleSuspend}
      />
    );

    expect(
      screen.queryByTestId('workflow-manage-button')
    ).not.toBeInTheDocument();
  });
});

describe('WorkflowHeader — suspended badge', () => {
  it('shows a warning badge after the title for a suspended workflow', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(<WorkflowHeader {...defaultProps} isSuspended />);

    const badge = screen.getByTestId('workflow-suspended-badge');

    expect(badge).toHaveTextContent('label.suspended');
    expect(badge).toHaveAttribute('color', 'warning');
    expect(
      screen.getByTestId('workflow-title').compareDocumentPosition(badge)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('shows no badge for an active workflow', () => {
    mockUseWorkflowModeContext.mockReturnValue(buildContextMock());

    render(<WorkflowHeader {...defaultProps} />);

    expect(
      screen.queryByTestId('workflow-suspended-badge')
    ).not.toBeInTheDocument();
  });
});
