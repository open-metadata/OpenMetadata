/*
 *  Copyright 2025 Collate.
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
import TierCard from '../TierCard/TierCard';

const mockTierData = [
  {
    id: 'tier1-id',
    name: 'Tier1',
    fullyQualifiedName: 'Tier.Tier1',
    description: '**Tier1 desc**\n\nTier1 details',
    version: 0.1,
    updatedAt: 1665646906357,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/tags/Tier/Tier1',
    deprecated: false,
    deleted: false,
  },
  {
    id: 'tier3-id',
    name: 'Tier3',
    fullyQualifiedName: 'Tier.Tier3',
    description: '**Tier3 desc**\n\nTier3 details',
    version: 0.1,
    updatedAt: 1665646906357,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/tags/Tier/Tier3',
    deprecated: false,
    deleted: false,
  },
];

const mockGetTags = jest.fn().mockResolvedValue({ data: mockTierData });
const mockUpdateTier = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockImplementation((...args) => mockGetTags(...args)),
}));

jest.mock('../Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader</div>);
});

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () => {
  return jest.fn().mockReturnValue(<div>RichTextEditorPreviewer</div>);
});

// Capture onOpenChange so tests can simulate AntD open/close events directly.
// AntD does not call onOpenChange when `open` changes programmatically, so
// prop-based open/close cycles cannot be used to drive this test.
let capturedOnOpenChange: ((visible: boolean) => void) | null = null;

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Popover: jest
    .fn()
    .mockImplementation(({ content, onOpenChange, children }) => {
      capturedOnOpenChange = onOpenChange;

      return (
        <>
          {content}
          {children}
        </>
      );
    }),
}));

describe('TierCard stale selectedTier', () => {
  beforeEach(() => {
    mockUpdateTier.mockClear();
    capturedOnOpenChange = null;
  });

  it('resets radio to persisted tier after a cancelled change (Bug A — cancel-stale)', async () => {
    render(
      <TierCard
        currentTier="Tier.Tier1"
        popoverProps={{ open: true }}
        updateTier={mockUpdateTier}>
        <button>Edit Tier</button>
      </TierCard>
    );

    // Simulate AntD firing onOpenChange(true) — loads tier data via handleOpenChange.
    await act(async () => {
      capturedOnOpenChange?.(true);
    });

    const tier3Radio = await screen.findByTestId('radio-btn-Tier3');

    expect(tier3Radio).toBeInTheDocument();

    // User selects Tier3 without saving.
    await act(async () => {
      fireEvent.click(tier3Radio);
    });

    // Cancel: AntD fires onOpenChange(false). handleOpenChange resets selectedTier to Tier1.
    await act(async () => {
      capturedOnOpenChange?.(false);
    });

    // Immediately click Update — selectedTier must be the persisted Tier1, not cancelled Tier3.
    const updateButton = await screen.findByTestId('update-tier-card');

    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(mockUpdateTier).toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier1' })
    );
    expect(mockUpdateTier).not.toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier3' })
    );
  });

  it('shows the newly saved tier on reopen after a successful save (Bug B — save-stale)', async () => {
    const { rerender } = render(
      <TierCard
        currentTier="Tier.Tier1"
        popoverProps={{ open: true }}
        updateTier={mockUpdateTier}>
        <button>Edit Tier</button>
      </TierCard>
    );

    // Open and load tier data.
    await act(async () => {
      capturedOnOpenChange?.(true);
    });

    const tier3Radio = await screen.findByTestId('radio-btn-Tier3');

    // User selects Tier3 and saves.
    await act(async () => {
      fireEvent.click(tier3Radio);
    });

    // Close fires after save. handleOpenChange captures stale currentTier="Tier.Tier1" from
    // its closure (entity context hasn't propagated yet) → resets selectedTier to Tier1 (wrong).
    await act(async () => {
      capturedOnOpenChange?.(false);
    });

    // Entity context now propagates: TierCard receives currentTier="Tier.Tier3", popover closed.
    // The useEffect([currentTier]) guard fires and corrects selectedTier to Tier3.
    await act(async () => {
      rerender(
        <TierCard
          currentTier="Tier.Tier3"
          popoverProps={{ open: false }}
          updateTier={mockUpdateTier}>
          <button>Edit Tier</button>
        </TierCard>
      );
    });

    // User reopens and clicks Update without re-selecting — must commit Tier3, not Tier1.
    const updateButton = await screen.findByTestId('update-tier-card');

    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(mockUpdateTier).toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier3' })
    );
    expect(mockUpdateTier).not.toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier1' })
    );
  });
});
