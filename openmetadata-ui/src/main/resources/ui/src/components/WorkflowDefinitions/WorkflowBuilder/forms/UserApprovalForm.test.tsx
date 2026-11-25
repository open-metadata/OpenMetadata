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
import { MemoryRouter } from 'react-router-dom';
import { Node } from 'reactflow';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
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

describe('UserApprovalForm', () => {
  it('keeps the settings it does not edit when it saves', () => {
    const onSave = jest.fn();
    render(
      <MemoryRouter initialEntries={['/?mode=edit']}>
        <WorkflowModeProvider>
          <UserApprovalForm node={node} onClose={jest.fn()} onSave={onSave} />
        </WorkflowModeProvider>
      </MemoryRouter>
    );

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
});
