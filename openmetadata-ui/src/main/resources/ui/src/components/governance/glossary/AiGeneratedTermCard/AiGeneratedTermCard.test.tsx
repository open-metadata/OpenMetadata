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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../../enums/entity.enum';
import {
  EntityStatus,
  GlossaryTerm,
  ProviderType,
} from '../../../../generated/entity/data/glossaryTerm';
import { showErrorToast } from '../../../../utils/ToastUtils';
import AiGeneratedTermCard from './AiGeneratedTermCard';

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const term = (overrides: Partial<GlossaryTerm> = {}): GlossaryTerm =>
  ({
    id: 'term-id',
    name: 'churn',
    description: 'Customers who cancel every subscription.',
    glossary: { id: 'glossary-id', type: EntityType.GLOSSARY },
    provider: ProviderType.Automation,
    entityStatus: EntityStatus.Draft,
    updatedAt: Date.now(),
    ...overrides,
  } as GlossaryTerm);

describe('AiGeneratedTermCard', () => {
  it('approves or rejects the draft through the decision handler', async () => {
    const onDecide = jest.fn().mockResolvedValue(undefined);
    render(<AiGeneratedTermCard canDecide term={term()} onDecide={onDecide} />);

    expect(screen.getByText('label.ai-generated')).toBeInTheDocument();
    expect(
      screen.getByText('message.ai-generated-term-description')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('approve-ai-generated-term'));
    await waitFor(() =>
      expect(onDecide).toHaveBeenCalledWith(EntityStatus.Approved)
    );

    fireEvent.click(screen.getByTestId('reject-ai-generated-term'));
    await waitFor(() =>
      expect(onDecide).toHaveBeenLastCalledWith(EntityStatus.Rejected)
    );
  });

  it('reports a failed decision and re-enables the actions', async () => {
    const error = new Error('forbidden');
    const onDecide = jest.fn().mockRejectedValue(error);
    render(<AiGeneratedTermCard canDecide term={term()} onDecide={onDecide} />);

    fireEvent.click(screen.getByTestId('approve-ai-generated-term'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(screen.getByTestId('reject-ai-generated-term')).toBeEnabled();
  });

  it('tells people who cannot decide that the reviewers do', () => {
    render(
      <AiGeneratedTermCard
        canDecide={false}
        term={term({
          reviewers: [{ id: 'reviewer-id', type: EntityType.USER }],
        })}
        onDecide={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('approve-ai-generated-term')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('message.ai-generated-term-reviewers-decide')
    ).toBeInTheDocument();
  });
});
