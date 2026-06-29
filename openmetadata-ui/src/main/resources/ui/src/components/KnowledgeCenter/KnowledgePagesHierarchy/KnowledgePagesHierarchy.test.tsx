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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import KnowledgePagesHierarchy from './KnowledgePagesHierarchy';

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
        { wrapper: MemoryRouter }
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
        <KnowledgePagesHierarchy
          permissions={DEFAULT_ENTITY_PERMISSION}
        />,
        { wrapper: MemoryRouter }
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
          wrapper: MemoryRouter,
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
          wrapper: MemoryRouter,
        }
      );
    });

    // The tree item row has role="row"; click the chevron button (slot="chevron")
    // inside the row for "How to Discover Assets of Interest" to expand it.
    const row = screen
      .getByText('How to Discover Assets of Interest')
      .closest('[role="row"]');
    const expandBtn = row?.querySelector('button[slot="chevron"]');

    expect(expandBtn).not.toBeNull();

    await act(async () => {
      fireEvent.click(expandBtn!);
    });

    expect(
      screen.getByText('How to Discover Assets of Interest Child 1')
    ).toBeInTheDocument();
  });

  it('delete flow should work', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy
          permissions={{ ...DEFAULT_ENTITY_PERMISSION, Delete: true }}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const deleteButton = screen.getByTestId(
      `How to Discover Assets of Interest-delete-page-btn`
    );

    fireEvent.click(deleteButton);

    expect(screen.getByTestId('delete-widget')).toBeInTheDocument();
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
            wrapper: MemoryRouter,
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
            wrapper: MemoryRouter,
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
            wrapper: MemoryRouter,
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
