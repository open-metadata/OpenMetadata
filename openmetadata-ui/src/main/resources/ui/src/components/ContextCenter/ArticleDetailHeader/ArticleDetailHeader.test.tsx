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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryVoteType } from '../../../components/Database/TableQueries/TableQueries.interface';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ContentChangeState } from '../../../interface/knowledge-center.interface';
import ArticleDetailHeader from './ArticleDetailHeader.component';

const mockNavigate = jest.fn();
const mockCopyToClipBoard = jest.fn().mockResolvedValue(undefined);

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(() => mockNavigate),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(() => ({ fqn: 'test-article' })),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: { id: 'user-1', name: 'Test User' },
  })),
}));

jest.mock('../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn(() => ({
    preferences: { recentlyViewedQuickLinks: [] },
  })),
}));

jest.mock('../../../hooks/useClipBoard', () => ({
  useClipboard: jest.fn(() => ({ onCopyToClipBoard: mockCopyToClipBoard })),
}));

jest.mock('../../../utils/KnowledgePageUtils', () => ({
  getKnowledgePageName: jest.fn(
    (entity?: { displayName?: string; name?: string }) =>
      entity?.displayName || entity?.name || 'label.untitled'
  ),
  updateKnowledgeCenterRecentViewed: jest.fn(),
}));

jest.mock('../../../utils/ContextCenterClassBase', () => ({
  __esModule: true,
  default: {
    isBreadcrumbInsideCard: jest.fn(() => false),
    getCardStyle: jest.fn(() => ({})),
    getBreadcrumbClassName: jest.fn(() => ''),
    getContextCenterPath: jest.fn(() => '/context-center'),
    getArticlesListPath: jest.fn(() => '/context-center/articles'),
    getArticleVersionPath: jest.fn(
      (fqn: string, version: string) =>
        `/context-center/articles/${fqn}/versions/${version}`
    ),
    getArticlesListPathForDelete: jest.fn(() => '/context-center/articles'),
  },
}));

jest.mock('../../../rest/knowledgeCenterAPI', () => ({
  deleteKnowledgePage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/EntityLink', () => ({
  __esModule: true,
  default: { getEntityLink: jest.fn(() => 'entity-link') },
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../common/Breadcrumb/Breadcrumb.component', () =>
  jest.fn(() => <nav data-testid="breadcrumb" />)
);

jest.mock('../../common/TabsLabel/TabsLabel.component', () =>
  jest.fn(({ name }: { name: string }) => <span>{name}</span>)
);

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn(({ owners }: { owners: Array<{ name?: string }> }) => (
    <span>{owners.map((o) => o.name).join(', ')}</span>
  )),
}));

jest.mock('../../../components/common/DeleteModal/DeleteModal', () =>
  jest.fn(() => <div data-testid="delete-modal" />)
);

jest.mock('../../../components/common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader" />)
);

jest.mock(
  '../../../components/Entity/EntityStatusBadge/EntityStatusBadge.component',
  () => ({
    EntityStatusBadge: jest.fn(() => (
      <span data-testid="entity-status-badge" />
    )),
  })
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Badge: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
    }) => <button onClick={onClick}>{children}</button>
  ),
  ButtonUtility: jest.fn(
    ({
      onClick,
      disabled,
      icon,
      'data-testid': testId = 'button-utility',
    }: {
      onClick?: () => void;
      disabled?: boolean;
      icon?: React.ReactNode;
      'data-testid'?: string;
    }) => (
      <button data-testid={testId} disabled={disabled} onClick={onClick}>
        {typeof icon === 'function' ? null : icon}
      </button>
    )
  ),
  Card: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Dot: jest.fn(() => <span>·</span>),
  Dropdown: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    {
      Root: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
      Popover: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
      Menu: jest.fn(
        ({
          children,
          onAction,
        }: {
          children: React.ReactNode;
          onAction?: (key: string) => void;
        }) => <div data-onaction={String(onAction)}>{children}</div>
      ),
      Item: jest.fn(
        ({
          children,
          id,
          'data-testid': testId,
        }: {
          children: React.ReactNode;
          id?: string;
          'data-testid'?: string;
        }) => (
          <div data-id={id} data-testid={testId}>
            {children}
          </div>
        )
      ),
    }
  ),
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Tabs: Object.assign(
    jest.fn(
      ({
        children,
        onSelectionChange,
      }: {
        children: React.ReactNode;
        onSelectionChange?: (key: string) => void;
      }) => <div data-onchange={String(onSelectionChange)}>{children}</div>
    ),
    {
      List: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
      Item: jest.fn(
        ({ children, id }: { children: React.ReactNode; id: string }) => (
          <div data-testid={`tab-item-${id}`}>{children}</div>
        )
      ),
    }
  ),
  Tooltip: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  TooltipTrigger: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const mockPermissions = {
  All: true,
  Delete: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
} as OperationPermission;

const mockKnowledgePage = {
  id: 'page-1',
  name: 'test-article',
  displayName: 'Test Article',
  fullyQualifiedName: 'test-article',
  updatedBy: 'alice',
  votes: {
    upVoters: [],
    downVoters: [],
    upVotes: 0,
    downVotes: 0,
  },
  followers: [],
  owners: [{ id: 'owner-1', name: 'alice', type: 'user' }],
  domains: [
    { id: 'domain-1', name: 'Engineering', displayName: 'Engineering' },
  ],
  editors: [],
  deleted: false,
};

const mockTabs = [
  { key: 'documentation', name: 'Documentation', label: 'Documentation' },
  { key: 'activity_feed', name: 'Activity Feed', label: 'Activity Feed' },
];

const defaultProps = {
  knowledgePage: mockKnowledgePage as never,
  contentChangeState: ContentChangeState.SAVED,
  permissions: mockPermissions,
  tabs: mockTabs,
  activeTab: 'documentation',
  isRightPanelOpen: true,
  feedCount: 3,
  onTabChange: jest.fn(),
  onToggleRightPanel: jest.fn(),
  onVoteChange: jest.fn().mockResolvedValue(undefined),
  onFollowChange: jest.fn().mockResolvedValue(undefined),
  onSetThreadLink: jest.fn(),
};

describe('ArticleDetailHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with data-testid', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    expect(screen.getByTestId('article-detail-header')).toBeInTheDocument();
  });

  it('renders the breadcrumb', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders the article display name', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    expect(screen.getByText('Test Article')).toBeInTheDocument();
  });

  it('renders "untitled" when displayName is missing', () => {
    render(
      <ArticleDetailHeader
        {...defaultProps}
        knowledgePage={
          { ...mockKnowledgePage, displayName: '', name: '' } as never
        }
      />
    );

    expect(screen.getAllByText(/untitled/i).length).toBeGreaterThan(0);
  });

  it('renders tab items', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    expect(screen.getByTestId('tab-item-documentation')).toBeInTheDocument();
    expect(screen.getByTestId('tab-item-activity_feed')).toBeInTheDocument();
  });

  it('renders the owner name', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    expect(screen.getAllByText('alice').length).toBeGreaterThan(0);
  });

  it('renders the domain name', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('renders the manage button when Delete permission is set', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    expect(screen.getByTestId('manage-button')).toBeInTheDocument();
  });

  it('shows the skeleton when knowledgePage and tabs are both undefined', () => {
    render(
      <ArticleDetailHeader
        {...defaultProps}
        knowledgePage={undefined}
        tabs={undefined}
      />
    );

    expect(
      screen.getByTestId('article-detail-header-skeleton')
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('shows the "saved" badge when contentChangeState is SAVED', () => {
    render(
      <ArticleDetailHeader
        {...defaultProps}
        contentChangeState={ContentChangeState.SAVED}
      />
    );

    expect(screen.getByText(/saved/i)).toBeInTheDocument();
  });

  it('shows the loader when contentChangeState is SAVING', () => {
    render(
      <ArticleDetailHeader
        {...defaultProps}
        contentChangeState={ContentChangeState.SAVING}
      />
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('shows the "unsaved" badge when contentChangeState is UN_SAVED', () => {
    render(
      <ArticleDetailHeader
        {...defaultProps}
        contentChangeState={ContentChangeState.UN_SAVED}
      />
    );

    expect(screen.getByText(/unsaved/i)).toBeInTheDocument();
  });

  it('shows the save button when contentChangeState is UN_SAVED and onSave is provided', () => {
    render(
      <ArticleDetailHeader
        {...defaultProps}
        contentChangeState={ContentChangeState.UN_SAVED}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText(/label\.save/i)).toBeInTheDocument();
  });

  it('calls onSave when the save button is clicked', () => {
    const onSave = jest.fn();
    render(
      <ArticleDetailHeader
        {...defaultProps}
        contentChangeState={ContentChangeState.UN_SAVED}
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByText(/label\.save/i));

    expect(onSave).toHaveBeenCalled();
  });

  it('calls onVoteChange when the up-vote button is clicked', async () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    fireEvent.click(screen.getByTestId('upvote-btn'));

    await waitFor(() =>
      expect(defaultProps.onVoteChange).toHaveBeenCalledWith({
        updatedVoteType: QueryVoteType.votedUp,
      })
    );
  });

  it('calls onVoteChange with unVoted when clicking an already up-voted button', async () => {
    const alreadyUpVotedPage = {
      ...mockKnowledgePage,
      votes: {
        upVoters: [{ id: 'user-1', name: 'Test User', type: 'user' }],
        downVoters: [],
        upVotes: 1,
        downVotes: 0,
      },
    };
    render(
      <ArticleDetailHeader
        {...defaultProps}
        knowledgePage={alreadyUpVotedPage as never}
      />
    );

    fireEvent.click(screen.getByTestId('upvote-btn'));

    await waitFor(() =>
      expect(defaultProps.onVoteChange).toHaveBeenCalledWith({
        updatedVoteType: QueryVoteType.unVoted,
      })
    );
  });

  it('calls onFollowChange when the follow button is clicked', async () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    fireEvent.click(screen.getByTestId('follow-btn'));

    await waitFor(() => expect(defaultProps.onFollowChange).toHaveBeenCalled());
  });

  it('calls onSetThreadLink when the conversation button is clicked', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    fireEvent.click(screen.getByTestId('conversation'));

    expect(defaultProps.onSetThreadLink).toHaveBeenCalled();
  });

  it('calls onCopyToClipBoard when the share button is clicked', async () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    fireEvent.click(screen.getByTestId('share-btn'));

    await waitFor(() => expect(mockCopyToClipBoard).toHaveBeenCalled());
  });

  it('calls onToggleRightPanel when the sidebar toggle is clicked on non-feed tabs', () => {
    render(<ArticleDetailHeader {...defaultProps} activeTab="documentation" />);

    fireEvent.click(screen.getByTestId('right-panel-toggle-btn'));

    expect(defaultProps.onToggleRightPanel).toHaveBeenCalled();
  });

  it('does not render the right panel toggle on the activity_feed tab', () => {
    render(<ArticleDetailHeader {...defaultProps} activeTab="activity_feed" />);

    expect(
      screen.queryByTestId('right-panel-toggle-btn')
    ).not.toBeInTheDocument();
  });
});
