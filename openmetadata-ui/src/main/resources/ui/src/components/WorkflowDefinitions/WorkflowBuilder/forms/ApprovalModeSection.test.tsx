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
import { MemoryRouter } from 'react-router-dom';
import { WorkflowModeProvider } from '../../../../contexts/WorkflowModeContext';
import { ApprovalMode } from '../../../../generated/governance/workflows/elements/triggers/eventBasedEntityTrigger';
import { ApprovalModeSection } from './ApprovalModeSection';

const renderSection = (approvalMode?: ApprovalMode) =>
  render(
    <MemoryRouter>
      <WorkflowModeProvider>
        <ApprovalModeSection
          approvalMode={approvalMode}
          onApprovalModeChange={jest.fn()}
        />
      </WorkflowModeProvider>
    </MemoryRouter>
  );

describe('ApprovalModeSection', () => {
  it('explains Enforce when no mode was saved', () => {
    renderSection();

    expect(
      screen.getByText('message.approval-mode-enforce-description')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.approval-mode-description')
    ).toBeInTheDocument();
  });

  it('explains Shadow when Shadow is selected', () => {
    renderSection(ApprovalMode.Shadow);

    expect(
      screen.getByText('message.approval-mode-shadow-description')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('message.approval-mode-enforce-description')
    ).not.toBeInTheDocument();
  });
});
