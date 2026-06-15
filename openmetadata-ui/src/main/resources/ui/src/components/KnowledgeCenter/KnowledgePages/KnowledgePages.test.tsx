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
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react-test-renderer';
import { MOCK_KNOWLEDGE_PAGES } from '../../../pages/KnowledgePage/KnowledgePage.mock';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import KnowledgePages from './KnowledgePages';

const mockProps = {
  entityId: '6a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2',
  entityType: 'table',
};

jest.mock('rest/knowledgeCenterAPI');

jest.mock('components/Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useGenericContext: jest.fn().mockImplementation(() => ({
    data: { id: mockProps.entityId },
    type: mockProps.entityType,
    filterWidgets: jest.fn(),
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
    expect(screen.getByText('label.knowledge-center')).toBeInTheDocument();

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
});
