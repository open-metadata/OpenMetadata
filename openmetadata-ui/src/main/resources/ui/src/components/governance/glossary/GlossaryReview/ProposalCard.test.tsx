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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../../../generated/entity/data/glossaryTerm';
import { Task } from '../../../../rest/tasksAPI';
import { GlossaryProposal } from '../../../../utils/GlossaryReview/GlossaryReview.types';
import ProposalCard from './ProposalCard';

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const term = {
  id: 'term-id',
  name: 'Joint Account',
  displayName: 'Joint Account',
  description: 'An account owned by two or more customers.',
  fullyQualifiedName: 'Banking.Joint Account',
  entityStatus: EntityStatus.Draft,
  provider: ProviderType.Automation,
  updatedAt: Date.now(),
  updatedBy: 'aiautomationapplicationbot',
  reviewers: [
    { id: 'karan-id', name: 'karan', displayName: 'Karan', type: 'user' },
  ],
} as GlossaryTerm;

const aiProposal: GlossaryProposal = {
  term,
  source: 'ai',
  derivation: {
    entity: { id: 'term-id', type: 'glossaryTerm' },
    memory: {
      id: 'memory-id',
      type: 'contextMemory',
      name: 'joint-accounts',
      displayName: 'Joint accounts',
    },
    evidence: {
      agent: 'Glossary Agent',
      confidence: 0.92,
      reasons: ['ownership_type is JOINT for 41k accounts'],
    },
  },
};

const personProposal: GlossaryProposal = {
  term: {
    ...term,
    provider: ProviderType.User,
    entityStatus: EntityStatus.InReview,
  },
  source: 'person',
  approvalTask: {
    id: 'task-id',
    assignees: [{ id: 'karan-id', name: 'karan', type: 'user' }],
    createdBy: { id: 'k-id', name: 'karthick', type: 'user' },
  } as unknown as Task,
};

const renderCard = (props: Partial<Parameters<typeof ProposalCard>[0]>) =>
  render(
    <ProposalCard
      canDecide
      proposal={aiProposal}
      onDecide={jest.fn().mockResolvedValue(undefined)}
      {...props}
    />,
    { wrapper: MemoryRouter }
  );

describe('ProposalCard', () => {
  it('shows the agent, its confidence, its reasons and the memory behind them', () => {
    renderCard({});

    expect(screen.getByText('Glossary Agent')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(
      screen.getByText('ownership_type is JOINT for 41k accounts')
    ).toBeInTheDocument();
    expect(screen.getByTestId('proposal-source-memory')).toHaveTextContent(
      'Joint accounts'
    );
    expect(screen.getByText('message.ai-proposal-rule')).toBeInTheDocument();
  });

  it('approves an AI proposal at once and asks why before rejecting it', async () => {
    const onDecide = jest.fn().mockResolvedValue(undefined);
    renderCard({ onDecide });

    await act(async () => {
      fireEvent.click(screen.getByTestId('approve-proposal'));
    });
    fireEvent.click(screen.getByTestId('reject-proposal'));

    expect(onDecide).toHaveBeenCalledTimes(1);
    expect(onDecide).toHaveBeenCalledWith(EntityStatus.Approved, undefined);
    expect(screen.getByTestId('confirm-reject-proposal')).toBeDisabled();
  });

  it('asks why before rejecting a person proposal', async () => {
    const onDecide = jest.fn().mockResolvedValue(undefined);
    renderCard({ onDecide, proposal: personProposal });

    fireEvent.click(screen.getByTestId('reject-proposal'));

    expect(screen.getByTestId('confirm-reject-proposal')).toBeDisabled();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Covered by Escrow Account' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-reject-proposal'));
    });

    expect(onDecide).toHaveBeenCalledWith(
      EntityStatus.Rejected,
      'Covered by Escrow Account'
    );
  });

  it('names who decides when the viewer cannot', () => {
    renderCard({ canDecide: false, proposal: personProposal });

    expect(screen.queryByTestId('approve-proposal')).not.toBeInTheDocument();
    expect(screen.getByText('message.waiting-on-deciders')).toBeInTheDocument();
  });

  it('names no one while an AI proposal waits for its approval request', () => {
    // Its reviewers cannot decide it before the request opens.
    renderCard({ canDecide: false });

    expect(screen.queryByTestId('approve-proposal')).not.toBeInTheDocument();
    expect(
      screen.getByText('message.waiting-for-approval-request')
    ).toBeInTheDocument();
  });
});
