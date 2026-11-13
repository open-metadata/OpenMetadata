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
import { TreeSelectNode } from '@openmetadata/ui-core-components';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import {
  addKnowledgePageUsage,
  getListKnowledgePages,
  removeKnowledgePageUsage,
} from '../../../rest/knowledgeCenterAPI';
import KnowledgePages from './KnowledgePages';
import { MOCK_KNOWLEDGE_PAGES } from './KnowledgePages.mock';

const mockProps = {
  entityId: '6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2',
  entityType: 'table',
};

const mockFilterWidgets = jest.fn();
const mockPermissions = { EditAll: false };
const mockArticlePermissions = { EditAll: true };

jest.mock('context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    permissions: { page: mockArticlePermissions },
  }),
}));

jest.mock('rest/knowledgeCenterAPI');

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  TreeSelect: ({
    value = [],
    onChange,
    renderTrigger,
  }: {
    value?: TreeSelectNode[];
    onChange: (nodes: TreeSelectNode[]) => void;
    renderTrigger: (props: { toggle: () => void }) => React.ReactNode;
  }) => (
    <>
      {renderTrigger({ toggle: jest.fn() })}
      <button
        aria-label="apply"
        data-testid="apply-article-picker"
        onClick={() =>
          // keep the second listed page, drop the first, add a new one
          onChange([
            ...value.slice(1),
            { id: 'new-page-id', label: 'New', value: 'new-page-id' },
          ])
        }
      />
    </>
  ),
}));

jest.mock('components/Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('components/Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: { id: mockProps.entityId },
    type: mockProps.entityType,
    filterWidgets: mockFilterWidgets,
    permissions: mockPermissions,
  })),
}));

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation(
      ({ displayName }: { displayName: string }) => displayName
    ),
}));

describe('KnowledgePages', () => {
  it('should render correctly', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [...MOCK_KNOWLEDGE_PAGES],
        paging: {
          total: 10,
        },
      })
    );
    await act(async () => {
      render(<KnowledgePages />, { wrapper: MemoryRouter });
    });

    expect(screen.getByTestId('knowledge-pages')).toBeInTheDocument();
    expect(screen.getByText('label.context-center')).toBeInTheDocument();

    // article page
    expect(screen.getByText('Data Collaboration')).toBeInTheDocument();
    expect(screen.getByTestId('article-icon')).toBeInTheDocument();

    // quick link page
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByTestId('link-icon')).toBeInTheDocument();
  });

  it('should render the correct page link for quick link', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [MOCK_KNOWLEDGE_PAGES[1]],
        paging: {
          total: 10,
        },
      })
    );
    await act(async () => {
      render(<KnowledgePages />, { wrapper: MemoryRouter });
    });

    // quick link page
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByTestId('link-icon')).toBeInTheDocument();

    const pageLink = screen.getByTestId('page-link');

    expect(pageLink).toBeInTheDocument();
    expect(pageLink).toHaveAttribute(
      'href',
      'https://blog.open-metadata.org/openmetadata-release-1-2-531f0e3c6d9a'
    );
    expect(pageLink).toHaveAttribute('target', '_blank');
  });

  it('should neutralise a javascript: quick link url (XSS guard)', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [
          {
            ...MOCK_KNOWLEDGE_PAGES[1],
            page: { url: 'javascript:alert(document.domain)' },
          },
        ],
        paging: {
          total: 10,
        },
      })
    );
    await act(async () => {
      render(<KnowledgePages />, { wrapper: MemoryRouter });
    });

    const pageLink = screen.getByTestId('page-link');

    // getSafeHttpUrl drops the javascript: scheme, so the '#' fallback is used —
    // React Router renders that as href="/", never the script url.
    expect(pageLink.getAttribute('href')).not.toContain('javascript:');
    expect(pageLink).toHaveAttribute('href', '/');
  });

  it('should not render when data is empty', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [],
        paging: {
          total: 0,
        },
      })
    );
    await act(async () => {
      render(<KnowledgePages />, { wrapper: MemoryRouter });
    });

    expect(screen.queryByTestId('knowledge-pages')).not.toBeInTheDocument();
  });

  it('should not render when api fails', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.reject({
        data: undefined,
        paging: {
          total: 0,
        },
      })
    );
    await act(async () => {
      render(<KnowledgePages />, { wrapper: MemoryRouter });
    });

    expect(screen.queryByTestId('knowledge-pages')).not.toBeInTheDocument();
  });

  it('should render view all link if total length is greater than 10', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [...MOCK_KNOWLEDGE_PAGES],
        paging: {
          total: 22,
        },
      })
    );
    await act(async () => {
      render(<KnowledgePages />, { wrapper: MemoryRouter });
    });

    expect(
      screen.getByTestId('view-all-data-asset-related-articles')
    ).toBeInTheDocument();
  });

  it('view all should have correct link', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [...MOCK_KNOWLEDGE_PAGES],
        paging: {
          total: 22,
        },
      })
    );
    await act(async () => {
      render(<KnowledgePages />, { wrapper: MemoryRouter });
    });

    const viewAllLink = screen.getByTestId(
      'view-all-data-asset-related-articles'
    );

    expect(viewAllLink).toHaveAttribute(
      'href',
      `/context-center/filter?entityId=${mockProps.entityId}&entityType=${mockProps.entityType}`
    );
  });

  it('should not render view all link if total length is less than or equal to 10', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        data: [...MOCK_KNOWLEDGE_PAGES],
        paging: {
          total: 10,
        },
      })
    );
    await act(async () => {
      render(<KnowledgePages />, { wrapper: MemoryRouter });
    });

    expect(
      screen.queryByTestId('view-all-data-asset-related-articles')
    ).not.toBeInTheDocument();
  });

  it('should not render and call the api when entityId and entityType are empty', async () => {
    mockProps.entityId = '';
    mockProps.entityType = '';
    await act(async () => {
      render(<KnowledgePages />, {
        wrapper: MemoryRouter,
      });
    });

    expect(getListKnowledgePages).not.toHaveBeenCalled();

    expect(screen.queryByTestId('knowledge-pages')).not.toBeInTheDocument();
  });

  describe('linking articles', () => {
    beforeEach(() => {
      mockPermissions.EditAll = true;
      mockProps.entityId =
        '6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2';
      mockProps.entityType = 'table';
    });

    afterEach(() => {
      mockPermissions.EditAll = false;
      mockArticlePermissions.EditAll = true;
      mockProps.entityType = 'table';
    });

    it('should hide the empty widget when the user cannot edit articles', async () => {
      mockArticlePermissions.EditAll = false;
      (getListKnowledgePages as jest.Mock).mockResolvedValueOnce({
        data: [],
        paging: { total: 0 },
      });
      await act(async () => {
        render(<KnowledgePages />, { wrapper: MemoryRouter });
      });

      expect(
        screen.queryByTestId('edit-linked-articles')
      ).not.toBeInTheDocument();
    });

    it('should not offer linking on a domain page', async () => {
      mockProps.entityType = 'domain';
      (getListKnowledgePages as jest.Mock).mockResolvedValueOnce({
        data: [...MOCK_KNOWLEDGE_PAGES],
        paging: { total: 2 },
      });
      await act(async () => {
        render(<KnowledgePages />, { wrapper: MemoryRouter });
      });

      expect(screen.getByTestId('knowledge-pages')).toBeInTheDocument();
      expect(
        screen.queryByTestId('edit-linked-articles')
      ).not.toBeInTheDocument();
    });

    it('should hide the widget when the article list fails to load', async () => {
      (getListKnowledgePages as jest.Mock).mockRejectedValueOnce(
        new Error('boom')
      );
      await act(async () => {
        render(<KnowledgePages />, { wrapper: MemoryRouter });
      });

      expect(
        screen.queryByTestId('edit-linked-articles')
      ).not.toBeInTheDocument();
    });

    it('should render an add action instead of hiding when empty and editable', async () => {
      (getListKnowledgePages as jest.Mock).mockResolvedValueOnce({
        data: [],
        paging: { total: 0 },
      });
      mockFilterWidgets.mockClear();
      await act(async () => {
        render(<KnowledgePages />, { wrapper: MemoryRouter });
      });

      expect(screen.getByTestId('edit-linked-articles')).toBeInTheDocument();
      expect(mockFilterWidgets).not.toHaveBeenCalled();
    });

    it('should link added and unlink removed articles on save', async () => {
      (getListKnowledgePages as jest.Mock).mockResolvedValue({
        data: [...MOCK_KNOWLEDGE_PAGES],
        paging: { total: 2 },
      });
      (addKnowledgePageUsage as jest.Mock).mockResolvedValue({});
      (removeKnowledgePageUsage as jest.Mock).mockResolvedValue({});
      await act(async () => {
        render(<KnowledgePages />, { wrapper: MemoryRouter });
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('apply-article-picker'));
      });

      const entityRef = { id: mockProps.entityId, type: mockProps.entityType };

      expect(addKnowledgePageUsage).toHaveBeenCalledTimes(1);
      expect(addKnowledgePageUsage).toHaveBeenCalledWith('new-page-id', [
        entityRef,
      ]);
      expect(removeKnowledgePageUsage).toHaveBeenCalledTimes(1);
      expect(removeKnowledgePageUsage).toHaveBeenCalledWith(
        MOCK_KNOWLEDGE_PAGES[0].id,
        [entityRef]
      );
    });
  });
});
