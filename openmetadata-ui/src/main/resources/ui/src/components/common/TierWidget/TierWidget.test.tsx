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

import { Button } from '@openmetadata/ui-core-components';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { Domain } from '../../../generated/entity/domains/domain';
import TierCard from '../TierCard/TierCard';
import TierWidget from './TierWidget';

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

const renderTierCard = (currentTier: string) => (
  <TierCard currentTier={currentTier} updateTier={mockUpdateTier}>
    <Button data-testid="edit-tier">Edit Tier</Button>
  </TierCard>
);

const openTierCard = async () => {
  await act(async () => {
    fireEvent.click(screen.getByTestId('edit-tier'));
  });
  await screen.findByTestId('radio-btn-Tier3');
};

describe('TierCard stale selectedTier', () => {
  beforeEach(() => {
    mockUpdateTier.mockClear();
  });

  it('resets radio to persisted tier after a cancelled change (Bug A — cancel-stale)', async () => {
    render(renderTierCard('Tier.Tier1'));

    await openTierCard();

    // User selects Tier3 without saving, then dismisses the card.
    await act(async () => {
      fireEvent.click(screen.getByTestId('radio-btn-Tier3'));
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    });
    await waitFor(() =>
      expect(screen.queryByTestId('cards')).not.toBeInTheDocument()
    );

    // Reopen and click Update — must commit the persisted Tier1, not cancelled Tier3.
    await openTierCard();
    await act(async () => {
      fireEvent.click(screen.getByTestId('update-tier-card'));
    });

    expect(mockUpdateTier).toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier1' })
    );
    expect(mockUpdateTier).not.toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier3' })
    );
  });

  it('shows the newly saved tier on reopen after a successful save (Bug B — save-stale)', async () => {
    const { rerender } = render(renderTierCard('Tier.Tier1'));

    await openTierCard();

    // User selects Tier3 and saves; the card closes while currentTier is still Tier1.
    await act(async () => {
      fireEvent.click(screen.getByTestId('radio-btn-Tier3'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('update-tier-card'));
    });
    await waitFor(() =>
      expect(screen.queryByTestId('cards')).not.toBeInTheDocument()
    );
    mockUpdateTier.mockClear();

    // Entity context propagates the saved tier while the card is closed.
    await act(async () => {
      rerender(renderTierCard('Tier.Tier3'));
    });

    // Reopen and click Update without re-selecting — must commit Tier3, not Tier1.
    await openTierCard();
    await act(async () => {
      fireEvent.click(screen.getByTestId('update-tier-card'));
    });

    expect(mockUpdateTier).toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier3' })
    );
    expect(mockUpdateTier).not.toHaveBeenCalledWith(
      expect.objectContaining({ fullyQualifiedName: 'Tier.Tier1' })
    );
  });
});

const mockUseGenericContextResult = {
  data: { name: 'domain', tags: [] } as unknown as Domain,
  permissions: {} as OperationPermission,
  onUpdate: jest.fn(),
  isVersionView: false,
};

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(() => mockUseGenericContextResult),
}));

describe('TierWidget permissions', () => {
  beforeEach(() => {
    mockUseGenericContextResult.isVersionView = false;
  });

  it('should render the add control when EditTier is granted', () => {
    mockUseGenericContextResult.permissions = {
      EditTier: true,
    } as unknown as OperationPermission;

    render(<TierWidget />);

    expect(screen.getByTestId('add-tier')).toBeInTheDocument();
  });

  it('should render the add control when only EditAll is granted', () => {
    mockUseGenericContextResult.permissions = {
      EditAll: true,
    } as unknown as OperationPermission;

    render(<TierWidget />);

    expect(screen.getByTestId('add-tier')).toBeInTheDocument();
  });

  it('should not render the add control when EditTier is denied despite EditAll', () => {
    mockUseGenericContextResult.permissions = {
      EditAll: true,
      EditTier: false,
    } as unknown as OperationPermission;

    render(<TierWidget />);

    expect(screen.queryByTestId('add-tier')).not.toBeInTheDocument();
  });

  it('should not render the add control on a version view', () => {
    mockUseGenericContextResult.permissions = {
      EditTier: true,
    } as unknown as OperationPermission;
    mockUseGenericContextResult.isVersionView = true;

    render(<TierWidget />);

    expect(screen.queryByTestId('add-tier')).not.toBeInTheDocument();
  });
});
