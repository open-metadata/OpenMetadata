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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Settings } from 'luxon';
import '../../../test/unit/mocks/mui.mock';

import { usePermissionProvider } from 'context/PermissionProvider/PermissionProvider';
import { User } from 'generated/entity/teams/user';
import { MemoryRouter } from 'react-router-dom';
import KnowledgeCard, { KnowledgeCardProps } from './KnowledgeCard';
import {
  KNOWLEDGE_PAGE_MOCK_DATA,
  KNOWLEDGE_PAGE_PARTIAL_MOCK_DATA,
  KNOWLEDGE_PAGE_TAGS,
  QUICK_LINK_MOCK_DATA,
} from './KnowledgeCard.mock';

const systemLocale = Settings.defaultLocale;
const systemZoneName = Settings.defaultZone;

const mockOnUpdateVote = jest.fn();
const mockOnFollow = jest.fn();
const mockOnUnFollow = jest.fn();

const mockProps: KnowledgeCardProps = {
  knowledgeItem: KNOWLEDGE_PAGE_MOCK_DATA,
  onUpdateVote: mockOnUpdateVote,
  onFollow: mockOnFollow,
  onUnFollow: mockOnUnFollow,
  onDelete: jest.fn(),
  onRefreshTagsCategory: jest.fn(),
  readonly: false,
};

const mockUserData: User = {
  name: 'aaron_johnson0',
  email: 'testUser1@email.com',
  id: '9304f330-2e9a-4513-883b-c939e29683a8',
};

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: mockUserData,
    userProfilePics: {},
  })),
}));

jest.mock(
  'components/common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    jest.fn().mockReturnValue(<div data-testid="viewer-container">Viewer</div>)
);
jest.mock(
  'components/common/PopOverCard/UserPopOverCard',
  () =>
    jest
      .fn()
      .mockImplementation(({ userName }) => (
        <div data-testid="owner-name">{userName}</div>
      ))
);

jest.mock('../QuickLinkFormModal/QuickLinkFormModal', () => ({
  QuickLinkFormModal: jest
    .fn()
    .mockReturnValue(
      <div data-testid="quick-link-form-modal">QuickLinkFormModal</div>
    ),
}));

jest.mock(
  'components/common/DeleteWidget/DeleteWidgetModal',
  () =>
    jest
      .fn()
      .mockReturnValue(
        <div data-testid="delete-widget-modal">DeleteWidgetModal</div>
      )
);

jest.mock(
  'context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockReturnValue({
      getEntityPermissionByFqn: jest.fn().mockImplementation(() => ({
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditTags: true,
      })),
    }),
  })
);

describe('Knowledge Card', () => {
  beforeAll(() => {
    // Explicitly set locale and time zone to make sure date time manipulations and literal
    // results are consistent regardless of where tests are run
    Settings.defaultLocale = 'en-US';
    Settings.defaultZone = 'UTC';
  });

  afterAll(() => {
    // Restore locale and time zone
    Settings.defaultLocale = systemLocale;
    Settings.defaultZone = systemZoneName;
  });

  it('Should render the knowledge card', async () => {
    render(<KnowledgeCard {...mockProps} />, {
      wrapper: MemoryRouter,
    });
    const dateOwnerElement = screen.getByTestId('date-owner-col');
    const titleDescriptionElement = screen.getByTestId(
      'knowledge-title-description'
    );

    const metadataElement = screen.getByTestId('knowledge-metadata');

    expect(dateOwnerElement).toBeInTheDocument();
    expect(titleDescriptionElement).toBeInTheDocument();
    expect(metadataElement).toBeInTheDocument();

    const ownerName = screen.getByTestId('owner-link');

    expect(ownerName).toHaveTextContent('admin');

    const lastEditedByName = screen.getByTestId('owner-name');

    const updatedAt = screen.getByTestId('updated-at');

    expect(updatedAt).toHaveTextContent('Sep 20, 2023');

    const title = screen.getByTestId('entity-header-display-name');

    expect(title).toHaveTextContent('OpenMetadata 1.1.0 Release UI');

    const description = screen.getByTestId('viewer-container');

    expect(description).toBeInTheDocument();

    const upVoteButton = screen.getByTestId('up-vote-btn');
    const upVoteCount = screen.getByTestId('up-vote-count');

    expect(upVoteButton).toBeInTheDocument();
    expect(upVoteCount).toHaveTextContent('1');

    const downVoteButton = screen.getByTestId('down-vote-btn');
    const downVoteCount = screen.getByTestId('down-vote-count');

    expect(downVoteButton).toBeInTheDocument();
    expect(downVoteCount).toHaveTextContent('0');

    const updatedAtMetadata = screen.getByTestId('updated-at-metadata');

    expect(lastEditedByName).toHaveTextContent('sachinchaurasiya87');
    expect(updatedAtMetadata).toHaveTextContent('Sep 20, 2023');

    const bookmarkBtn = screen.getByTestId('bookmark-btn');

    expect(bookmarkBtn).toBeInTheDocument();
    expect(bookmarkBtn).toHaveAttribute('data-isfollowing', 'true');

    KNOWLEDGE_PAGE_TAGS.forEach((tag) => {
      const tagElement = screen.getByText(tag.name);

      expect(tagElement).toBeInTheDocument();
    });
  });

  it('Should render the fallback data', async () => {
    render(
      <KnowledgeCard
        {...mockProps}
        knowledgeItem={KNOWLEDGE_PAGE_PARTIAL_MOCK_DATA}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const dateOwnerElement = screen.getByTestId('date-owner-col');
    const titleDescriptionElement = screen.getByTestId(
      'knowledge-title-description'
    );

    const metadataElement = screen.getByTestId('knowledge-metadata');

    expect(dateOwnerElement).toBeInTheDocument();
    expect(titleDescriptionElement).toBeInTheDocument();
    expect(metadataElement).toBeInTheDocument();

    const ownerName = screen.getByTestId('owner-link');

    expect(ownerName).toHaveTextContent('label.no-entity');

    const updatedAt = screen.getByTestId('updated-at');

    expect(updatedAt).toHaveTextContent('Sep 20, 2023');

    const title = screen.getByTestId('entity-header-display-name');

    expect(title).toHaveTextContent('OpenMetadata 1.1.0 Release UI');

    const noDescription = screen.getByTestId('no-description');

    expect(noDescription).toHaveTextContent('label.no-description');

    const upVoteCount = screen.getByTestId('up-vote-count');

    expect(upVoteCount).toHaveTextContent('0');

    const downVoteCount = screen.getByTestId('down-vote-count');

    expect(downVoteCount).toHaveTextContent('0');

    const bookmarkBtn = screen.getByTestId('bookmark-btn');

    expect(bookmarkBtn).toBeInTheDocument();
    expect(bookmarkBtn).toHaveAttribute('data-isfollowing', 'false');
  });

  it('OnUpdateVote Should work', async () => {
    render(
      <KnowledgeCard
        {...mockProps}
        knowledgeItem={KNOWLEDGE_PAGE_PARTIAL_MOCK_DATA}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    // upVote simulation
    const upVoteButton = screen.getByTestId('up-vote-btn');

    fireEvent.click(upVoteButton);

    expect(mockOnUpdateVote).toHaveBeenCalledWith(
      {
        updatedVoteType: 'votedUp',
      },
      '8e6427d6-98cc-4334-b2f2-15fb62bde887'
    );

    // downVote simulation
    const downVoteButton = screen.getByTestId('down-vote-btn');

    fireEvent.click(downVoteButton);

    expect(mockOnUpdateVote).toHaveBeenCalledWith(
      {
        updatedVoteType: 'votedDown',
      },
      '8e6427d6-98cc-4334-b2f2-15fb62bde887'
    );
  });

  it('onFollow Should work', async () => {
    render(
      <KnowledgeCard
        {...mockProps}
        knowledgeItem={KNOWLEDGE_PAGE_PARTIAL_MOCK_DATA}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const bookmarkBtn = screen.getByTestId('bookmark-btn');

    fireEvent.click(bookmarkBtn);

    expect(mockOnFollow).toHaveBeenCalledWith(
      '8e6427d6-98cc-4334-b2f2-15fb62bde887'
    );
  });

  it('onUnFollow Should work', async () => {
    render(<KnowledgeCard {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const bookmarkBtn = screen.getByTestId('bookmark-btn');

    fireEvent.click(bookmarkBtn);

    expect(mockOnUnFollow).toHaveBeenCalledWith(
      '8e6427d6-98cc-4334-b2f2-15fb62bde887'
    );
  });

  it('should render the edit and delete button for quick link', async () => {
    await act(async () => {
      render(
        <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const editButton = screen.getByTestId('edit-quick-link-btn');
    const deleteButton = screen.getByTestId('delete-quick-link-btn');

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it('edit should render the quick link modal', async () => {
    await act(async () => {
      render(
        <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const editButton = screen.getByTestId('edit-quick-link-btn');

    fireEvent.click(editButton);

    const quickLinkFormModal = screen.getByTestId('quick-link-form-modal');

    expect(quickLinkFormModal).toBeInTheDocument();
  });

  it('delete should render the delete widget modal', async () => {
    await act(async () => {
      render(
        <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const deleteButton = screen.getByTestId('delete-quick-link-btn');

    fireEvent.click(deleteButton);

    const deleteWidgetModal = screen.getByTestId('delete-widget-modal');

    expect(deleteWidgetModal).toBeInTheDocument();
  });

  it('quick link title should have target as _blank', async () => {
    render(
      <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const quickLinkTitle = screen.getByTestId('knowledge-link');

    expect(quickLinkTitle).toHaveAttribute('target', '_blank');
  });

  it("should not render the edit and delete button for quick link if user doesn't have permission", async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockReturnValue({
        Create: false,
        Delete: false,
        ViewAll: false,
        EditAll: false,
        EditDescription: false,
        EditDisplayName: false,
        EditTags: false,
      }),
    }));
    render(
      <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editButton = screen.queryByTestId('edit-quick-link-btn');
    const deleteButton = screen.queryByTestId('delete-quick-link-btn');

    expect(editButton).not.toBeInTheDocument();
    expect(deleteButton).not.toBeInTheDocument();
  });

  it('should render the edit button for quick link if user have some edit permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockReturnValue({
        Create: false,
        Delete: false,
        ViewAll: false,
        EditAll: false,
        EditDescription: true,
        EditDisplayName: false,
        EditTags: true,
      }),
    }));
    await act(async () => {
      render(
        <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    const editButton = screen.getByTestId('edit-quick-link-btn');

    expect(editButton).toBeInTheDocument();
  });

  it('should not render the votes-section and bookmark-section if readonly is true', async () => {
    render(<KnowledgeCard {...mockProps} readonly />, {
      wrapper: MemoryRouter,
    });

    const voteSection = screen.queryByTestId('votes-section');
    const bookmarkSection = screen.queryByTestId('bookmark-section');

    expect(voteSection).not.toBeInTheDocument();
    expect(bookmarkSection).not.toBeInTheDocument();
  });

  it('should not render the edit and delete button for quick link if readonly is true', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockReturnValue({
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditTags: true,
      }),
    }));
    render(
      <KnowledgeCard
        {...mockProps}
        readonly
        knowledgeItem={QUICK_LINK_MOCK_DATA}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const editButton = screen.queryByTestId('edit-quick-link-btn');
    const deleteButton = screen.queryByTestId('delete-quick-link-btn');

    expect(editButton).not.toBeInTheDocument();
    expect(deleteButton).not.toBeInTheDocument();
  });
});
