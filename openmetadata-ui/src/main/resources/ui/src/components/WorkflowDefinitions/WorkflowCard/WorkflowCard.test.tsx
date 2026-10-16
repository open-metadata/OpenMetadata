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
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import workflowClassBase from '../../../utils/WorkflowClassBase';
import WorkflowCard from './WorkflowCard.component';

const WORKFLOW: WorkflowDefinition = {
  name: 'GlossaryTermApprovalWorkflow',
  description: 'Approves glossary terms',
};

const DATA = {
  icon: () => <svg />,
  key: 'GlossaryTermApprovalWorkflow',
  label: 'Glossary Term Approval',
  description: 'Approves glossary terms',
};

describe('WorkflowCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows only the name and description on OpenMetadata', () => {
    const onClick = jest.fn();
    render(<WorkflowCard data={DATA} workflow={WORKFLOW} onClick={onClick} />);

    fireEvent.click(screen.getByTestId(DATA.key));

    expect(screen.getByText('Glossary Term Approval')).toBeInTheDocument();
    expect(screen.getByText('Approves glossary terms')).toBeInTheDocument();
    expect(onClick).toHaveBeenCalledWith(DATA.key);
  });

  it('hands the workflow to the footer a downstream build adds', () => {
    const Footer = jest.fn(({ workflow }: { workflow: WorkflowDefinition }) => (
      <span data-testid="downstream-footer">{workflow.name}</span>
    ));
    jest
      .spyOn(workflowClassBase, 'getWorkflowCardFooter')
      .mockReturnValue(Footer);

    render(
      <WorkflowCard data={DATA} workflow={WORKFLOW} onClick={jest.fn()} />
    );

    expect(screen.getByTestId('downstream-footer')).toHaveTextContent(
      WORKFLOW.name
    );
  });

  it('leaves the footer out when the card has no workflow', () => {
    jest
      .spyOn(workflowClassBase, 'getWorkflowCardFooter')
      .mockReturnValue(() => <span data-testid="downstream-footer" />);

    render(<WorkflowCard data={DATA} onClick={jest.fn()} />);

    expect(screen.queryByTestId('downstream-footer')).not.toBeInTheDocument();
  });
});
