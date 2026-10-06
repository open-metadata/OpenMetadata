/*
 *  Copyright 2022 Collate.
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

import { Button } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import TierCard from './TierCard';

const mockTierData = [
  {
    id: 'e4ec1760-79c0-4afc-a0eb-c3da339aa750',
    name: 'Tier1',
    fullyQualifiedName: 'Tier.Tier1',
    description:
      '**Critical Source of Truth business data assets of an organization**',
    version: 0.1,
    updatedAt: 1665646906357,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/tags/Tier/Tier1',
    deprecated: false,
    deleted: false,
  },
];

const mockGetTags = jest
  .fn()
  .mockImplementation(() => Promise.resolve({ data: mockTierData }));
const mockOnUpdate = jest.fn();
const mockShowErrorToast = jest.fn();
const mockProps = {
  currentTier: 'currentTier',
  updateTier: mockOnUpdate,
  children: <div>Child</div>,
  open: true,
};

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockImplementation((...args) => mockGetTags(...args)),
}));

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader</div>);
});

jest.mock('../../../utils/ToastUtils', () => {
  return jest.fn().mockImplementation(() => mockShowErrorToast());
});

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockReturnValue(<div>RichTextEditorPreviewer</div>);
});

describe('Test TierCard Component', () => {
  it('Component should have card', async () => {
    await act(async () => {
      render(<TierCard {...mockProps} />);
    });

    expect(mockGetTags).toHaveBeenCalled();

    expect(await screen.findByTestId('cards')).toBeInTheDocument();
  });

  it('should call the mockOnUpdate when click on radio button', async () => {
    await act(async () => {
      render(<TierCard {...mockProps} />);
    });

    const radioButton = await screen.findByTestId('radio-btn-Tier1');

    expect(radioButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(radioButton);
    });

    expect(screen.getByRole('radio', { name: /Tier1/ })).toBeChecked();

    const updateTierCard = await screen.findByTestId('update-tier-card');

    expect(updateTierCard).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(updateTierCard);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(mockTierData[0]);
  });

  it('should call the mockOnUpdate when click on Clear button', async () => {
    await act(async () => {
      render(<TierCard {...mockProps} />);
    });

    const clearTier = await screen.findByTestId('clear-tier');

    expect(clearTier).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(clearTier);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(undefined);
  });

  it('should open from a pressable trigger and close on Escape', async () => {
    render(
      <TierCard currentTier="currentTier" updateTier={mockOnUpdate}>
        <Button data-testid="edit-tier">Edit</Button>
      </TierCard>
    );

    const trigger = screen.getByTestId('edit-tier');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('cards')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(trigger);
    });

    expect(await screen.findByTestId('cards')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    });

    await waitFor(() =>
      expect(screen.queryByTestId('cards')).not.toBeInTheDocument()
    );

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('should leave controlled open state to the caller', async () => {
    const onOpenChange = jest.fn();

    await act(async () => {
      render(
        <TierCard {...mockProps} onOpenChange={onOpenChange}>
          <div data-testid="anchor">Anchor</div>
        </TierCard>
      );
    });

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('anchor'));
      fireEvent.pointerUp(screen.getByTestId('anchor'));
    });

    expect(onOpenChange).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('cards')).toBeInTheDocument();
  });

  it('should request only enabled tiers by passing disabled false', async () => {
    await act(async () => {
      render(<TierCard {...mockProps} />);
    });

    expect(mockGetTags).toHaveBeenCalledWith(
      expect.objectContaining({ parent: 'Tier', disabled: false })
    );
  });
});
