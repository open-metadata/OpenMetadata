import {
  fireEvent,
  getAllByTestId,
  render,
  screen,
} from '@testing-library/react';
import {
  ContentChangeState,
  KnowledgePage,
} from 'interface/knowledge-center.interface';
import { OperationPermission } from 'context/PermissionProvider/PermissionProvider.interface';
import { User } from 'generated/entity/teams/user';
import { MOCK_KNOWLEDGE_PAGE_DATA } from 'pages/KnowledgePage/KnowledgePage.mock';
import { MemoryRouter } from 'react-router-dom';
import KnowledgeDetailPageHeader, {
  KnowledgeDetailPageHeaderProps,
} from './KnowledgeDetailPageHeader';

const mockOnCopyToClipBoard = jest.fn();
const mockPush = jest.fn();

const mockUserData: User = {
  name: 'aaron_johnson0',
  email: 'testUser1@email.com',
  id: '9304f330-2e9a-4513-883b-c939e29683a8',
  isAdmin: true,
};

jest.mock('utils/AdvancedSearchClassBase', () => ({
  advancedSearchClassBase: {
    autocomplete: jest.fn().mockReturnValue({
      asyncFetch: jest.fn(),
    }),
  },
}));

jest.mock('utils/JSONLogicSearchClassBase', () => ({
  JSONLogicSearchClassBase: jest.fn().mockImplementation(() => ({
    getTree: jest.fn(),
    getFilters: jest.fn(),
  })),
}));

jest.mock(
  'components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    useAdvanceSearch: jest.fn().mockReturnValue({}),
  })
);

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('hooks/useClipBoard', () => ({
  ...jest.requireActual('hooks/useClipBoard'),
  useClipboard: jest
    .fn()
    .mockImplementation(() => ({ onCopyToClipBoard: mockOnCopyToClipBoard })),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

jest.mock('hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: '',
  }),
}));

jest.mock(
  'components/common/PopOverCard/UserPopOverCard',
  () =>
    jest
      .fn()
      .mockImplementation(() => (
        <div data-testid="user-popover-card">UserPopOverCard</div>
      ))
);

jest.mock(
  'components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest.fn().mockImplementation(() => <div>TitleBreadcrumb</div>);
  }
);

const mockOnSetThreadLink = jest.fn();
const mockOnVoteChange = jest.fn();
const mockOnFollowChange = jest.fn();
const mockOnToggleDelete = jest.fn();

const mockProps: KnowledgeDetailPageHeaderProps = {
  isLoading: false,
  knowledgePage: MOCK_KNOWLEDGE_PAGE_DATA as unknown as KnowledgePage,
  contentChangeState: ContentChangeState.SAVED,
  permissions: {
    Delete: true,
  } as OperationPermission,
  onSetThreadLink: mockOnSetThreadLink,
  onVoteChange: mockOnVoteChange,
  onFollowChange: mockOnFollowChange,
  onToggleDelete: mockOnToggleDelete,
  fetchKnowledgePageHierarchy: jest.fn(),
};

describe('KnowledgeDetailPageHeader', () => {
  it('should render KnowledgeDetailPageHeader', () => {
    render(<KnowledgeDetailPageHeader {...mockProps} />, {
      wrapper: MemoryRouter,
    });
    const updatedByContainer = screen.getByTestId('updated-by-list');

    const updatedByList = getAllByTestId(
      updatedByContainer,
      'user-popover-card'
    );

    expect(updatedByList).toHaveLength(1);

    const conversation = screen.getByTestId('conversation');

    expect(conversation).toBeInTheDocument();

    const upVoteButton = screen.getByTestId('up-vote-btn');

    expect(upVoteButton).toBeInTheDocument();

    const downVoteButton = screen.getByTestId('down-vote-btn');

    expect(downVoteButton).toBeInTheDocument();

    const versionButton = screen.getByTestId('version-button');

    expect(versionButton).toHaveTextContent('1.2');

    const followButton = screen.getByTestId('entity-follow-button');

    expect(followButton).toHaveTextContent('1');

    const shareButton = screen.getByTestId('share-button');

    expect(shareButton).toBeInTheDocument();

    const manageButton = screen.getByTestId('manage-button');

    expect(manageButton).toBeInTheDocument();

    expect(screen.getByText('TitleBreadcrumb')).toBeInTheDocument();
  });

  it('onSetThreadLink should work', async () => {
    render(<KnowledgeDetailPageHeader {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const conversationBtn = screen.getByTestId('conversation');

    fireEvent.click(conversationBtn);

    expect(mockOnSetThreadLink).toHaveBeenCalled();
  });

  it('onVoteChange should work', async () => {
    render(<KnowledgeDetailPageHeader {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const upVoteButton = screen.getByTestId('up-vote-btn');

    fireEvent.click(upVoteButton);

    const downVoteButton = screen.getByTestId('down-vote-btn');

    fireEvent.click(downVoteButton);

    expect(mockOnVoteChange).toHaveBeenCalledTimes(2);
  });

  it('onFollowChange should work', async () => {
    render(<KnowledgeDetailPageHeader {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const followButton = screen.getByTestId('entity-follow-button');

    fireEvent.click(followButton);

    expect(mockOnFollowChange).toHaveBeenCalled();
  });

  it('Version change should work', async () => {
    render(<KnowledgeDetailPageHeader {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const versionButton = screen.getByTestId('version-button');

    fireEvent.click(versionButton);

    expect(mockPush).toHaveBeenCalled();
  });
});
