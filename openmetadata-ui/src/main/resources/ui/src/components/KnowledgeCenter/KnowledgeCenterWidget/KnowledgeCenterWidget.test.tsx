/*
 *  Copyright 2023 Collate.
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
import { MOCK_KNOWLEDGE_PAGE_LIST } from '../../../pages/KnowledgeCenterListPage/KnowledgeCenterListPage.mock';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import KnowledgeCenterWidget from './KnowledgeCenterWidget';

const mockHandleRemoveWidget = jest.fn();

jest.mock('../../../rest/knowledgeCenterAPI', () => ({
  getListKnowledgePages: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: {
      id: '2e424734-761a-443f-bf2a-a5b361823c80',
      type: 'user',
      name: 'aaron_johnson0',
      fullyQualifiedName: 'aaron_johnson0',
      displayName: 'Aaron Johnson',
      deleted: false,
    },
  }),
}));

jest.mock('components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock(
  'components/MyData/Widgets/Common/WidgetEmptyState/WidgetEmptyState',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="widget-empty-state">WidgetEmptyState</div>
      ))
);

jest.mock('utils/EntityNameUtils', () => ({
  getEntityName: jest.fn(),
}));

describe('Knowledge center widget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the empty placeholder if no data', async () => {
    render(<KnowledgeCenterWidget widgetKey="KnowledgeCenterWidget" />, {
      wrapper: MemoryRouter,
    });

    await waitFor(() => {
      expect(screen.getByTestId('widget-empty-state')).toBeInTheDocument();
    });
  });

  it('should render the article list', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: MOCK_KNOWLEDGE_PAGE_LIST, paging: { total: 15 } })
    );

    render(<KnowledgeCenterWidget widgetKey="KnowledgeCenterWidget" />, {
      wrapper: MemoryRouter,
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('article-entry')).toHaveLength(
        MOCK_KNOWLEDGE_PAGE_LIST.length
      );
    });
  });

  it('should not display edit controls if isEditView is false', async () => {
    await act(async () => {
      render(<KnowledgeCenterWidget widgetKey="KnowledgeCenterWidget" />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.queryByTestId('more-options-button')).toBeNull();
    expect(screen.queryByTestId('drag-widget-button')).toBeNull();
  });

  it('should call the handleRemoveWidget function with the passed widget Key', async () => {
    await act(async () => {
      render(
        <KnowledgeCenterWidget
          isEditView
          handleRemoveWidget={mockHandleRemoveWidget}
          widgetKey="KnowledgeCenterWidget"
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    // Click the more options button to open the dropdown
    fireEvent.click(screen.getByTestId('more-options-button'));

    // Wait for the dropdown menu to appear and click the remove option
    await waitFor(() => {
      const removeOption = screen.getByText('label.remove');
      fireEvent.click(removeOption);
    });

    expect(mockHandleRemoveWidget).toHaveBeenCalledWith(
      'KnowledgeCenterWidget'
    );
  });

  it('should render link and article icons properly according to the pageType', async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: MOCK_KNOWLEDGE_PAGE_LIST, paging: { total: 15 } })
    );

    await act(async () => {
      render(<KnowledgeCenterWidget widgetKey="KnowledgeCenterWidget" />, {
        wrapper: MemoryRouter,
      });
    });

    await waitFor(() => {
      const linkIcons = screen.getAllByTestId('link-icon');
      const articleIcons = screen.getAllByTestId('article-icon');

      expect(linkIcons).toHaveLength(7);
      expect(articleIcons).toHaveLength(1);
    });
  });

  it("should render url as a link for quick link with target as '_blank'", async () => {
    (getListKnowledgePages as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: MOCK_KNOWLEDGE_PAGE_LIST, paging: { total: 15 } })
    );

    await act(async () => {
      render(<KnowledgeCenterWidget widgetKey="KnowledgeCenterWidget" />, {
        wrapper: MemoryRouter,
      });
    });

    await waitFor(() => {
      const quickLink = screen.getAllByTestId('quick-link-link');

      expect(quickLink[0]).toHaveAttribute('target', '_blank');
      expect(quickLink[0]).toHaveAttribute(
        'href',
        'https://docs.open-metadata.org/v1.1.x/how-to-guides/openmetadata'
      );

      const knowledgePage = screen.getAllByTestId('knowledge-page-link');

      expect(knowledgePage[0]).toHaveAttribute('target', '_self');
      expect(knowledgePage[0]).toHaveAttribute(
        'href',
        '/context-center/articles/Article_oRKYYTCu'
      );
    });
  });
});
