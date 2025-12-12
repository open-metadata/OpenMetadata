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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import * as useEditableSectionHook from '../../../hooks/useEditableSection';
import * as EntityUpdateUtils from '../../../utils/EntityUpdateUtils';
import TierSection from './TierSection';

const mockStartEditing = jest.fn();
const mockCompleteEditing = jest.fn();
const mockCancelEditing = jest.fn();
const mockSetIsLoading = jest.fn();
const mockSetPopoverOpen = jest.fn();
const mockSetDisplayTier = jest.fn();

const mockUseEditableSection = jest.spyOn(
  useEditableSectionHook,
  'useEditableSection'
);
const mockUpdateEntityField = jest.spyOn(
  EntityUpdateUtils,
  'updateEntityField'
);

jest.mock('../TierCard/TierCard', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ children, onClose, updateTier }) => (
    <div data-testid="tier-card">
      {children}
      <button data-testid="update-tier" onClick={() => updateTier?.()}>
        Update Tier
      </button>
      <button data-testid="close-tier" onClick={onClose}>
        Close
      </button>
    </div>
  )),
}));

jest.mock('../../Tag/TagsV1/TagsV1.component', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockReturnValue(<div data-testid="tier-tag">Tier Tag</div>),
}));

jest.mock('../IconButtons/EditIconButton', () => ({
  EditIconButton: jest
    .fn()
    .mockImplementation(({ 'data-testid': testId, onClick, title }) => (
      <button data-testid={testId} title={title} onClick={onClick}>
        Edit
      </button>
    )),
}));

jest.mock('../Loader/Loader', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockReturnValue(<div data-testid="loader">Loading...</div>),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        return `${key} ${Object.values(params).join(' ')}`;
      }

      return key;
    },
  }),
}));

describe('TierSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEditableSection.mockImplementation((initialData) => ({
      isEditing: false,
      isLoading: false,
      popoverOpen: false,
      displayData: initialData,
      setDisplayData: mockSetDisplayTier,
      setIsLoading: mockSetIsLoading,
      setPopoverOpen: mockSetPopoverOpen,
      startEditing: mockStartEditing,
      completeEditing: mockCompleteEditing,
      cancelEditing: mockCancelEditing,
    }));
  });

  it('should render tier section with tier', () => {
    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    expect(screen.getByText('label.tier')).toBeInTheDocument();
    expect(screen.getByTestId('tier-tag')).toBeInTheDocument();
  });

  it('should render no data placeholder when tier is not provided', () => {
    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
      />
    );

    expect(screen.getByText('label.tier')).toBeInTheDocument();
    expect(
      screen.getByText('label.no-entity-assigned label.tier')
    ).toBeInTheDocument();
  });

  it('should show edit button when hasPermission is true and showEditButton is true', () => {
    render(
      <TierSection
        hasPermission
        showEditButton
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    expect(screen.getByTestId('edit-icon-tier')).toBeInTheDocument();
  });

  it('should not show edit button when hasPermission is false', () => {
    render(
      <TierSection
        showEditButton
        entityId="test-id"
        entityType={EntityType.TABLE}
        hasPermission={false}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    expect(screen.queryByTestId('edit-icon-tier')).not.toBeInTheDocument();
  });

  it('should not show edit button when showEditButton is false', () => {
    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        showEditButton={false}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    expect(screen.queryByTestId('edit-icon-tier')).not.toBeInTheDocument();
  });

  it('should not show edit button when isLoading is true', () => {
    mockUseEditableSection.mockImplementation((initialData) => ({
      isEditing: false,
      isLoading: true,
      popoverOpen: false,
      displayData: initialData,
      setDisplayData: mockSetDisplayTier,
      setIsLoading: mockSetIsLoading,
      setPopoverOpen: mockSetPopoverOpen,
      startEditing: mockStartEditing,
      completeEditing: mockCompleteEditing,
      cancelEditing: mockCancelEditing,
    }));

    render(
      <TierSection
        hasPermission
        showEditButton
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    expect(screen.queryByTestId('edit-icon-tier')).not.toBeInTheDocument();
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should call startEditing when edit button is clicked', () => {
    render(
      <TierSection
        hasPermission
        showEditButton
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    const editButton = screen.getByTestId('edit-icon-tier');

    fireEvent.click(editButton);

    expect(mockStartEditing).toHaveBeenCalledTimes(1);
  });

  it('should render editing state when isEditing is true', () => {
    mockUseEditableSection.mockImplementation((initialData) => ({
      isEditing: true,
      isLoading: false,
      popoverOpen: true,
      displayData: initialData || {
        labelType: LabelType.Manual,
        source: TagSource.Classification,
        state: State.Confirmed,
        tagFQN: 'Tier.Tier1',
      },
      setDisplayData: mockSetDisplayTier,
      setIsLoading: mockSetIsLoading,
      setPopoverOpen: mockSetPopoverOpen,
      startEditing: mockStartEditing,
      completeEditing: mockCompleteEditing,
      cancelEditing: mockCancelEditing,
    }));

    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    expect(screen.getByTestId('tier-card')).toBeInTheDocument();
    expect(screen.getByTestId('tier-tag')).toBeInTheDocument();
  });

  it('should render loading state when isLoading is true', () => {
    mockUseEditableSection.mockImplementation((initialData) => ({
      isEditing: false,
      isLoading: true,
      popoverOpen: false,
      displayData: initialData,
      setDisplayData: mockSetDisplayTier,
      setIsLoading: mockSetIsLoading,
      setPopoverOpen: mockSetPopoverOpen,
      startEditing: mockStartEditing,
      completeEditing: mockCompleteEditing,
      cancelEditing: mockCancelEditing,
    }));

    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('should handle tier with different states', () => {
    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Derived,
          source: TagSource.Classification,
          state: State.Suggested,
          tagFQN: 'Tier.Tier2',
        }}
      />
    );

    expect(screen.getByText('label.tier')).toBeInTheDocument();
    expect(screen.getByTestId('tier-tag')).toBeInTheDocument();
  });

  it('should work with different entity types', () => {
    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.DASHBOARD}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    expect(screen.getByText('label.tier')).toBeInTheDocument();
  });

  it('should call onTierUpdate callback when tier is updated', async () => {
    const mockOnTierUpdate = jest.fn();

    mockUpdateEntityField.mockResolvedValue({
      success: true,
    });

    mockUseEditableSection.mockImplementation((initialData) => ({
      isEditing: true,
      isLoading: false,
      popoverOpen: true,
      displayData: initialData || {
        labelType: LabelType.Manual,
        source: TagSource.Classification,
        state: State.Confirmed,
        tagFQN: 'Tier.Tier1',
      },
      setDisplayData: mockSetDisplayTier,
      setIsLoading: mockSetIsLoading,
      setPopoverOpen: mockSetPopoverOpen,
      startEditing: mockStartEditing,
      completeEditing: mockCompleteEditing,
      cancelEditing: mockCancelEditing,
    }));

    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tags={[
          {
            labelType: LabelType.Manual,
            source: TagSource.Classification,
            state: State.Confirmed,
            tagFQN: 'Tier.Tier1',
          },
        ]}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
        onTierUpdate={mockOnTierUpdate}
      />
    );

    const updateButton = screen.getByTestId('update-tier');

    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockUpdateEntityField).toHaveBeenCalled();
    });
  });

  it('should handle cancel editing', () => {
    mockUseEditableSection.mockImplementation((initialData) => ({
      isEditing: true,
      isLoading: false,
      popoverOpen: true,
      displayData: initialData || {
        labelType: LabelType.Manual,
        source: TagSource.Classification,
        state: State.Confirmed,
        tagFQN: 'Tier.Tier1',
      },
      setDisplayData: mockSetDisplayTier,
      setIsLoading: mockSetIsLoading,
      setPopoverOpen: mockSetPopoverOpen,
      startEditing: mockStartEditing,
      completeEditing: mockCompleteEditing,
      cancelEditing: mockCancelEditing,
    }));

    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    const closeButton = screen.getByTestId('close-tier');

    fireEvent.click(closeButton);

    expect(mockSetPopoverOpen).toHaveBeenCalledWith(false);
    expect(mockCancelEditing).toHaveBeenCalledTimes(1);
  });

  it('should filter out existing tier tags when updating', async () => {
    mockUpdateEntityField.mockResolvedValue({
      success: true,
    });

    mockUseEditableSection.mockImplementation((initialData) => ({
      isEditing: true,
      isLoading: false,
      popoverOpen: true,
      displayData: initialData || {
        labelType: LabelType.Manual,
        source: TagSource.Classification,
        state: State.Confirmed,
        tagFQN: 'Tier.Tier1',
      },
      setDisplayData: mockSetDisplayTier,
      setIsLoading: mockSetIsLoading,
      setPopoverOpen: mockSetPopoverOpen,
      startEditing: mockStartEditing,
      completeEditing: mockCompleteEditing,
      cancelEditing: mockCancelEditing,
    }));

    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tags={[
          {
            labelType: LabelType.Manual,
            source: TagSource.Classification,
            state: State.Confirmed,
            tagFQN: 'Tier.Tier1',
          },
          {
            labelType: LabelType.Manual,
            source: TagSource.Classification,
            state: State.Confirmed,
            tagFQN: 'Tag1',
          },
        ]}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    const updateButton = screen.getByTestId('update-tier');

    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockUpdateEntityField).toHaveBeenCalled();

      const callArgs = mockUpdateEntityField.mock.calls[0][0];

      expect(callArgs.newValue).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tagFQN: 'Tag1',
          }),
        ])
      );
    });
  });

  it('should handle update failure gracefully', async () => {
    mockUpdateEntityField.mockResolvedValue({
      success: false,
    });

    mockUseEditableSection.mockImplementation((initialData) => ({
      isEditing: true,
      isLoading: false,
      popoverOpen: true,
      displayData: initialData || {
        labelType: LabelType.Manual,
        source: TagSource.Classification,
        state: State.Confirmed,
        tagFQN: 'Tier.Tier1',
      },
      setDisplayData: mockSetDisplayTier,
      setIsLoading: mockSetIsLoading,
      setPopoverOpen: mockSetPopoverOpen,
      startEditing: mockStartEditing,
      completeEditing: mockCompleteEditing,
      cancelEditing: mockCancelEditing,
    }));

    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          labelType: LabelType.Manual,
          source: TagSource.Classification,
          state: State.Confirmed,
          tagFQN: 'Tier.Tier1',
        }}
      />
    );

    const updateButton = screen.getByTestId('update-tier');

    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockUpdateEntityField).toHaveBeenCalled();
      expect(mockSetIsLoading).toHaveBeenCalledWith(false);
    });
  });
});
