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
import { User } from 'generated/entity/teams/user';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import KnowledgePagesHierarchy from './KnowledgePagesHierarchy';

const PageHierarchy = [
  {
    id: '62bec763-522d-4b70-ad85-f487b2f6102f',
    pageType: 'Article',
    name: 'Article_XJIGIKX2',
    description: 'description',
    fullyQualifiedName: 'Article_XJIGIKX2',
    displayName: 'How to Discover Assets of Interest',
    children: [
      {
        id: 'ae65ca82-a284-4d3e-9554-dd4c94086613',
        pageType: 'Article',
        name: 'Article_2p7Z8MAN',
        description: '',
        fullyQualifiedName: 'Article_2p7Z8MAN',
        displayName: 'How to Discover Assets of Interest Child 1',
        children: [
          {
            id: '27c39402-9691-4776-becd-23a69d06db75',
            pageType: 'Article',
            name: 'Article_UqfRMCZw',
            description: '',
            fullyQualifiedName: 'Article_UqfRMCZw',
            displayName: 'How to Discover Assets of Interest Child 11',
            children: [
              {
                id: '838c8ce7-b949-4f58-9a6c-1ef268fc920d',
                pageType: 'Article',
                name: 'Article_LtyX9wX3',
                description: '',
                fullyQualifiedName: 'Article_LtyX9wX3',
                displayName: 'How to Discover Assets of Interest Child 111',
                children: [
                  {
                    id: 'a31ca2ba-e841-4673-bbc2-478f0dea4692',
                    pageType: 'Article',
                    name: 'Article_atU2ADuH',
                    description: '',
                    fullyQualifiedName: 'Article_atU2ADuH',
                    displayName:
                      'How to Discover Assets of Interest Child 1111',
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
    children: [
      {
        id: '163a3ff2-f853-4040-a180-6e23717b9cd3',
        pageType: 'Article',
        name: 'Article_mWtepYKg',
        description: '',
        fullyQualifiedName: 'Article_mWtepYKg',
        displayName: '',
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
    children: [
      {
        id: '16d75850-0fd3-475d-965b-fc2d3ef38900',
        pageType: 'Article',
        name: 'Article_5K3xBSov',
        description: 'description',
        fullyQualifiedName: 'Article_5K3xBSov',
        displayName: 'Overview of Data Discovery data',
        children: [],
      },
      {
        id: 'c21abbc6-5c72-4998-aacd-8c98c37be772',
        pageType: 'Article',
        name: 'Article_iSUbmc2V',
        description:
          '<p></p><p><strong>This is the simple test now I will select and show you the bubble menu</strong></p><p></p>',
        fullyQualifiedName: 'Article_iSUbmc2V',
        displayName: 'Notion like editor',
        children: [
          {
            id: 'b09e88ab-b2cf-4b21-9650-0a20a51ba6a8',
            pageType: 'Article',
            name: 'Article_bfPSYGdU',
            description: '',
            fullyQualifiedName: 'Article_bfPSYGdU',
            displayName: '',
            children: [
              {
                id: '93f5f97e-7c92-40e4-a215-124bc1c475ee',
                pageType: 'Article',
                name: 'Article_eJAFUCiA',
                description: '',
                fullyQualifiedName: 'Article_eJAFUCiA',
                displayName: 'I updated va;',
                children: [
                  {
                    id: '2097349d-d128-496d-b8f8-95474bcb3689',
                    pageType: 'Article',
                    name: 'Article_2er2H4E4',
                    description: '<p></p><p></p><p></p>',
                    fullyQualifiedName: 'Article_2er2H4E4',
                    displayName: 'Updated title',
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
        children: [],
      },
      {
        id: '08481f32-fa7e-44bf-9cd1-5a130adb4cf8',
        pageType: 'Article',
        name: 'Article_v8dwycta',
        description: '',
        fullyQualifiedName: 'Article_v8dwycta',
        displayName: '',
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

jest.mock('crypto-random-string-with-promisify-polyfill', () =>
  jest.fn().mockReturnValue('randomString')
);

const mockUserData: User = {
  name: 'aaron_johnson0',
  email: 'testUser1@email.com',
  id: '9304f330-2e9a-4513-883b-c939e29683a8',
};

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest
    .fn()
    .mockImplementation(() => ({ getResourceLimit: jest.fn() })),
}));

jest.mock('components/common/DeleteWidget/DeleteWidgetModal', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="delete-widget">DeleteWidgetModal</div>)
);

describe('KnowledgePagesHierarchy', () => {
  it('should render KnowledgePagesHierarchy', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy
          isPageHeaderAvailable={false}
          permissions={DEFAULT_ENTITY_PERMISSION}
        />,
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

    // should render the collapse button
    expect(
      screen.getByTestId('How to Discover Assets of Interest-collapse-icon')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('This is Updated-collapse-icon')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('Knowledge Article with children-collapse-icon')
    ).toBeInTheDocument();

    // should render the page icon
    expect(screen.getAllByTestId('page-icon')).toHaveLength(3);
  });

  it('should render the active node', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy
          isPageHeaderAvailable
          activeKey="Article_XJIGIKX2"
          permissions={DEFAULT_ENTITY_PERMISSION}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(
      screen.getByTestId('page-node-How to Discover Assets of Interest')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('page-node-How to Discover Assets of Interest')
    ).toHaveAttribute('data-isactive', 'true');
  });

  it('should render the children if node is expanded', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy
          isPageHeaderAvailable={false}
          permissions={DEFAULT_ENTITY_PERMISSION}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const collapseButton = screen.getByTestId(
      `How to Discover Assets of Interest-collapse-icon`
    );

    fireEvent.click(collapseButton);

    expect(
      screen.getByText('How to Discover Assets of Interest Child 1')
    ).toBeInTheDocument();
  });

  it('delete flow should work', async () => {
    await act(async () => {
      render(
        <KnowledgePagesHierarchy
          isPageHeaderAvailable={false}
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

    const mockScrollFn = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      // Mock window.innerHeight
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1000,
      });
    });

    it('should trigger pagination when scroll reaches bottom (exact match)', async () => {
      await act(async () => {
        render(
          <KnowledgePagesHierarchy
            isPageHeaderAvailable={false}
            permissions={DEFAULT_ENTITY_PERMISSION}
          />,
          { wrapper: MemoryRouter }
        );
      });

      const treeElement = screen.getByTestId('knowledge-pages-hierarchy');
      const scrollableElement = treeElement.getElementsByClassName(
        'ant-tree-list-holder'
      )[0];

      // Set the scroll properties on the element
      Object.defineProperty(scrollableElement, 'scrollHeight', {
        value: 3200,
        writable: true,
        configurable: true,
      });

      // Try a different approach for scrollTop
      Object.defineProperty(scrollableElement, 'scrollTop', {
        get: () => 2390,
        set: mockScrollFn,
        configurable: true,
      });

      // Simulate scroll event with scrollHeight exactly at windowHeight - 190
      const scrollEvent = {
        currentTarget: {
          ...scrollableElement,
          scrollHeight: 3200,
          scrollTop: 2390,
        },
      };

      await act(async () => {
        fireEvent.scroll(scrollableElement, scrollEvent);
      });

      await waitFor(() => {
        expect(mockGetPageHierarchyFromES).toHaveBeenCalledWith(
          undefined,
          undefined,
          100, // offset should be incremented by 100
          100,
          fqn
        );
      });
    });

    it('should trigger pagination when scrollHeight is within range (windowHeight - 191)', async () => {
      await act(async () => {
        render(
          <KnowledgePagesHierarchy
            isPageHeaderAvailable={false}
            permissions={DEFAULT_ENTITY_PERMISSION}
          />,
          { wrapper: MemoryRouter }
        );
      });

      const treeElement = screen.getByTestId('knowledge-pages-hierarchy');
      const scrollableElement = treeElement.getElementsByClassName(
        'ant-tree-list-holder'
      )[0];

      // Set the scroll properties on the element
      Object.defineProperty(scrollableElement, 'scrollHeight', {
        value: 3200,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(scrollableElement, 'scrollTop', {
        get: () => 2391,
        set: mockScrollFn,
        configurable: true,
      });

      // Simulate scroll event with scrollHeight at windowHeight - 191 (within -1 range)
      const scrollEvent = {
        currentTarget: {
          ...scrollableElement,
          scrollHeight: 3200,
          scrollTop: 2391,
        },
      };
      fireEvent.scroll(scrollableElement, scrollEvent);

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

    it('should trigger pagination when scrollHeight is within range (windowHeight - 189)', async () => {
      await act(async () => {
        render(
          <KnowledgePagesHierarchy
            isPageHeaderAvailable={false}
            permissions={DEFAULT_ENTITY_PERMISSION}
          />,
          { wrapper: MemoryRouter }
        );
      });

      const treeElement = screen.getByTestId('knowledge-pages-hierarchy');
      const scrollableElement = treeElement.getElementsByClassName(
        'ant-tree-list-holder'
      )[0];
      // Set the scroll properties on the element
      Object.defineProperty(scrollableElement, 'scrollHeight', {
        value: 3200,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(scrollableElement, 'scrollTop', {
        get: () => 2389,
        set: mockScrollFn,
        configurable: true,
      });

      // Simulate scroll event with scrollHeight at windowHeight - 189 (within +1 range)
      const scrollEvent = {
        currentTarget: {
          ...scrollableElement,
          scrollHeight: 3200,
          scrollTop: 2389,
        },
      };

      fireEvent.scroll(scrollableElement, scrollEvent);

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

    it('should NOT trigger pagination when scrollHeight is outside range (too high)', async () => {
      await act(async () => {
        render(
          <KnowledgePagesHierarchy
            isPageHeaderAvailable={false}
            permissions={DEFAULT_ENTITY_PERMISSION}
          />,
          { wrapper: MemoryRouter }
        );
      });

      const treeElement = screen.getByTestId('knowledge-pages-hierarchy');
      const scrollableElement = treeElement.getElementsByClassName(
        'ant-tree-list-holder'
      )[0];

      // Set the scroll properties on the element
      Object.defineProperty(scrollableElement, 'scrollHeight', {
        value: 1000,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(scrollableElement, 'scrollTop', {
        get: () => 800,
        set: mockScrollFn,
        configurable: true,
      });

      // Simulate scroll event with scrollHeight at windowHeight - 191 (within -1 range)
      const scrollEvent = {
        currentTarget: {
          ...scrollableElement,
          scrollHeight: 1000,
          scrollTop: 800,
        },
      };

      fireEvent.scroll(scrollableElement, scrollEvent);

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

    it('should NOT trigger pagination when scrollHeight is outside range (too low)', async () => {
      await act(async () => {
        render(
          <KnowledgePagesHierarchy
            isPageHeaderAvailable={false}
            permissions={DEFAULT_ENTITY_PERMISSION}
          />,
          { wrapper: MemoryRouter }
        );
      });

      const treeElement = screen.getByTestId('knowledge-pages-hierarchy');
      const scrollableElement = treeElement.getElementsByClassName(
        'ant-tree-list-holder'
      )[0];

      // Set the scroll properties on the element
      Object.defineProperty(scrollableElement, 'scrollHeight', {
        value: 1000,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(scrollableElement, 'scrollTop', {
        get: () => 820,
        set: mockScrollFn,
        configurable: true,
      });

      // Simulate scroll event with scrollHeight at windowHeight - 191 (within -1 range)
      const scrollEvent = {
        currentTarget: {
          ...scrollableElement,
          scrollHeight: 1000,
          scrollTop: 820,
        },
      };

      fireEvent.scroll(scrollableElement, scrollEvent);

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
