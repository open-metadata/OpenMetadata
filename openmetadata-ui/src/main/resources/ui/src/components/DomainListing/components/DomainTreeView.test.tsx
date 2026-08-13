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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DOMAINS_LIST } from '../../../mocks/Domains.mock';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import {
  getDomainByName,
  getDomainChildrenPaginated,
  searchDomains,
} from '../../../rest/domainAPI';
import DomainTreeView from './DomainTreeView';

// Holds the latest callbacks passed to the Tree mock so tests can invoke them.
let capturedCallbacks: {
  onSelectionChange?: (keys: Set<string>) => void;
  onExpandedChange?: (keys: Set<string>) => void;
  onAction?: (key: string) => void;
} = {};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: jest.fn(() => null),
  Badge: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  )),
  Box: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  Tree: jest.fn(), // implementation configured per-test in beforeEach
}));

jest.mock('../../common/ResizablePanels/ResizableLeftPanels', () =>
  jest.fn(({ firstPanel, secondPanel }: any) => (
    <div>
      <div data-testid="left-panel">{firstPanel.children}</div>
      <div data-testid="right-panel">{secondPanel.children}</div>
    </div>
  ))
);

jest.mock('../../Domain/DomainDetails/DomainDetails.component', () =>
  jest.fn(() => <div data-testid="domain-details" />)
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn(({ onClick }: any) => (
    <button data-testid="error-placeholder" onClick={onClick}>
      Add Domain
    </button>
  ))
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader" />)
);

jest.mock('../../../rest/domainAPI');

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'user-1' } }),
}));

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: () => ({ userDomains: [], isDomainRestricted: false }),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: { domain: ENTITY_PERMISSIONS },
  }),
}));

jest.mock('../../../utils/DomainRestrictionUtils', () => ({
  filterDomainsToAllowed: jest.fn((domains: unknown[]) => domains),
}));

jest.mock('../../../utils/DomainUtils', () => ({
  convertDomainsToTreeOptions: jest.fn((domains: unknown[]) => domains),
}));

jest.mock('../../../utils/StringUtils', () => ({
  escapeESReservedCharacters: jest.fn((v: string) => v ?? ''),
  getDecodedFqn: jest.fn((v: string) => v ?? ''),
  getEncodedFqn: jest.fn((v: string) => v ?? ''),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn(
    (entity: any) => entity?.displayName || entity?.name || ''
  ),
}));

jest.mock('../../../utils/IconUtils', () => ({
  getEntityAvatarProps: jest.fn(() => ({})),
}));

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockGetDomainChildrenPaginated =
  getDomainChildrenPaginated as jest.MockedFunction<
    typeof getDomainChildrenPaginated
  >;
const mockGetDomainByName = getDomainByName as jest.MockedFunction<
  typeof getDomainByName
>;
const mockSearchDomains = searchDomains as jest.MockedFunction<
  typeof searchDomains
>;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PAGINATED_ROOT_RESPONSE = {
  data: DOMAINS_LIST,
  paging: { total: 2 },
};

const DOMAIN_WITH_MANY_CHILDREN = {
  ...DOMAINS_LIST[0],
  childrenCount: 20,
  children: [],
};

// 1 child returned but total is 20 → (0 + 15 < 20) → hasMoreChildren = true
const CHILD_RESPONSE_WITH_MORE = {
  data: [{ ...DOMAINS_LIST[1], fullyQualifiedName: 'Domain1.Child1' }],
  paging: { total: 20 },
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const defaultProps = {
  searchQuery: undefined as string | undefined,
  filters: undefined as Record<string, string[]> | undefined,
  refreshToken: 0,
  openAddDomainDrawer: jest.fn(),
};

const renderComponent = (props: Partial<typeof defaultProps> = {}) =>
  render(
    <MemoryRouter>
      <DomainTreeView {...defaultProps} {...props} />
    </MemoryRouter>
  );

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('DomainTreeView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedCallbacks = {};

    // Wire up Tree mock to capture callbacks on each render
    const { Tree } = jest.requireMock('@openmetadata/ui-core-components');
    const TreeMock = Tree as jest.MockedFunction<any>;

    TreeMock.mockImplementation(
      ({ children, onSelectionChange, onExpandedChange, onAction }: any) => {
        capturedCallbacks = { onAction, onExpandedChange, onSelectionChange };

        return <div data-testid="mock-tree">{children}</div>;
      }
    );
    TreeMock.ExpandButton = jest.fn(() => null);
    TreeMock.Header = jest.fn(({ children }: any) => <div>{children}</div>);
    TreeMock.Item = jest.fn(({ children, id }: any) => (
      <div data-testid={`tree-item-${id}`}>{children}</div>
    ));
    TreeMock.ItemContent = jest.fn(({ children }: any) => (
      <div>{children}</div>
    ));
    TreeMock.Section = jest.fn(({ children }: any) => <div>{children}</div>);

    // Default API responses
    mockGetDomainChildrenPaginated.mockResolvedValue(
      PAGINATED_ROOT_RESPONSE as any
    );
    mockGetDomainByName.mockResolvedValue(DOMAINS_LIST[0] as any);
    mockSearchDomains.mockResolvedValue(DOMAINS_LIST as any);
  });

  // -------------------------------------------------------------------------
  describe('initial load', () => {
    it('shows a loader while root domains are being fetched', async () => {
      mockGetDomainChildrenPaginated.mockImplementation(
        () => new Promise(() => {})
      );
      renderComponent();

      expect(await screen.findByTestId('loader')).toBeInTheDocument();
    });

    it('calls getDomainChildrenPaginated on mount', async () => {
      renderComponent();
      await waitFor(() => {
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalledWith(
          undefined,
          15,
          0
        );
      });
    });

    it('renders a Tree.Item for each loaded domain', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId('tree-item-Domain1')).toBeInTheDocument();
        expect(screen.getByTestId('tree-item-Domain2')).toBeInTheDocument();
      });
    });

    it('auto-selects the first domain and fetches its details', async () => {
      renderComponent();
      await waitFor(() => {
        expect(mockGetDomainByName).toHaveBeenCalledWith(
          'Domain1',
          expect.objectContaining({ fields: expect.any(Array) })
        );
      });
    });

    it('shows ErrorPlaceHolder when no domains exist', async () => {
      mockGetDomainChildrenPaginated.mockResolvedValue({
        data: [],
        paging: { total: 0 },
      } as any);
      renderComponent();

      expect(
        await screen.findByTestId('error-placeholder')
      ).toBeInTheDocument();
    });

    it('calls openAddDomainDrawer when the ErrorPlaceHolder button is clicked', async () => {
      mockGetDomainChildrenPaginated.mockResolvedValue({
        data: [],
        paging: { total: 0 },
      } as any);
      const openAddDomainDrawer = jest.fn();
      renderComponent({ openAddDomainDrawer });
      fireEvent.click(await screen.findByTestId('error-placeholder'));

      expect(openAddDomainDrawer).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('search', () => {
    it('calls searchDomains (not getDomainChildrenPaginated) when searchQuery is set', async () => {
      renderComponent({ searchQuery: 'marketing' });
      await waitFor(() => {
        expect(mockSearchDomains).toHaveBeenCalled();
      });

      expect(mockGetDomainChildrenPaginated).not.toHaveBeenCalled();
    });

    it('calls getDomainChildrenPaginated when searchQuery is empty', async () => {
      renderComponent({ searchQuery: '' });
      await waitFor(() => {
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalledWith(
          undefined,
          15,
          0
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('domain selection', () => {
    it('fetches domain details when Tree fires onSelectionChange', async () => {
      renderComponent();
      await waitFor(() =>
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalled()
      );

      act(() => {
        capturedCallbacks.onSelectionChange?.(new Set(['Domain2']));
      });

      await waitFor(() => {
        expect(mockGetDomainByName).toHaveBeenCalledWith(
          'Domain2',
          expect.objectContaining({ fields: expect.any(Array) })
        );
      });
    });

    it('renders DomainDetails in the right panel after a domain loads', async () => {
      renderComponent();
      await waitFor(() => expect(mockGetDomainByName).toHaveBeenCalled());

      expect(
        within(screen.getByTestId('right-panel')).getByTestId('domain-details')
      ).toBeInTheDocument();
    });

    it('ignores onSelectionChange events for load-more items', async () => {
      renderComponent();
      await waitFor(() => expect(mockGetDomainByName).toHaveBeenCalledTimes(1));

      act(() => {
        capturedCallbacks.onSelectionChange?.(new Set(['Domain1__load_more']));
      });

      // getDomainByName must not be called again
      expect(mockGetDomainByName).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  describe('tree expansion', () => {
    it('fetches children when a domain with childrenCount > 0 is expanded', async () => {
      mockGetDomainChildrenPaginated.mockResolvedValueOnce({
        data: [DOMAIN_WITH_MANY_CHILDREN],
        paging: { total: 1 },
      } as any);
      renderComponent();
      await waitFor(() =>
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalled()
      );

      act(() => {
        capturedCallbacks.onExpandedChange?.(new Set(['Domain1']));
      });

      await waitFor(() => {
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalledWith(
          'Domain1',
          15,
          0
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('load more – keyboard (onAction)', () => {
    it('calls getDomainChildrenPaginated when onAction fires with a __load_more key', async () => {
      renderComponent();
      await waitFor(() =>
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalled()
      );
      const callsBefore = mockGetDomainChildrenPaginated.mock.calls.length;

      act(() => {
        capturedCallbacks.onAction?.('Domain1__load_more');
      });

      await waitFor(() => {
        expect(
          mockGetDomainChildrenPaginated.mock.calls.length
        ).toBeGreaterThan(callsBefore);
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalledWith(
          'Domain1',
          15,
          expect.any(Number)
        );
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('load more – child button click', () => {
    it('clicking the load-more button fetches the next page of children', async () => {
      // Root response: one domain with 20 children
      mockGetDomainChildrenPaginated
        .mockResolvedValueOnce({
          data: [DOMAIN_WITH_MANY_CHILDREN],
          paging: { total: 1 },
        } as any)
        // Children response: 1 child, total 20 → hasMoreChildren = true
        .mockResolvedValue(CHILD_RESPONSE_WITH_MORE as any);

      renderComponent();
      await waitFor(() =>
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalled()
      );

      // Expand Domain1 to trigger child load
      act(() => {
        capturedCallbacks.onExpandedChange?.(new Set(['Domain1']));
      });
      await waitFor(() =>
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalledWith(
          'Domain1',
          15,
          0
        )
      );

      // Load-more Tree.Item should now be in the DOM
      await waitFor(() =>
        expect(
          screen.getByTestId('tree-item-Domain1__load_more')
        ).toBeInTheDocument()
      );

      const loadMoreBtn = within(
        screen.getByTestId('tree-item-Domain1__load_more')
      ).getByRole('button');

      fireEvent.click(loadMoreBtn);

      // Offset moves to 15 (page 2)
      await waitFor(() => {
        expect(mockGetDomainChildrenPaginated).toHaveBeenCalledWith(
          'Domain1',
          15,
          15
        );
      });
    });
  });
});
