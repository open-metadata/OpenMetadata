/*
 *  Copyright 2024 Collate.
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
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import LimitWrapper from '../../../../hoc/LimitWrapper';
import { getBots } from '../../../../rest/botsAPI';
import { searchQuery } from '../../../../rest/searchAPI';
import BotListV1 from './BotListV1.component';

const mockHandleAddBotClick = jest.fn();
const mockHandleShowDeleted = jest.fn();

const mockProps = {
  showDeleted: false,
  handleAddBotClick: mockHandleAddBotClick,
  handleShowDeleted: mockHandleShowDeleted,
};

const MOCK_BOTS = [
  {
    id: 'bot-1-id',
    name: 'AutoClassification-bot',
    fullyQualifiedName: 'AutoClassification-bot',
    displayName: 'AutoClassificationBot',
    description: 'Auto classify',
    deleted: false,
  },
  {
    id: 'bot-2-id',
    name: 'testbot',
    fullyQualifiedName: 'testbot',
    displayName: 'testbots',
    description: 'Test bot',
    deleted: false,
  },
];

const MOCK_SEARCH_USER_HIT = {
  _source: {
    id: 'user-2-id',
    name: 'testbot',
    fullyQualifiedName: 'testbot',
    displayName: 'testbots',
    email: 'testbot@test.com',
    isBot: true,
    entityType: 'user',
  },
};

jest.mock('../../../../hoc/LimitWrapper', () => {
  return jest.fn().mockImplementation(() => <>LimitWrapper</>);
});

jest.mock('../../../../utils/StringUtils', () => ({
  ...jest.requireActual('../../../../utils/StringUtils'),
}));

jest.mock('../../../../utils/RichTextStringUtils', () => ({
  stringToHTML: jest.fn((text) => text),
}));

jest.mock('../../../../utils/EntitySearchUtils', () => ({
  ...jest.requireActual('../../../../utils/EntitySearchUtils'),
  highlightSearchText: jest.fn((text) => text),
}));

jest.mock('../../../../rest/botsAPI', () => ({
  getBots: jest.fn(),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockUseAuth = jest.fn();

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockGetBots = getBots as jest.MockedFunction<typeof getBots>;
const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

beforeEach(() => {
  jest.clearAllMocks();

  mockUseAuth.mockReturnValue({ isAdminUser: false, isFirstTimeUser: false });

  mockGetBots.mockResolvedValue({
    data: MOCK_BOTS,
    paging: { total: MOCK_BOTS.length },
  } as unknown as Awaited<ReturnType<typeof getBots>>);

  mockSearchQuery.mockResolvedValue({
    hits: {
      total: { value: 0 },
      hits: [],
    },
  } as unknown as Awaited<ReturnType<typeof searchQuery>>);
});

describe('BotListV1', () => {
  it('renders the component', () => {
    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });

    expect(screen.getByText('label.show-deleted')).toBeInTheDocument();
  });

  it('handles show deleted', async () => {
    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });
    const showDeletedSwitch = await screen.findByTestId('switch-deleted');
    fireEvent.click(showDeletedSwitch);

    expect(mockHandleShowDeleted).toHaveBeenCalledWith(true);
  });

  it('should render LimitWrapper', async () => {
    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });
    const addBotButton = screen.getByText('LimitWrapper');
    fireEvent.click(addBotButton);

    expect(LimitWrapper).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'bot' }),
      {}
    );
  });

  it('leaves email out of the bot search for non-admins', async () => {
    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(mockGetBots).toHaveBeenCalled();
    });

    const searchInput = await screen.findByTestId('searchbar');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'testbot' } });
    });

    await waitFor(() => {
      const botSearch = mockSearchQuery.mock.calls
        .map((call) =>
          JSON.stringify((call[0] as { queryFilter?: unknown }).queryFilter)
        )
        .find((filter) => filter.includes('*testbot*'));

      expect(botSearch).toContain('fullyQualifiedName.keyword');
      expect(botSearch).not.toContain('email.keyword');
    });
  });

  it('searches bot user index with wildcard across name, displayName, fqn, email', async () => {
    mockUseAuth.mockReturnValue({ isAdminUser: true, isFirstTimeUser: false });
    mockSearchQuery.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [MOCK_SEARCH_USER_HIT],
      },
    } as unknown as Awaited<ReturnType<typeof searchQuery>>);

    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(mockGetBots).toHaveBeenCalled();
    });

    const searchInput = await screen.findByTestId('searchbar');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'testbot' } });
    });

    await waitFor(() => {
      const searchCall = mockSearchQuery.mock.calls.find((call) => {
        const arg = call[0] as { query?: string; queryFilter?: unknown };
        const filterStr = JSON.stringify(arg.queryFilter);

        const matchesEmptyQueryAndEmail =
          arg.query === '' &&
          filterStr.includes('*testbot*') &&
          filterStr.includes('email.keyword');

        return (
          matchesEmptyQueryAndEmail &&
          filterStr.includes('name.keyword') &&
          filterStr.includes('displayName.keyword') &&
          filterStr.includes('fullyQualifiedName.keyword')
        );
      });

      expect(searchCall).toBeDefined();
    });
  });

  it('resolves matched bot user to bot entity via lowercased name match', async () => {
    mockSearchQuery.mockResolvedValueOnce({
      hits: {
        total: { value: 1 },
        hits: [MOCK_SEARCH_USER_HIT],
      },
    } as unknown as Awaited<ReturnType<typeof searchQuery>>);

    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });

    await waitFor(() => {
      expect(mockGetBots).toHaveBeenCalled();
    });

    const searchInput = await screen.findByTestId('searchbar');
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'testbot' } });
    });

    expect(await screen.findByTestId('bot-link-testbots')).toBeInTheDocument();
  });

  it('fetches the next page exactly once when Next is clicked', async () => {
    mockGetBots.mockResolvedValueOnce({
      data: MOCK_BOTS,
      paging: { total: 20, after: 'cursor-2' },
    } as unknown as Awaited<ReturnType<typeof getBots>>);

    render(<BotListV1 {...mockProps} />, { wrapper: MemoryRouter });

    const nextButton = await screen.findByTestId('next');
    await waitFor(() => expect(nextButton).toBeEnabled());

    await act(async () => {
      fireEvent.click(nextButton);
    });

    await waitFor(() =>
      expect(screen.getByTestId('page-indicator')).toHaveTextContent(
        /label\.page 2 /
      )
    );

    const nextPageCalls = mockGetBots.mock.calls.filter(
      ([params]) => params?.after === 'cursor-2'
    );

    expect(nextPageCalls).toHaveLength(1);
    expect(nextPageCalls[0][0]).toEqual(
      expect.objectContaining({ include: 'non-deleted' })
    );
  });

  it('keeps the newest deleted bots when the stale-cursor request resolves last', async () => {
    let resolveStaleRequest: (value: unknown) => void = jest.fn();
    mockGetBots.mockImplementation((params) => {
      if (params?.include === 'deleted' && params?.before) {
        return new Promise((resolve) => {
          resolveStaleRequest = resolve as (value: unknown) => void;
        }) as ReturnType<typeof getBots>;
      }

      return Promise.resolve({
        data:
          params?.include === 'deleted'
            ? [{ ...MOCK_BOTS[0], displayName: 'DeletedBot', deleted: true }]
            : MOCK_BOTS,
        paging: { total: 1 },
      }) as unknown as ReturnType<typeof getBots>;
    });

    const BotListWithDeletedToggle = () => {
      const [showDeleted, setShowDeleted] = useState(false);

      return (
        <BotListV1
          {...mockProps}
          handleShowDeleted={setShowDeleted}
          showDeleted={showDeleted}
        />
      );
    };

    render(
      <MemoryRouter
        initialEntries={[
          '/?currentPage=1&cursorType=before&cursorValue=prev-cursor',
        ]}>
        <BotListWithDeletedToggle />
      </MemoryRouter>
    );

    await screen.findByTestId('bot-link-AutoClassificationBot');

    await act(async () => {
      fireEvent.click(screen.getByTestId('switch-deleted'));
    });

    expect(
      await screen.findByTestId('bot-link-DeletedBot')
    ).toBeInTheDocument();

    await act(async () => {
      resolveStaleRequest({
        data: [{ ...MOCK_BOTS[1], displayName: 'StaleBot', deleted: true }],
        paging: { total: 1 },
      });
    });

    expect(screen.getByTestId('bot-link-DeletedBot')).toBeInTheDocument();
    expect(screen.queryByTestId('bot-link-StaleBot')).not.toBeInTheDocument();
  });
});
