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
import { AssetSelectionDrawer } from './AssetSelectionDrawer';
import { useAssetSelectionState } from './useAssetSelectionState';

jest.mock('@openmetadata/ui-core-components', () => ({
  SlideoutMenu: Object.assign(
    ({
      isOpen,
      onOpenChange,
      children,
      'data-testid': testId,
    }: {
      isOpen: boolean;
      onOpenChange?: (isOpen: boolean) => void;
      children: React.ReactNode;
      'data-testid'?: string;
    }) =>
      isOpen ? (
        <div data-testid={testId}>
          {children}
          <button
            data-testid="slideout-backdrop"
            onClick={() => onOpenChange?.(false)}>
            backdrop
          </button>
        </div>
      ) : null,
    {
      Header: ({
        children,
        onClose,
        'data-testid': testId,
      }: {
        children: React.ReactNode;
        onClose?: () => void;
        'data-testid'?: string;
      }) => (
        <div data-testid={testId}>
          {children}
          <button data-testid="drawer-close-icon" onClick={onClose} />
        </div>
      ),
      Content: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="drawer-content">{children}</div>
      ),
      Footer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="drawer-footer">{children}</div>
      ),
    }
  ),
  Typography: ({
    children,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={testId}>{children}</span>,
}));

jest.mock('./useAssetSelectionState');

jest.mock('./AssetSelectionContentBody', () => {
  return jest.fn(() => <div data-testid="content-body" />);
});

jest.mock('./AssetSelectionFooter', () => {
  return jest.fn(
    ({
      onSave,
      onCancel,
    }: {
      onSave?: () => void;
      onCancel?: () => void;
    }) => (
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

describe('AssetSelectionDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAssetSelectionState as jest.Mock).mockReturnValue(baseState);
  });

  it('should not render content body when open is false', () => {
    render(
      <AssetSelectionDrawer
        entityFqn="glossary.term"
        open={false}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByTestId('content-body')).not.toBeInTheDocument();
  });

  it('should render content body when open is true', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('content-body')).toBeInTheDocument();
  });

  it('should render the footer once the drawer is open', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('should call useAssetSelectionState with drawer variant and provided props', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        queryFilter={{} as never}
        type={AssetsOfEntity.DOMAIN}
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    expect(useAssetSelectionState).toHaveBeenCalledWith(
      expect.objectContaining({
        entityFqn: 'glossary.term',
        type: AssetsOfEntity.DOMAIN,
        open: true,
        variant: 'drawer',
        onSave: mockOnSave,
        onCancel: mockOnCancel,
      })
    );
  });

  it('should default type to GLOSSARY when not provided', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(useAssetSelectionState).toHaveBeenCalledWith(
      expect.objectContaining({ type: AssetsOfEntity.GLOSSARY })
    );
  });

  it('should render the default title when no title prop is given', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('drawer-heading')).toHaveTextContent(
      'label.add-entity'
    );
  });

  it('should render a custom title when title prop is given', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        title="Add Input Ports"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('drawer-heading')).toHaveTextContent(
      'Add Input Ports'
    );
  });

  it('should call onCancel when the header close icon is clicked', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('drawer-close-icon'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when the slideout requests close via onOpenChange', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('slideout-backdrop'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should pass derived counts to the footer', () => {
    (useAssetSelectionState as jest.Mock).mockReturnValue({
      ...baseState,
      failedStatus: { failedRequest: [{ request: { id: '1' } }] },
      assetJobResponse: { message: 'running' },
      selectedItems: new Map([['1', {}]]),
    });

    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it("should call the hook's onSaveAction when footer save is clicked", () => {
    render(
      <AssetSelectionDrawer
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
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByTestId('footer-cancel'));

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should pass infoBannerText through to the content body', () => {
    render(
      <AssetSelectionDrawer
        open
        entityFqn="glossary.term"
        infoBannerText="Ports come from data product assets"
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('content-body')).toBeInTheDocument();
  });
});
