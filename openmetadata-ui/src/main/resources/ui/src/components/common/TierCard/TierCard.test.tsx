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
  within,
} from '@testing-library/react';
import TierCard from './TierCard';

const mockTierData = [
  {
    id: 'tier-1',
    name: 'Tier1',
    fullyQualifiedName: 'Tier.Tier1',
    description:
      '**Critical Source of Truth business data assets**\n\n- Used in critical metrics',
  },
  {
    id: 'tier-2',
    name: 'Tier2',
    fullyQualifiedName: 'Tier.Tier2',
    description: '**Important business datasets**\n\n- Used in product metrics',
  },
];

const mockGetTags = jest
  .fn()
  .mockImplementation(() => Promise.resolve({ data: mockTierData }));
const mockOnUpdate = jest.fn();
const mockOnClose = jest.fn();
const mockProps = {
  currentTier: 'Tier.Tier1',
  updateTier: mockOnUpdate,
  onClose: mockOnClose,
  children: <div>Child</div>,
  open: true,
};

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockImplementation((...args) => mockGetTags(...args)),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }: { markdown: string }) => (
      <div>{markdown}</div>
    ))
);

describe('TierCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists each tier with its summary, the current one selected', async () => {
    render(<TierCard {...mockProps} />);

    const row = await screen.findByTestId('Tier.Tier1');

    expect(within(row).getByText('Tier1')).toBeInTheDocument();
    expect(
      within(row).getByText('Critical Source of Truth business data assets')
    ).toBeInTheDocument();
    expect(row).toHaveAttribute('aria-checked', 'true');
    expect(mockGetTags).toHaveBeenCalledWith({
      parent: 'Tier',
      limit: 50,
      disabled: false,
    });
  });

  it('expands a tier details from its chevron without picking it', async () => {
    render(<TierCard {...mockProps} />);

    fireEvent.click(await screen.findByTestId('Tier.Tier2-expand'));

    expect(screen.getByTestId('Tier.Tier2-details')).toHaveTextContent(
      'Used in product metrics'
    );
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it('shows a tier with no details as its summary, without a chevron', async () => {
    mockGetTags.mockResolvedValueOnce({
      data: [{ ...mockTierData[0], description: 'Critical data' }],
    });
    render(<TierCard {...mockProps} />);

    const row = await screen.findByTestId('Tier.Tier1');

    expect(within(row).getByText('Critical data')).toBeInTheDocument();
    expect(screen.queryByTestId('Tier.Tier1-expand')).not.toBeInTheDocument();
  });

  it('saves the picked tier at once', async () => {
    render(<TierCard {...mockProps} />);

    const row = await screen.findByTestId('Tier.Tier2');
    await act(async () => {
      fireEvent.click(row);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier2' })
    );
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('clears the tier from the footer', async () => {
    render(<TierCard {...mockProps} />);

    await screen.findByTestId('Tier.Tier1');
    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-filter-btn'));
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(undefined);
  });

  it('calls onClose when dismissed with Escape', async () => {
    render(<TierCard {...mockProps} />);

    await screen.findByTestId('Tier.Tier1');
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('opens from its trigger when not controlled', async () => {
    render(
      <TierCard currentTier="" updateTier={mockOnUpdate}>
        <Button data-testid="edit-tier">Edit</Button>
      </TierCard>
    );

    expect(screen.queryByTestId('Tier.Tier1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('edit-tier'));

    await waitFor(() =>
      expect(screen.getByTestId('Tier.Tier1')).toBeInTheDocument()
    );
  });
});
