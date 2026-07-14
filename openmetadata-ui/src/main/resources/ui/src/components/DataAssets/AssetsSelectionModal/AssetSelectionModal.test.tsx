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
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { AssetSelectionModal } from './AssetSelectionModal';
import { useAssetSelectionState } from './useAssetSelectionState';

jest.mock('@openmetadata/ui-core-components', () => {
  const MockDialog = Object.assign(
    ({
      children,
      title,
      onClose,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      title?: string;
      onClose?: () => void;
      'data-testid'?: string;
    }) => (
      <div data-testid={testId}>
        <span data-testid="dialog-title">{title}</span>
        <button data-testid="dialog-close" onClick={onClose}>
          close
        </button>
        {children}
      </div>
    ),
    {
      Content: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dialog-content">{children}</div>
      ),
      Footer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="dialog-footer">{children}</div>
      ),
    }
  );

  return {
    Dialog: MockDialog,
    Modal: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="modal">{children}</div>
    ),
    ModalOverlay: ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children: React.ReactNode;
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
    }) =>
      isOpen ? (
        <div data-testid="modal-overlay">
          {children}
          <button
            data-testid="modal-backdrop"
            onClick={() => onOpenChange(false)}>
            backdrop
          </button>
        </div>
      ) : null,
  };
});

jest.mock('./useAssetSelectionState');

jest.mock('./AssetSelectionContentBody', () => {
  return jest.fn(() => <div data-testid="content-body" />);
});

jest.mock('./AssetSelectionFooter', () => {
  return jest.fn(
    ({ onSave, onCancel }: { onSave?: () => void; onCancel?: () => void }) => (
      <div data-testid="footer">
        <button data-testid="footer-save" onClick={onSave}>
          save
        </button>
        <button data-testid="footer-cancel" onClick={onCancel}>
          cancel
        </button>
      </div>
    )
  );
});

const mockOnSaveAction = jest.fn();
const mockOnCancel = jest.fn();
const mockOnSave = jest.fn();

const baseState = {
  search: '',
  setSearch: jest.fn(),
  items: [],
  failedStatus: undefined,
  dryRunWarnings: undefined,
  exportJob: undefined,
  selectedItems: new Map(),
  isLoading: false,
  isSaveLoading: false,
  assetJobResponse: undefined,
  aggregations: undefined,
  quickFilterQuery: undefined,
  filters: [],
  totalCount: 0,
  handleCardClick: jest.fn(),
  onSaveAction: mockOnSaveAction,
  confirmDomainAssetMove: jest.fn(),
  cancelDomainAssetMove: jest.fn(),
  onScroll: jest.fn(),
  onSelectAll: jest.fn(),
  getErrorStatusAndMessage: jest.fn(),
  handleQuickFiltersValueSelect: jest.fn(),
  clearFilters: jest.fn(),
};

describe('AssetSelectionModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAssetSelectionState as jest.Mock).mockReturnValue(baseState);
  });

  it('should not render the modal overlay when open is false', () => {
    render(
      <AssetSelectionModal
        entityFqn="glossary.term"
        open={false}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
  });

  it('should render the modal overlay and dialog when open is true', () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('asset-selection-modal')).toBeInTheDocument();
  });

  it('should render the content body unconditionally inside the dialog once open', () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('content-body')).toBeInTheDocument();
  });

  it('should call useAssetSelectionState with modal variant and provided props', () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        queryFilter={{} as never}
        type={AssetsOfEntity.TAG}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    expect(useAssetSelectionState).toHaveBeenCalledWith(
      expect.objectContaining({
        entityFqn: 'glossary.term',
        type: AssetsOfEntity.TAG,
        open: true,
        variant: 'modal',
        onSave: mockOnSave,
        onCancel: mockOnCancel,
      })
    );
  });

  it('should default type to GLOSSARY when not provided', () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(useAssetSelectionState).toHaveBeenCalledWith(
      expect.objectContaining({ type: AssetsOfEntity.GLOSSARY })
    );
  });

  it('should always render the default add-entity title', () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('dialog-title')).toHaveTextContent(
      'label.add-entity'
    );
  });

  it('should call onCancel when the dialog close button is clicked', () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('dialog-close'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when the overlay requests close via onOpenChange', () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('modal-backdrop'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("should call the hook's onSaveAction when footer save is clicked", () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('footer-save'));

    expect(mockOnSaveAction).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when footer cancel is clicked', () => {
    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('footer-cancel'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should render the footer with derived state from the hook', () => {
    (useAssetSelectionState as jest.Mock).mockReturnValue({
      ...baseState,
      failedStatus: { failedRequest: [{ request: { id: '1' } }] },
      assetJobResponse: { message: 'running' },
      selectedItems: new Map([['1', {}]]),
    });

    render(
      <AssetSelectionModal
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });
});
