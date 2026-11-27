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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Node } from 'reactflow';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
import { EmptyAssigneeStrategy } from '../../../../generated/governance/workflows/elements/nodes/userTask/userApprovalTask';
import {
  Type,
  WorkflowDefinition,
} from '../../../../generated/governance/workflows/workflowDefinition';
import { UserApprovalForm } from './UserApprovalForm';

const node: Node = {
  id: 'Approve0',
  position: { x: 0, y: 0 },
  data: {
    displayName: 'Approval for In Review',
    config: {
      approvalThreshold: 1,
      rejectionThreshold: 1,
      taskStatus: 'Open',
      assignees: {
        addOwners: false,
        addReviewers: false,
        addDomainOwners: true,
        emptyAssigneeStrategy: 'wait',
        candidates: [],
      },
    },
  },
};

const nodeWithStrategy = (strategy?: EmptyAssigneeStrategy): Node => ({
  ...node,
  data: {
    ...node.data,
    config: {
      ...node.data.config,
      assignees: {
        ...node.data.config.assignees,
        emptyAssigneeStrategy: strategy,
      },
    },
  },
});

const renderForm = (
  formNode: Node,
  onSave = jest.fn(),
  url = '/?mode=edit',
  workflowDefinition?: WorkflowDefinition
) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <WorkflowModeProvider workflowDefinition={workflowDefinition}>
        <UserApprovalForm node={formNode} onClose={jest.fn()} onSave={onSave} />
      </WorkflowModeProvider>
    </MemoryRouter>
  );

const strategyTrigger = () =>
  within(
    screen.getByTestId('user-approval-empty-assignee-strategy-select')
  ).getByRole('button');

describe('UserApprovalForm', () => {
  it('keeps the settings it does not edit when it saves', () => {
    const onSave = jest.fn();
    renderForm(node, onSave);

    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(onSave).toHaveBeenCalledWith(
      'Approve0',
      expect.objectContaining({
        config: expect.objectContaining({
          taskStatus: 'Open',
          assignees: expect.objectContaining({
            addDomainOwners: true,
            emptyAssigneeStrategy: 'wait',
          }),
        }),
      })
    );
  });

  it.each([
    [
      EmptyAssigneeStrategy.None,
      'label.approve-automatically',
      'message.empty-assignee-strategy-none-hint',
    ],
    [
      EmptyAssigneeStrategy.AssignAdmins,
      'label.assign-to-admins',
      'message.empty-assignee-strategy-assign-admins-hint',
    ],
    [
      EmptyAssigneeStrategy.Wait,
      'label.keep-open-unassigned',
      'message.empty-assignee-strategy-wait-hint',
    ],
  ])(
    'shows the saved "%s" strategy and explains it',
    (strategy, label, hint) => {
      renderForm(nodeWithStrategy(strategy));

      expect(strategyTrigger()).toHaveTextContent(label);
      expect(screen.getByText(hint)).toBeInTheDocument();
    }
  );

  it('shows approve automatically when the step has no saved strategy', () => {
    renderForm(nodeWithStrategy(undefined));

    expect(strategyTrigger()).toHaveTextContent('label.approve-automatically');
  });

  it('says the setting also covers an approver who made the change', () => {
    renderForm(node);

    expect(
      screen.getByText('message.empty-assignee-strategy-description')
    ).toBeInTheDocument();
  });

  it('says a task workflow sends the default to the asset owners', () => {
    const taskWorkflow = {
      name: 'TagUpdateTaskWorkflow',
      description: 'Task workflow',
      trigger: { type: Type.NoOp },
    } as WorkflowDefinition;
    renderForm(
      nodeWithStrategy(undefined),
      jest.fn(),
      '/?mode=view',
      taskWorkflow
    );

    expect(strategyTrigger()).toHaveTextContent('label.go-to-asset-owners');
    expect(
      screen.getByText(
        'message.empty-assignee-strategy-none-task-workflow-hint'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.empty-assignee-strategy-none-hint')
    ).not.toBeInTheDocument();
  });

  it('lists the default option first', async () => {
    renderForm(node);

    fireEvent.click(strategyTrigger());
    await screen.findAllByRole('option');

    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual([
      'label.approve-automatically',
      'label.assign-to-admins',
      'label.keep-open-unassigned',
    ]);
  });

  it('saves the strategy picked in the form', async () => {
    const onSave = jest.fn();
    renderForm(nodeWithStrategy(EmptyAssigneeStrategy.None), onSave);

    fireEvent.click(strategyTrigger());
    const assignAdminsOption = await screen.findByRole('option', {
      name: 'label.assign-to-admins',
    });

    expect(
      screen.getByTestId(
        `user-approval-empty-assignee-strategy-${EmptyAssigneeStrategy.AssignAdmins}`
      )
    ).toBe(assignAdminsOption);

    fireEvent.click(assignAdminsOption);
    fireEvent.click(screen.getByTestId('save-node-configuration-button'));

    expect(onSave).toHaveBeenCalledWith(
      'Approve0',
      expect.objectContaining({
        config: expect.objectContaining({
          assignees: expect.objectContaining({
            emptyAssigneeStrategy: EmptyAssigneeStrategy.AssignAdmins,
          }),
        }),
      })
    );
  });

  it('does not let the strategy change in view mode', () => {
    renderForm(
      nodeWithStrategy(EmptyAssigneeStrategy.Wait),
      jest.fn(),
      '/?mode=view'
    );

    expect(strategyTrigger()).toBeDisabled();
  });
});
