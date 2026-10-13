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

/*
 * OSS workflow capability gating, rendered with the real WorkflowModeProvider and the
 * unmocked OSS `workflowClassBase` so a capability flip in either surfaces here.
 */

import { render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Node } from 'reactflow';
import {
  useWorkflowModeContext,
  WorkflowModeProvider,
} from '../../../contexts/WorkflowModeContext';
import { NodeSubType } from '../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../generated/governance/workflows/elements/nodeType';
import {
  Type,
  WorkflowDefinition,
} from '../../../generated/governance/workflows/workflowDefinition';
import { useWorkflowMode } from '../../../hooks/useWorkflowMode';
import { WorkflowTriggerFieldsConfig } from '../../../rest/metadataTypeAPI';
import { NodeFormSidebar } from './NodeFormSidebar';
import { WorkflowHeader } from './WorkflowHeader';

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  InfoCircle: () => null,
  Plus: () => null,
  XClose: () => null,
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getCustomPropertiesByEntityType: jest.fn().mockResolvedValue([]),
}));

jest.mock(
  '../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  })
);

type Mode = 'view' | 'edit';

const WORKFLOW_FQN = 'pw-oss-test-workflow';

const eventBasedWorkflow = {
  name: WORKFLOW_FQN,
  trigger: {
    type: Type.EventBasedEntity,
    config: {
      entityTypes: ['table'],
      events: ['Created'],
      exclude: [],
      include: [],
      filter: {},
    },
    output: ['relatedEntity', 'updatedBy'],
  },
  nodes: [],
  edges: [],
} as unknown as WorkflowDefinition;

const periodicWorkflow = {
  name: 'pw-oss-periodic-workflow',
  trigger: {
    type: Type.PeriodicBatchEntity,
    config: {
      entityTypes: ['table'],
      schedule: { scheduleTimeline: 'None', cronExpression: '' },
    },
    output: ['relatedEntity'],
  },
  nodes: [],
  edges: [],
} as unknown as WorkflowDefinition;

const triggerFieldsConfig: WorkflowTriggerFieldsConfig = {
  common: ['description', 'owners'],
  entitySpecific: { table: ['columns'] },
};

const startNode = {
  id: 'Start',
  type: NodeType.StartEvent,
  position: { x: 0, y: 0 },
  data: {
    label: 'Start',
    displayName: 'Start',
    subType: NodeSubType.StartEvent,
  },
} as Node;

const approvalTaskNode = {
  id: 'ApprovalTask',
  type: NodeType.UserTask,
  position: { x: 0, y: 0 },
  data: {
    label: 'Approval Task',
    displayName: 'Approval Task',
    subType: NodeSubType.UserApprovalTask,
    config: {
      assignees: { addReviewers: false, addOwners: false, candidates: [] },
      approvalThreshold: 1,
      rejectionThreshold: 1,
    },
  },
} as Node;

const renderInMode = (
  ui: React.ReactElement,
  mode: Mode,
  workflowDefinition: WorkflowDefinition = eventBasedWorkflow
) =>
  render(
    <MemoryRouter initialEntries={[`/?mode=${mode}`]}>
      <WorkflowModeProvider
        workflowDefinition={workflowDefinition}
        workflowFqn={workflowDefinition.name}>
        {ui}
      </WorkflowModeProvider>
    </MemoryRouter>
  );

// Mirrors WorkflowBuilder: reverting an edit session ends in enterViewMode().
const HeaderWithRevert = (
  props: Omit<
    React.ComponentProps<typeof WorkflowHeader>,
    'handleRevertAndCancel'
  >
) => {
  const { enterViewMode } = useWorkflowModeContext();

  return <WorkflowHeader {...props} handleRevertAndCancel={enterViewMode} />;
};

const headerProps = {
  title: 'OSS Test Workflow',
  workflowName: WORKFLOW_FQN,
  handleTestWorkflow: jest.fn(),
  handleSaveWorkflow: jest.fn().mockResolvedValue(undefined),
  handleDeleteWorkflow: jest.fn(),
  handleRunWorkflow: jest.fn(),
};

const renderNodeSidebar = (
  node: Node,
  mode: Mode,
  workflowDefinition: WorkflowDefinition = eventBasedWorkflow,
  handlers = { onClose: jest.fn(), onSave: jest.fn() }
) => {
  renderInMode(
    <NodeFormSidebar
      isOpen
      node={node}
      setEdges={jest.fn()}
      setNodes={jest.fn()}
      triggerFieldsConfig={triggerFieldsConfig}
      workflowDefinition={workflowDefinition}
      onClose={handlers.onClose}
      onSave={handlers.onSave}
    />,
    mode,
    workflowDefinition
  );

  return { sidebar: screen.getByTestId('node-config-sidebar'), ...handlers };
};

const getField = (sidebar: HTMLElement, testId: string, selector: string) => {
  const field = within(sidebar)
    .getByTestId(testId)
    .querySelector<HTMLElement>(selector);

  expect(field).not.toBeNull();

  return field as HTMLElement;
};

describe('OSS workflow capabilities', () => {
  describe('mode state from OSS capabilities', () => {
    const renderMode = (mode: Mode) =>
      renderHook(() => useWorkflowMode(WORKFLOW_FQN, eventBasedWorkflow), {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={[`/?mode=${mode}`]}>
            {children}
          </MemoryRouter>
        ),
      }).result.current;

    it('hides the node palette and blocks structural graph edits in edit mode', () => {
      const state = renderMode('edit');

      expect(state.canAccessSidebar).toBe(true);
      expect(state.showWorkflowNodePalette).toBe(false);
      expect(state.allowStructuralGraphEdits).toBe(false);
      expect(state.canDragNodes).toBe(false);
    });

    it('never exposes workflow deletion', () => {
      expect(renderMode('view').canDelete).toBe(false);
      expect(renderMode('view').showDeleteButton).toBe(false);
    });
  });

  describe('workflow header', () => {
    it('view mode shows edit; delete and run are absent', () => {
      renderInMode(<HeaderWithRevert {...headerProps} />, 'view');

      expect(screen.getByTestId('edit-workflow-button')).toBeInTheDocument();
      expect(
        screen.queryByTestId('delete-workflow-button')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('run-workflow-button')
      ).not.toBeInTheDocument();
    });

    it('edit mode shows save, cancel and validate; delete is absent', () => {
      renderInMode(<HeaderWithRevert {...headerProps} />, 'edit');

      expect(screen.getByTestId('save-workflow-button')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-workflow-button')).toBeInTheDocument();
      expect(screen.getByTestId('test-workflow-button')).toBeInTheDocument();
      expect(
        screen.queryByTestId('delete-workflow-button')
      ).not.toBeInTheDocument();
    });

    it('cancel opens the discard modal; close-without-saving returns to view mode', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderInMode(<HeaderWithRevert {...headerProps} />, 'edit');

      await user.click(screen.getByTestId('cancel-workflow-button'));

      expect(
        await screen.findByTestId('close-without-saving-button')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('save-workflow-cancel-modal-button')
      ).toBeInTheDocument();

      await user.click(screen.getByTestId('close-without-saving-button'));

      expect(
        await screen.findByTestId('edit-workflow-button')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('save-workflow-button')
      ).not.toBeInTheDocument();
    });
  });

  describe('task node config sidebar', () => {
    it('view mode is read-only: no save or delete-node buttons', () => {
      const { sidebar } = renderNodeSidebar(approvalTaskNode, 'view');

      expect(
        within(sidebar).queryByTestId('save-node-configuration-button')
      ).not.toBeInTheDocument();
      expect(
        within(sidebar).queryByTestId('delete-node-button')
      ).not.toBeInTheDocument();
    });

    it('edit mode enables save but never offers delete-node', () => {
      const { sidebar } = renderNodeSidebar(approvalTaskNode, 'edit');

      expect(
        within(sidebar).getByTestId('save-node-configuration-button')
      ).toBeEnabled();
      expect(
        within(sidebar).queryByTestId('delete-node-button')
      ).not.toBeInTheDocument();
    });

    it('saving the node config hands the edited threshold to onSave and closes', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const { sidebar, onSave, onClose } = renderNodeSidebar(
        approvalTaskNode,
        'edit'
      );
      const threshold = getField(
        sidebar,
        'user-approval-approval-threshold-label',
        'input'
      );

      await user.clear(threshold);
      await user.type(threshold, '2');
      await user.click(
        within(sidebar).getByTestId('save-node-configuration-button')
      );

      expect(onSave).toHaveBeenCalledWith(
        'ApprovalTask',
        expect.objectContaining({
          config: expect.objectContaining({ approvalThreshold: 2 }),
        })
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('start node config (event-based)', () => {
    it.each([
      ['workflow-name-input', 'input'],
      ['data-asset', 'input'],
      ['trigger-type-select', 'button'],
      ['event-type-select', 'input'],
    ])('%s is disabled', (testId, selector) => {
      const { sidebar } = renderNodeSidebar(startNode, 'edit');

      expect(getField(sidebar, testId, selector)).toBeDisabled();
    });

    it.each([
      ['workflow-description-input', 'textarea'],
      ['include-fields-select', 'input'],
      ['exclude-fields-select', 'input'],
    ])('%s is enabled', (testId, selector) => {
      const { sidebar } = renderNodeSidebar(startNode, 'edit');

      expect(getField(sidebar, testId, selector)).toBeEnabled();
    });

    it('add-event-filter-button is enabled', () => {
      const { sidebar } = renderNodeSidebar(startNode, 'edit');

      expect(
        within(sidebar).getByTestId('add-event-filter-button')
      ).toBeEnabled();
    });
  });

  describe('start node config (periodic-batch)', () => {
    it('schedule-type-select is disabled', () => {
      const { sidebar } = renderNodeSidebar(
        startNode,
        'edit',
        periodicWorkflow
      );

      expect(
        getField(sidebar, 'schedule-type-select', 'button')
      ).toBeDisabled();
    });

    it('batch-size-input is enabled', () => {
      const { sidebar } = renderNodeSidebar(
        startNode,
        'edit',
        periodicWorkflow
      );

      expect(getField(sidebar, 'batch-size-input', 'input')).toBeEnabled();
    });
  });
});
