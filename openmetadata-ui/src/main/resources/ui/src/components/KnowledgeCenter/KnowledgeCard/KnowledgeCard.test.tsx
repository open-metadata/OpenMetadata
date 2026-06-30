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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import '../../../test/unit/mocks/mui.mock';
import KnowledgeCard, { KnowledgeCardProps } from './KnowledgeCard';
import {
  KNOWLEDGE_PAGE_MOCK_DATA,
  KNOWLEDGE_PAGE_PARTIAL_MOCK_DATA,
  KNOWLEDGE_PAGE_TAGS,
  QUICK_LINK_MOCK_DATA,
} from './KnowledgeCard.mock';

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

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: jest
    .fn()
    .mockImplementation(({ children }) => (
      <span data-testid="badge">{children}</span>
    )),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  ButtonUtility: jest
    .fn()
    .mockImplementation(({ children, onClick, 'data-testid': testId }) => (
      <button data-testid={testId} onClick={onClick}>
        {children}
      </button>
    )),
  Card: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Dot: jest.fn().mockReturnValue(<span data-testid="dot" />),
  Typography: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <span {...props}>{children}</span>
    )),
}));

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () =>
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

jest.mock('../../../components/common/DeleteModal/DeleteModal', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="delete-widget-modal">DeleteModal</div>)
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
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
}));

jest.mock('../../../utils/StringUtils', () => ({
  stripMarkdown: jest.fn().mockImplementation((text: string) => text),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  getFrontEndFormat: jest.fn().mockImplementation((text: string) => text),
}));

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  ...jest.requireActual('../../../utils/date-time/DateTimeUtils'),
  getEpochMillisForPastDays: jest
    .fn()
    .mockImplementation(
      (days: number) => Date.now() - days * 24 * 60 * 60 * 1000
    ),
  getCurrentMillis: jest.fn().mockReturnValue(Date.now()),
  getShortRelativeTime: jest.fn().mockReturnValue('2 days ago'),
}));

jest.mock('../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn().mockReturnValue({
    preferences: { recentlyViewedQuickLinks: [] },
  }),
}));

jest.mock('../../../utils/KnowledgePageUtils', () => ({
  addToKnowledgeCenterRecentViewed: jest.fn(),
  updateKnowledgeCenterRecentViewed: jest.fn(),
  getKnowledgePageName: jest
    .fn()
    .mockImplementation(
      (page: { displayName?: string; name?: string }) =>
        page.displayName ?? page.name ?? ''
    ),
}));

jest.mock('../../../utils/ContextCenterClassBase', () => ({
  __esModule: true,
  default: {
    getArticlePath: jest
      .fn()
      .mockImplementation((fqn: string) => `/knowledge/${fqn}`),
  },
}));

jest.mock('../../../rest/knowledgeCenterAPI', () => ({
  deleteKnowledgePage: jest.fn().mockResolvedValue({}),
}));

describe('Knowledge Card', () => {
  it('should render the knowledge card with title and description', async () => {
    render(<KnowledgeCard {...mockProps} />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('knowledge-card-title')).toHaveTextContent(
      'OpenMetadata 1.1.0 Release UI'
    );

    expect(
      screen.getByTestId('knowledge-card-description')
    ).toBeInTheDocument();
  });

  it('should render owner name via UserPopOverCard', () => {
    render(<KnowledgeCard {...mockProps} />, { wrapper: MemoryRouter });

    // component passes getEntityName(owners[0]) which returns displayName ?? name
    expect(screen.getByTestId('owner-name')).toHaveTextContent(
      KNOWLEDGE_PAGE_MOCK_DATA.owners![0].name!
    );
  });

  it('should render domain name when domain is present', () => {
    const withDomain: KnowledgePage = {
      ...KNOWLEDGE_PAGE_MOCK_DATA,
      domains: [
        {
          id: 'd1',
          type: 'domain',
          name: 'Marketing',
          fullyQualifiedName: 'Marketing',
        },
      ],
    };
    render(<KnowledgeCard {...mockProps} knowledgeItem={withDomain} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('domain-name')).toHaveTextContent('Marketing');
  });

  it('should render "No domain" placeholder when domain is absent', () => {
    render(<KnowledgeCard {...mockProps} />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('domain-name')).toHaveTextContent(
      'label.no-entity'
    );
  });

  it('should render no-description placeholder when description is empty', () => {
    render(
      <KnowledgeCard
        {...mockProps}
        knowledgeItem={KNOWLEDGE_PAGE_PARTIAL_MOCK_DATA}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByTestId('no-description')).toHaveTextContent(
      'label.no-description'
    );
  });

  it('should render UserPopOverCard when owners are absent', () => {
    render(
      <KnowledgeCard
        {...mockProps}
        knowledgeItem={KNOWLEDGE_PAGE_PARTIAL_MOCK_DATA}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByTestId('owner-name')).toBeInTheDocument();
  });

  it('should render the footer row', () => {
    render(<KnowledgeCard {...mockProps} />, { wrapper: MemoryRouter });

    expect(screen.getByTestId('knowledge-footer')).toBeInTheDocument();
  });

  it('should render at most 2 tags and an overflow badge', () => {
    render(<KnowledgeCard {...mockProps} />, { wrapper: MemoryRouter });

    const visibleTags = KNOWLEDGE_PAGE_TAGS.slice(0, 2);
    visibleTags.forEach((tag) => {
      expect(screen.getByText(tag.displayName ?? tag.name)).toBeInTheDocument();
    });

    const overflowCount = KNOWLEDGE_PAGE_TAGS.length - 2;

    expect(screen.getByText(`+${overflowCount}`)).toBeInTheDocument();
  });

  it('should render the edit and delete button for quick link', async () => {
    render(
      <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
      { wrapper: MemoryRouter }
    );

    expect(
      await screen.findByTestId('edit-quick-link-btn')
    ).toBeInTheDocument();
    expect(screen.getByTestId('delete-quick-link-btn')).toBeInTheDocument();
  });

  it('should open the quick link form modal on edit click', async () => {
    render(
      <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
      { wrapper: MemoryRouter }
    );

    fireEvent.click(await screen.findByTestId('edit-quick-link-btn'));

    expect(screen.getByTestId('quick-link-form-modal')).toBeInTheDocument();
  });

  it('should open the delete modal on delete click', async () => {
    render(
      <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
      { wrapper: MemoryRouter }
    );

    fireEvent.click(await screen.findByTestId('delete-quick-link-btn'));

    expect(screen.getByTestId('delete-widget-modal')).toBeInTheDocument();
  });

  it('should render the link with target _blank for quick links', () => {
    render(
      <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByTestId('knowledge-link')).toHaveAttribute(
      'target',
      '_blank'
    );
  });

  it('should not render edit and delete buttons when user has no permission', async () => {
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
      { wrapper: MemoryRouter }
    );

    expect(screen.queryByTestId('edit-quick-link-btn')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('delete-quick-link-btn')
    ).not.toBeInTheDocument();
  });

  it('should render edit button when user has partial edit permission', async () => {
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
    render(
      <KnowledgeCard {...mockProps} knowledgeItem={QUICK_LINK_MOCK_DATA} />,
      { wrapper: MemoryRouter }
    );

    expect(
      await screen.findByTestId('edit-quick-link-btn')
    ).toBeInTheDocument();
  });

  it('should not render edit and delete buttons for quick link when readonly', () => {
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
      { wrapper: MemoryRouter }
    );

    expect(screen.queryByTestId('edit-quick-link-btn')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('delete-quick-link-btn')
    ).not.toBeInTheDocument();
  });
});
