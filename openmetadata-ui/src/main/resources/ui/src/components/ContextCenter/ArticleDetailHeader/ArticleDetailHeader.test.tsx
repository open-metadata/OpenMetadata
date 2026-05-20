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
import { OperationPermission } from 'context/PermissionProvider/PermissionProvider.interface';
import { ContentChangeState } from 'interface/knowledge-center.interface';
import { QueryVoteType } from '../../../components/Database/TableQueries/TableQueries.interface';
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
  updateKnowledgeCenterRecentViewed: jest.fn(),
}));

jest.mock('../../../utils/DeleteWidget/DeleteWidgetClassBase', () => ({
  __esModule: true,
  default: { getDeleteMessage: jest.fn(() => 'Delete this article?') },
}));

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn(
    (entity?: { displayName?: string; name?: string }) =>
      entity?.displayName || entity?.name || ''
  ),
}));

jest.mock('../../../utils/EntityLink', () => ({
  __esModule: true,
  default: { getEntityLink: jest.fn(() => 'entity-link') },
}));

jest.mock('../../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn(() => <nav data-testid="title-breadcrumb" />)
);

jest.mock('../../common/TabsLabel/TabsLabel.component', () =>
  jest.fn(({ name }: { name: string }) => <span>{name}</span>)
);

jest.mock('../../common/PopOverCard/UserPopOverCard', () =>
  jest.fn(({ userName }: { userName: string }) => <span>{userName}</span>)
);

jest.mock('../../common/EntityPageInfos/ManageButton/ManageButton', () =>
  jest.fn(() => <button data-testid="manage-button">Manage</button>)
);

jest.mock(
  'components/Entity/EntityStatusBadge/EntityStatusBadge.component',
  () => ({
    EntityStatusBadge: jest.fn(() => (
      <span data-testid="entity-status-badge" />
    )),
  })
);

jest.mock('components/common/Loader/Loader', () =>
  jest.fn(() => <div data-testid="loader" />)
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

const mockPermissions: OperationPermission = {
  All: true,
  Create: true,
  Delete: true,
  EditAll: true,
  EditCustomFields: true,
  EditDataProfile: true,
  EditDescription: true,
  EditDisplayName: true,
  EditLineage: true,
  EditOwners: true,
  EditQueries: true,
  EditSampleData: true,
  EditStatus: true,
  EditTags: true,
  EditTests: true,
  EditTier: true,
  ViewAll: true,
  ViewBasic: true,
  ViewDataProfile: true,
  ViewQueries: true,
  ViewSampleData: true,
  ViewTests: true,
  ViewUsage: true,
};

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
  onToggleDelete: jest.fn(),
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

    expect(screen.getByTestId('title-breadcrumb')).toBeInTheDocument();
  });

  it('renders the article display name', () => {
    render(<ArticleDetailHeader {...defaultProps} />);

    expect(screen.getByText('Test Article')).toBeInTheDocument();
  });

  it('renders "untitled" when displayName is missing', () => {
    const props = {
      ...defaultProps,
      knowledgePage: {
        ...mockKnowledgePage,
        displayName: '',
        name: '',
      } as never,
    };
    render(<ArticleDetailHeader {...props} />);

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

  it('renders the manage button', () => {
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

  it('shows the "saved" icon when contentChangeState is SAVED', () => {
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

  it('shows the "unsaved" icon when contentChangeState is UN_SAVED', () => {
    render(
      <ArticleDetailHeader
        {...defaultProps}
        contentChangeState={ContentChangeState.UN_SAVED}
      />
    );

    expect(screen.getByText(/unsaved/i)).toBeInTheDocument();
  });

  it('shows the save button when contentChangeState is UN_SAVED and edit permissions exist', () => {
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

    const utilityButtons = screen.getAllByTestId('button-utility');
    fireEvent.click(utilityButtons[0]);

    await waitFor(() => expect(mockCopyToClipBoard).toHaveBeenCalled());
  });

  it('calls onToggleRightPanel when the sidebar toggle is clicked on non-feed tabs', () => {
    render(<ArticleDetailHeader {...defaultProps} activeTab="documentation" />);

    const utilityButtons = screen.getAllByTestId('button-utility');
    fireEvent.click(utilityButtons[utilityButtons.length - 1]);

    expect(defaultProps.onToggleRightPanel).toHaveBeenCalled();
  });

  it('does not render the right panel toggle on the activity_feed tab', () => {
    render(<ArticleDetailHeader {...defaultProps} activeTab="activity_feed" />);

    const utilityButtons = screen.getAllByTestId('button-utility');

    expect(utilityButtons).toHaveLength(1);
  });
});
