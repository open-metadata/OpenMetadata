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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { createRef, type PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { KnowledgePagesHierarchyRef } from '../../../interface/knowledge-center.interface';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import KnowledgePagesHierarchy from './KnowledgePagesHierarchy';

const TestWrapper = ({ children }: PropsWithChildren) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

const PageHierarchy = [
  {
    id: '62bec763-522d-4b70-ad85-f487b2f6102f',
    pageType: 'Article',
    name: 'Article_XJIGIKX2',
    description: 'description',
    fullyQualifiedName: 'Article_XJIGIKX2',
    displayName: 'How to Discover Assets of Interest',
    childrenCount: 1,
    children: [
      {
        id: 'ae65ca82-a284-4d3e-9554-dd4c94086613',
        pageType: 'Article',
        name: 'Article_2p7Z8MAN',
        description: '',
        fullyQualifiedName: 'Article_2p7Z8MAN',
        displayName: 'How to Discover Assets of Interest Child 1',
        childrenCount: 1,
        children: [
          {
            id: '27c39402-9691-4776-becd-23a69d06db75',
            pageType: 'Article',
            name: 'Article_UqfRMCZw',
            description: '',
            fullyQualifiedName: 'Article_UqfRMCZw',
            displayName: 'How to Discover Assets of Interest Child 11',
            childrenCount: 1,
            children: [
              {
                id: '838c8ce7-b949-4f58-9a6c-1ef268fc920d',
                pageType: 'Article',
                name: 'Article_LtyX9wX3',
                description: '',
                fullyQualifiedName: 'Article_LtyX9wX3',
                displayName: 'How to Discover Assets of Interest Child 111',
                childrenCount: 1,
                children: [
                  {
                    id: 'a31ca2ba-e841-4673-bbc2-478f0dea4692',
                    pageType: 'Article',
                    name: 'Article_atU2ADuH',
                    description: '',
                    fullyQualifiedName: 'Article_atU2ADuH',
                    displayName:
                      'How to Discover Assets of Interest Child 1111',
                    childrenCount: 0,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: '45d4f5dd-5946-40d5-abcf-8ef9ff1fa64e',
    pageType: 'Article',
    name: 'Article_YjCzUcBl',
    description: '',
    fullyQualifiedName: 'Article_YjCzUcBl',
    displayName: 'This is Updated',
    childrenCount: 1,
    children: [
      {
        id: '163a3ff2-f853-4040-a180-6e23717b9cd3',
        pageType: 'Article',
        name: 'Article_mWtepYKg',
        description: '',
        fullyQualifiedName: 'Article_mWtepYKg',
        displayName: '',
        childrenCount: 0,
        children: [],
      },
    ],
  },
  {
    id: '7f774865-a111-4cfa-ad9c-a9b1b34bd6fb',
    pageType: 'Article',
    name: 'Knowledge Article with children',
    description: 'description',
    fullyQualifiedName: 'Knowledge Article with children',
    displayName: 'Knowledge Article with children',
    childrenCount: 4,
    children: [
      {
        id: '16d75850-0fd3-475d-965b-fc2d3ef38900',
        pageType: 'Article',
        name: 'Article_5K3xBSov',
        description: 'description',
        fullyQualifiedName: 'Article_5K3xBSov',
        displayName: 'Overview of Data Discovery data',
        childrenCount: 0,
        children: [],
      },
      {
        id: 'c21abbc6-5c72-4998-aacd-8c98c37be772',
        pageType: 'Article',
        name: 'Article_iSUbmc2V',
        description: '',
        fullyQualifiedName: 'Article_iSUbmc2V',
        displayName: 'Notion like editor',
        childrenCount: 1,
        children: [
          {
            id: 'b09e88ab-b2cf-4b21-9650-0a20a51ba6a8',
            pageType: 'Article',
            name: 'Article_bfPSYGdU',
            description: '',
            fullyQualifiedName: 'Article_bfPSYGdU',
            displayName: '',
            childrenCount: 1,
            children: [
              {
                id: '93f5f97e-7c92-40e4-a215-124bc1c475ee',
                pageType: 'Article',
                name: 'Article_eJAFUCiA',
                description: '',
                fullyQualifiedName: 'Article_eJAFUCiA',
                displayName: 'I updated va;',
                childrenCount: 1,
                children: [
                  {
                    id: '2097349d-d128-496d-b8f8-95474bcb3689',
                    pageType: 'Article',
                    name: 'Article_2er2H4E4',
                    description: '',
                    fullyQualifiedName: 'Article_2er2H4E4',
                    displayName: 'Updated title',
                    childrenCount: 0,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: '7d76837c-058e-4ac5-84e6-f7adb342aa79',
        pageType: 'Article',
        name: 'Article_qgqrKSse',
        description: '',
        fullyQualifiedName: 'Article_qgqrKSse',
        displayName: '',
        childrenCount: 0,
        children: [],
      },
      {
        id: '08481f32-fa7e-44bf-9cd1-5a130adb4cf8',
        pageType: 'Article',
        name: 'Article_v8dwycta',
        description: '',
        fullyQualifiedName: 'Article_v8dwycta',
        displayName: '',
        childrenCount: 0,
        children: [],
      },
    ],
  },
];

jest.mock('rest/knowledgeCenterAPI', () => ({
  getPageHierarchyFromES: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: PageHierarchy,
      paging: { limit: 100, offset: 0, total: PageHierarchy.length },
    })
  ),
  getListKnowledgePages: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [],
      paging: { limit: 0, offset: 0, total: 42 },
    })
  ),
  postKnowledgePage: jest.fn().mockImplementation(() =>
    Promise.resolve({
      id: 'new-page-id',
      name: 'newPage',
      fullyQualifiedName: 'newPage',
      displayName: '',
      description: '',
      pageType: 'Article',
    })
  ),
}));

const mockPush = jest.fn();
const fqn = 'Article_XJIGIKX2';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  useParams: jest.fn().mockImplementation(() => ({ fqn })),
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

jest.mock('utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({ fqn })),
}));

jest.mock('context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest
    .fn()
    .mockImplementation(() => ({ getResourceLimit: jest.fn() })),
}));

jest.mock('components/common/DeleteModal/DeleteModal', () =>
  jest.fn().mockReturnValue(<div data-testid="delete-widget">DeleteModal</div>)
);

describe('KnowledgePagesHierarchy', () => {
  it('should render KnowledgePagesHierarchy', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
        { wrapper: TestWrapper }
      );
    });

    expect(screen.getByTestId('knowledge-pages-hierarchy')).toBeInTheDocument();

    // should render the tree first level nodes
    expect(
      screen.getByText('How to Discover Assets of Interest')
    ).toBeInTheDocument();
    expect(screen.getByText('This is Updated')).toBeInTheDocument();
    expect(
      screen.getByText('Knowledge Article with children')
    ).toBeInTheDocument();

    // should render the page icon for each top-level node
    expect(screen.getAllByTestId('page-icon')).toHaveLength(3);
  });

  it('should render the total count from getListKnowledgePages, not the hierarchy paging', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
        { wrapper: TestWrapper }
      );
    });

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName.toLowerCase() === 'span' &&
          element?.textContent === '42 label.article-plural'
      )
    ).toBeInTheDocument();
  });

  it('should render the active node', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy
          activeKey="Article_XJIGIKX2"
          permissions={DEFAULT_ENTITY_PERMISSION}
        />,
        {
          wrapper: TestWrapper,
        }
      );
    });

    const activeNode = screen.getByTestId(
      'page-node-How to Discover Assets of Interest'
    );

    expect(activeNode).toBeInTheDocument();
    expect(activeNode).toHaveAttribute('data-isactive', 'true');
  });

  it('should render the children if node is expanded', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
        {
          wrapper: TestWrapper,
        }
      );
    });

    // The tree item row has role="row"; click the chevron button (slot="chevron")
    // inside the row for "How to Discover Assets of Interest" to expand it.
    const row = screen
      .getByText('How to Discover Assets of Interest')
      .closest('[role="row"]');
    const expandBtn = row?.querySelector(
      'button[slot="chevron"]'
    ) as HTMLElement;

    expect(expandBtn).not.toBeNull();

    await act(async () => {
      fireEvent.click(expandBtn);
    });

    expect(
      screen.getByText('How to Discover Assets of Interest Child 1')
    ).toBeInTheDocument();
  });

  it('should keep a manually collapsed ancestor of the active node collapsed', async () => {
    const { rerender } = render(
      <KnowledgePagesHierarchy
        activeKey="Article_2p7Z8MAN"
        permissions={DEFAULT_ENTITY_PERMISSION}
      />,
      { wrapper: TestWrapper }
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Manually expand the ancestor so the active descendant is visible,
    // mirroring what the activeKey-driven auto-expand effect would do.
    const row = screen
      .getByText('How to Discover Assets of Interest')
      .closest('[role="row"]');
    const chevron = row?.querySelector('button[slot="chevron"]') as HTMLElement;

    expect(chevron).not.toBeNull();

    await act(async () => {
      fireEvent.click(chevron);
    });

    expect(
      screen.getByText('How to Discover Assets of Interest Child 1')
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(chevron);
    });

    expect(
      screen.queryByText('How to Discover Assets of Interest Child 1')
    ).not.toBeInTheDocument();

    // Re-rendering with the same activeKey (e.g. triggered by an unrelated
    // hierarchy state update) must not re-expand the ancestor that was just
    // collapsed by the user.
    rerender(
      <KnowledgePagesHierarchy
        activeKey="Article_2p7Z8MAN"
        permissions={DEFAULT_ENTITY_PERMISSION}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.queryByText('How to Discover Assets of Interest Child 1')
    ).not.toBeInTheDocument();
  });

  it('delete flow should work', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy
          permissions={{ ...DEFAULT_ENTITY_PERMISSION, Delete: true }}
        />,
        {
          wrapper: TestWrapper,
        }
      );
    });

    const deleteButton = screen.getByTestId(
      `How to Discover Assets of Interest-delete-page-btn`
    );

    fireEvent.click(deleteButton);

    expect(screen.getByTestId('delete-widget')).toBeInTheDocument();
  });

  describe('loadNodeChildren', () => {
    const mockGetPageHierarchyFromES = jest.requireMock(
      'rest/knowledgeCenterAPI'
    ).getPageHierarchyFromES;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should stop fetching once a childrenCount/actual-children mismatch is detected, instead of calling the API forever', async () => {
      const mismatchedHierarchy = [
        {
          id: 'mismatch-parent-id',
          pageType: 'Article',
          name: 'Article_Mismatch',
          description: '',
          fullyQualifiedName: 'Article_Mismatch',
          displayName: 'Mismatched Count Parent',
          // childrenCount claims more children exist than any fetch will ever return.
          childrenCount: 5,
          children: [],
        },
      ];

      mockGetPageHierarchyFromES.mockImplementation((parent?: string) =>
        Promise.resolve({
          data:
            parent === 'Article_Mismatch'
              ? [
                  {
                    id: 'mismatch-child-1',
                    pageType: 'Article',
                    name: 'Article_MismatchChild',
                    description: '',
                    fullyQualifiedName:
                      'Article_Mismatch.Article_MismatchChild',
                    displayName: 'Mismatch Child',
                    childrenCount: 0,
                    children: [],
                  },
                ]
              : mismatchedHierarchy,
          paging: { limit: 100, offset: 0, total: 1 },
        })
      );

      await act(async () => {
        render(
          <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
          { wrapper: TestWrapper }
        );
      });

      const row = screen
        .getByText('Mismatched Count Parent')
        .closest('[role="row"]');
      const expandBtn = row?.querySelector(
        'button[slot="chevron"]'
      ) as HTMLElement;

      await act(async () => {
        fireEvent.click(expandBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Mismatch Child')).toBeInTheDocument();
      });

      const callCountAfterFirstLoad =
        mockGetPageHierarchyFromES.mock.calls.length;

      // Allow further effect/render cycles to run; the call count must not
      // keep growing once the single available page of children has loaded.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockGetPageHierarchyFromES.mock.calls.length).toBe(
        callCountAfterFirstLoad
      );
    });

    it('should request the next page using the actual returned count as offset, not the locally merged/deduped count', async () => {
      const parentFqn = 'Article_Paged';
      const parentHierarchy = [
        {
          id: 'paged-parent-id',
          pageType: 'Article',
          name: 'Article_Paged',
          description: '',
          fullyQualifiedName: parentFqn,
          displayName: 'Paged Parent',
          childrenCount: 101,
          children: [],
        },
      ];
      const buildPage = (index: number) => ({
        id: `paged-child-${index}`,
        pageType: 'Article',
        name: `Article_PagedChild${index}`,
        description: '',
        fullyQualifiedName: `${parentFqn}.Article_PagedChild${index}`,
        displayName: `Paged Child ${index}`,
        childrenCount: 0,
        children: [],
      });
      // First page returns a full 100-item page (children 0-99); the last of
      // those (index 99) is also returned again at the start of what a
      // naive "offset = children.length" fetch would treat as page two,
      // simulating a sibling shift. `unionBy` dedupes it, so the locally
      // merged/deduped count (100, since the duplicate collapses) would
      // equal `children.length` and mask the bug — the fix must instead
      // track that the server already returned 100 raw items and request
      // offset=100 for the next page, landing on the genuinely new item at
      // index 100 instead of skipping it.
      const firstPage = Array.from({ length: 100 }, (_, i) => buildPage(i));
      const newFinalChild = buildPage(100);

      mockGetPageHierarchyFromES.mockImplementation(
        (parent?: string, _pageType?: string, offset = 0) => {
          if (parent !== parentFqn) {
            return Promise.resolve({
              data: parentHierarchy,
              paging: { limit: 100, offset: 0, total: 1 },
            });
          }

          return Promise.resolve({
            data: offset === 0 ? firstPage : [newFinalChild],
            paging: { limit: 100, offset, total: 101 },
          });
        }
      );

      await act(async () => {
        render(
          <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
          { wrapper: TestWrapper }
        );
      });

      const row = screen.getByText('Paged Parent').closest('[role="row"]');
      const expandBtn = row?.querySelector(
        'button[slot="chevron"]'
      ) as HTMLElement;

      await act(async () => {
        fireEvent.click(expandBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Paged Child 99')).toBeInTheDocument();
      });

      // Second page fetch must use offset=100 (the count actually returned
      // by the server on page one), not the locally-mutated/deduped count.
      await waitFor(() => {
        const callsForParent = mockGetPageHierarchyFromES.mock.calls.filter(
          (call: unknown[]) => call[0] === parentFqn
        );

        expect(callsForParent).toHaveLength(2);
        expect(callsForParent[1]).toEqual([parentFqn, undefined, 100, 100]);
      });

      await waitFor(() => {
        expect(screen.getByText('Paged Child 100')).toBeInTheDocument();
      });
    });
  });

  describe('force refresh', () => {
    const mockGetPageHierarchyFromES = jest.requireMock(
      'rest/knowledgeCenterAPI'
    ).getPageHierarchyFromES;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should allow re-fetching a node that was previously marked exhausted, after a force refresh', async () => {
      const parentFqn = 'Article_Exhausted';
      const exhaustedParentHierarchy = [
        {
          id: 'exhausted-parent-id',
          pageType: 'Article',
          name: 'Article_Exhausted',
          description: '',
          fullyQualifiedName: parentFqn,
          displayName: 'Exhausted Parent',
          childrenCount: 1,
          children: [],
        },
      ];
      const onlyChild = {
        id: 'exhausted-child-1',
        pageType: 'Article',
        name: 'Article_ExhaustedChild',
        description: '',
        fullyQualifiedName: `${parentFqn}.Article_ExhaustedChild`,
        displayName: 'Exhausted Child',
        childrenCount: 0,
        children: [],
      };

      mockGetPageHierarchyFromES.mockImplementation((parent?: string) =>
        Promise.resolve({
          data: parent === parentFqn ? [onlyChild] : exhaustedParentHierarchy,
          paging: { limit: 100, offset: 0, total: 1 },
        })
      );

      const ref = createRef<KnowledgePagesHierarchyRef>();

      await act(async () => {
        render(
          <KnowledgePagesHierarchy
            permissions={DEFAULT_ENTITY_PERMISSION}
            ref={ref}
          />,
          { wrapper: TestWrapper }
        );
      });

      const row = screen.getByText('Exhausted Parent').closest('[role="row"]');
      const expandBtn = row?.querySelector(
        'button[slot="chevron"]'
      ) as HTMLElement;

      await act(async () => {
        fireEvent.click(expandBtn);
      });

      await waitFor(() => {
        expect(screen.getByText('Exhausted Child')).toBeInTheDocument();
      });

      const callCountBeforeRefresh =
        mockGetPageHierarchyFromES.mock.calls.length;

      await act(async () => {
        await ref.current?.fetchKnowledgePageHierarchy(true);
      });

      // A force refresh must clear stale exhaustion/offset tracking so the
      // node can be expanded and its children re-fetched again.
      const rowAfterRefresh = screen
        .getByText('Exhausted Parent')
        .closest('[role="row"]');
      const expandBtnAfterRefresh = rowAfterRefresh?.querySelector(
        'button[slot="chevron"]'
      ) as HTMLElement;

      await act(async () => {
        fireEvent.click(expandBtnAfterRefresh);
      });

      await waitFor(() => {
        expect(mockGetPageHierarchyFromES.mock.calls.length).toBeGreaterThan(
          callCountBeforeRefresh
        );
      });

      expect(screen.getByText('Exhausted Child')).toBeInTheDocument();
    });
  });

  describe('handleExpandAll', () => {
    const mockGetPageHierarchyFromES = jest.requireMock(
      'rest/knowledgeCenterAPI'
    ).getPageHierarchyFromES;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should page through a node with more direct children than the page limit instead of looping forever', async () => {
      const parentFqn = 'Article_ManyChildren';
      const rootHierarchy = [
        {
          id: 'many-children-parent-id',
          pageType: 'Article',
          name: 'Article_ManyChildren',
          description: '',
          fullyQualifiedName: parentFqn,
          displayName: 'Many Children Parent',
          childrenCount: 150,
          children: [],
        },
      ];
      const buildPage = (index: number) => ({
        id: `many-children-${index}`,
        pageType: 'Article',
        name: `Article_ManyChildren_${index}`,
        description: '',
        fullyQualifiedName: `${parentFqn}.Article_ManyChildren_${index}`,
        displayName: `Many Children ${index}`,
        childrenCount: 0,
        children: [],
      });
      const allChildren = Array.from({ length: 150 }, (_, i) => buildPage(i));

      mockGetPageHierarchyFromES.mockImplementation(
        (parent?: string, _pageType?: string, offset = 0, limit = 100) => {
          if (parent !== parentFqn) {
            return Promise.resolve({
              data: rootHierarchy,
              paging: { limit: 100, offset: 0, total: 1 },
            });
          }

          return Promise.resolve({
            data: allChildren.slice(offset, offset + limit),
            paging: { limit, offset, total: 150 },
          });
        }
      );

      await act(async () => {
        render(
          <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
          { wrapper: TestWrapper }
        );
      });

      const expandAllButton = screen.getByRole('button', {
        name: 'label.expand-all',
      });

      await act(async () => {
        fireEvent.click(expandAllButton);
      });

      // The while-loop must terminate: exactly 2 pages (100 + 50) fetched
      // for the 150-child node, not an unbounded number of calls.
      const callsForParent = mockGetPageHierarchyFromES.mock.calls.filter(
        (call: unknown[]) => call[0] === parentFqn
      );

      expect(callsForParent).toHaveLength(2);
      expect(callsForParent[0][2]).toBe(0);
      expect(callsForParent[1][2]).toBe(100);

      await waitFor(() => {
        expect(screen.getByText('Many Children 149')).toBeInTheDocument();
      });

      expect(
        screen.getByRole('button', { name: 'label.collapse-all' })
      ).toBeInTheDocument();
    });
  });

  describe('Scroll Pagination', () => {
    const mockGetPageHierarchyFromES = jest.requireMock(
      'rest/knowledgeCenterAPI'
    ).getPageHierarchyFromES;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    const getScrollContainer = () =>
      screen.getByTestId('article-list-container');

    const fireScrollEvent = (
      scrollHeight: number,
      scrollTop: number,
      clientHeight: number
    ) => {
      const container = getScrollContainer();
      Object.defineProperty(container, 'scrollHeight', {
        configurable: true,
        value: scrollHeight,
      });
      Object.defineProperty(container, 'scrollTop', {
        configurable: true,
        value: scrollTop,
      });
      Object.defineProperty(container, 'clientHeight', {
        configurable: true,
        value: clientHeight,
      });
      fireEvent.scroll(container);
    };

    it('should trigger pagination when scroll reaches the bottom', async () => {
      await act(async () => {
        render(
          <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
          {
            wrapper: TestWrapper,
          }
        );
      });

      // scrollTop + clientHeight (2400 + 800) === scrollHeight (3200)
      await act(async () => {
        fireScrollEvent(3200, 2400, 800);
      });

      await waitFor(() => {
        expect(mockGetPageHierarchyFromES).toHaveBeenCalledWith(
          undefined,
          undefined,
          100,
          100,
          fqn
        );
      });
    });

    it('should trigger pagination when scroll is within the bottom threshold', async () => {
      await act(async () => {
        render(
          <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
          {
            wrapper: TestWrapper,
          }
        );
      });

      // scrollTop + clientHeight (2399 + 800 = 3199) >= scrollHeight - 1 (3199)
      await act(async () => {
        fireScrollEvent(3200, 2399, 800);
      });

      await waitFor(() => {
        expect(mockGetPageHierarchyFromES).toHaveBeenCalledWith(
          undefined,
          undefined,
          100,
          100,
          fqn
        );
      });
    });

    it('should NOT trigger pagination when scroll is far from the bottom', async () => {
      await act(async () => {
        render(
          <KnowledgePagesHierarchy permissions={DEFAULT_ENTITY_PERMISSION} />,
          {
            wrapper: TestWrapper,
          }
        );
      });

      // scrollTop + clientHeight (1000 + 800 = 1800) < scrollHeight - 1 (3199)
      await act(async () => {
        fireScrollEvent(3200, 1000, 800);
      });

      await waitFor(() => {
        expect(mockGetPageHierarchyFromES).not.toHaveBeenCalledWith(
          undefined,
          undefined,
          100,
          100,
          fqn
        );
      });
    });
  });
});
