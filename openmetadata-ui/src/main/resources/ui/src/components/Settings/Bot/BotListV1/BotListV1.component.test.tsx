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

const mockGetBots = getBots as jest.MockedFunction<typeof getBots>;
const mockSearchQuery = searchQuery as jest.MockedFunction<typeof searchQuery>;

beforeEach(() => {
  jest.clearAllMocks();

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

  it('searches bot user index with wildcard across name, displayName, fqn, email', async () => {
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

        return (
          arg.query === '' &&
          filterStr.includes('*testbot*') &&
          filterStr.includes('email.keyword') &&
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
});
