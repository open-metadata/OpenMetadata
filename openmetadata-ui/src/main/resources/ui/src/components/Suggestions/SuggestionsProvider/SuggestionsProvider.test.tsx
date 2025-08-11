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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SuggestionType } from '../../../generated/entity/feed/suggestion';
import {
  MOCK_SUGGESTIONS,
  MOCK_SUGGESTIONS_WITH_SAME_USER,
} from '../../../mocks/Suggestions.mock';
import { mockEntityPermissions } from '../../../pages/DatabaseSchemaPage/mocks/DatabaseSchemaPage.mock';
import {
  approveRejectAllSuggestions,
  getSuggestionsByUserId,
  getSuggestionsList,
  updateSuggestionStatus,
} from '../../../rest/suggestionsAPI';
import * as toastUtils from '../../../utils/ToastUtils';
import SuggestionsProvider, {
  useSuggestionsContext,
} from './SuggestionsProvider';
import { SuggestionAction } from './SuggestionsProvider.interface';

const mockPagingResponse = {
  data: MOCK_SUGGESTIONS,
  paging: { total: 25, after: null, before: null },
};

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'mockFQN' }),
}));

jest.mock('../../../hooks/usePubSub', () => ({
  usePub: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../rest/suggestionsAPI', () => ({
  getSuggestionsList: jest.fn(),
  getSuggestionsByUserId: jest.fn(),
  fetchSuggestionsByUserId: jest.fn(),
  approveRejectAllSuggestions: jest.fn().mockResolvedValue({}),
  updateSuggestionStatus: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: mockEntityPermissions,
  })),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

function TestComponent() {
  const {
    acceptRejectAllSuggestions,
    onUpdateActiveUser,
    acceptRejectSuggestion,
    fetchSuggestionsByUserId,
    fetchSuggestions,
    suggestions: contextSuggestions,
    loading,
    allSuggestionsUsers,
    suggestionsByUser,
    suggestionLimit,
    suggestionPendingCount,
  } = useSuggestionsContext();

  return (
    <>
      <button
        onClick={() => acceptRejectAllSuggestions(SuggestionAction.Accept)}>
        Accept All
      </button>
      <button
        onClick={() => acceptRejectAllSuggestions(SuggestionAction.Reject)}>
        Reject All
      </button>
      <button
        onClick={() =>
          onUpdateActiveUser({ id: '1', name: 'Avatar 1', type: 'user' })
        }>
        Active User
      </button>
      <button
        onClick={() =>
          acceptRejectSuggestion(MOCK_SUGGESTIONS[0], SuggestionAction.Accept)
        }>
        Accept One
      </button>
      <button
        onClick={() =>
          acceptRejectSuggestion(MOCK_SUGGESTIONS[1], SuggestionAction.Reject)
        }>
        Reject One
      </button>
      <button onClick={() => fetchSuggestionsByUserId('test-user-id')}>
        Fetch By User ID
      </button>
      <button onClick={() => fetchSuggestions(20)}>Fetch Suggestions</button>
      <button onClick={() => fetchSuggestions(20, true)}>
        Fetch Suggestions Skip Merge
      </button>
      <div data-testid="suggestions-count">{contextSuggestions.length}</div>
      <div data-testid="loading-state">
        {loading ? 'loading' : 'not-loading'}
      </div>
      <div data-testid="users-count">{allSuggestionsUsers.length}</div>
      <div data-testid="suggestion-limit">{suggestionLimit}</div>
      <div data-testid="pending-count">{suggestionPendingCount}</div>
      <div data-testid="grouped-users-count">{suggestionsByUser.size}</div>
    </>
  );
}

describe('SuggestionsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getSuggestionsList as jest.Mock).mockResolvedValue(mockPagingResponse);
    (getSuggestionsByUserId as jest.Mock).mockResolvedValue({
      data: MOCK_SUGGESTIONS.slice(0, 2),
    });
  });

  it('renders provider and fetches data with correct state updates', async () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledWith({
        entityFQN: 'mockFQN',
        limit: 10,
      });
    });

    // Wait for suggestions to be processed and state updated
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('3');
    });

    // Verify remaining state updates - derived from useMemo
    expect(screen.getByTestId('users-count')).toHaveTextContent('2');
    expect(screen.getByTestId('suggestion-limit')).toHaveTextContent('25');
    expect(screen.getByTestId('pending-count')).toHaveTextContent('22'); // 25 - 3
    expect(screen.getByTestId('grouped-users-count')).toHaveTextContent('2');
  });

  it('handles fetchSuggestions with custom limit', async () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    const fetchBtn = screen.getByText('Fetch Suggestions');
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledWith({
        entityFQN: 'mockFQN',
        limit: 20,
      });
    });
  });

  it('handles fetchSuggestions with skipMerge parameter', async () => {
    const newMockResponse = {
      data: [MOCK_SUGGESTIONS[0]],
      paging: { total: 15, after: null, before: null },
    };

    (getSuggestionsList as jest.Mock)
      .mockResolvedValueOnce(mockPagingResponse) // Initial load
      .mockResolvedValueOnce(newMockResponse); // Skip merge call

    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('3');
    });

    const fetchSkipMergeBtn = screen.getByText('Fetch Suggestions Skip Merge');
    fireEvent.click(fetchSkipMergeBtn);

    await waitFor(() => {
      // Should replace all suggestions, not merge
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('1');
      expect(screen.getByTestId('suggestion-limit')).toHaveTextContent('15');
      expect(screen.getByTestId('pending-count')).toHaveTextContent('14'); // 15 - 1
    });
  });

  it('handles fetchSuggestionsByUserId correctly', async () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    const fetchByUserIdBtn = screen.getByText('Fetch By User ID');
    fireEvent.click(fetchByUserIdBtn);

    await waitFor(() => {
      expect(getSuggestionsByUserId).toHaveBeenCalledWith('test-user-id', {
        entityFQN: 'mockFQN',
        limit: 10,
      });
    });

    // Should update pending count correctly for user-specific fetch
    await waitFor(() => {
      expect(screen.getByTestId('pending-count')).toHaveTextContent('8'); // 10 - 2 (still 2 after merge)
    });
  });

  it('merges new suggestions with existing ones without duplicates', async () => {
    const newSuggestions = [
      MOCK_SUGGESTIONS[0], // Duplicate
      {
        id: '4',
        description: 'New suggestion',
        type: SuggestionType.SuggestDescription,
        createdBy: { id: '3', name: 'Avatar 3', type: 'user' },
      },
    ];

    (getSuggestionsList as jest.Mock)
      .mockResolvedValueOnce(mockPagingResponse) // Initial load
      .mockResolvedValueOnce({
        data: newSuggestions,
        paging: { total: 30, after: null, before: null },
      }); // Second fetch

    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('3');
    });

    // Trigger second fetch
    const fetchBtn = screen.getByText('Fetch Suggestions');
    fireEvent.click(fetchBtn);

    await waitFor(() => {
      // Should have original 3 + 1 new unique = 4 total
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('4');
      expect(screen.getByTestId('suggestion-limit')).toHaveTextContent('30');
      expect(screen.getByTestId('pending-count')).toHaveTextContent('26'); // 30 - 4
    });
  });

  it('shows loading state during fetch operations', async () => {
    // Mock delayed response
    (getSuggestionsList as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve(mockPagingResponse), 100)
        )
    );

    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Should show loading initially
    expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');

    await waitFor(
      () => {
        expect(screen.getByTestId('loading-state')).toHaveTextContent(
          'not-loading'
        );
      },
      { timeout: 200 }
    );
  });

  it('handles API errors gracefully', async () => {
    const error = new Error('API Error');
    (getSuggestionsList as jest.Mock).mockRejectedValue(error);

    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    await waitFor(() => {
      expect(toastUtils.showErrorToast).toHaveBeenCalledWith(
        error,
        expect.stringContaining('entity-fetch-error')
      );
    });

    // Should not be loading after error
    expect(screen.getByTestId('loading-state')).toHaveTextContent(
      'not-loading'
    );
  });

  it('handles acceptRejectSuggestion and updates state optimistically', async () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('3');
    });

    const acceptBtn = screen.getByText('Accept One');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(updateSuggestionStatus).toHaveBeenCalledWith(
        MOCK_SUGGESTIONS[0],
        SuggestionAction.Accept
      );
    });

    // Should optimistically update suggestions count without refetch
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('2');
      expect(screen.getByTestId('pending-count')).toHaveTextContent('22'); // 25 - 3
    });

    // Should only call initial fetch, no refetch after successful accept
    expect(getSuggestionsList).toHaveBeenCalledTimes(1);
  });

  it('handles acceptRejectSuggestion error gracefully', async () => {
    const error = new Error('Update failed');
    (updateSuggestionStatus as jest.Mock).mockRejectedValue(error);

    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('3');
    });

    const acceptBtn = screen.getByText('Accept One');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(toastUtils.showErrorToast).toHaveBeenCalledWith(error);
    });

    // Should still show original count on error (no optimistic update applied)
    expect(screen.getByTestId('suggestions-count')).toHaveTextContent('3');
    // Should only call initial fetch, no refetch on error
    expect(getSuggestionsList).toHaveBeenCalledTimes(1);
  });

  it('handles acceptRejectAllSuggestions with active user', async () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('3');
    });

    // Set active user
    const activeUserBtn = screen.getByText('Active User');
    fireEvent.click(activeUserBtn);

    const acceptAllBtn = screen.getByText('Accept All');
    fireEvent.click(acceptAllBtn);

    await waitFor(() => {
      expect(approveRejectAllSuggestions).toHaveBeenCalledWith(
        '1',
        'mockFQN',
        SuggestionType.SuggestDescription,
        SuggestionAction.Accept
      );
      expect(approveRejectAllSuggestions).toHaveBeenCalledWith(
        '1',
        'mockFQN',
        SuggestionType.SuggestTagLabel,
        SuggestionAction.Accept
      );
    });

    // Should optimistically remove user's suggestions
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('1'); // Removed 2 user suggestions
    });
  });

  it('handles acceptRejectAllSuggestions and refetches when suggestions become empty', async () => {
    // Mock response with only user's suggestions
    (getSuggestionsList as jest.Mock)
      .mockResolvedValueOnce({
        data: MOCK_SUGGESTIONS_WITH_SAME_USER,
        paging: { total: 2, after: null, before: null },
      })
      .mockResolvedValueOnce({
        data: [MOCK_SUGGESTIONS[2]], // Fresh suggestions
        paging: { total: 5, after: null, before: null },
      });

    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('2');
    });

    // Set active user and accept all
    const activeUserBtn = screen.getByText('Active User');
    fireEvent.click(activeUserBtn);

    const acceptAllBtn = screen.getByText('Accept All');
    fireEvent.click(acceptAllBtn);

    await waitFor(() => {
      // Should call fetchSuggestions with skipMerge=true when suggestions become empty
      expect(getSuggestionsList).toHaveBeenCalledTimes(2);
      expect(getSuggestionsList).toHaveBeenLastCalledWith({
        entityFQN: 'mockFQN',
        limit: 2,
      });
    });

    // Should show fresh suggestions
    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('1');
    });
  });

  it('handles rejectRejectAllSuggestions correctly', async () => {
    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Set active user
    const activeUserBtn = screen.getByText('Active User');
    fireEvent.click(activeUserBtn);

    const rejectAllBtn = screen.getByText('Reject All');
    fireEvent.click(rejectAllBtn);

    await waitFor(() => {
      expect(approveRejectAllSuggestions).toHaveBeenCalledWith(
        '1',
        'mockFQN',
        SuggestionType.SuggestDescription,
        SuggestionAction.Reject
      );
      expect(approveRejectAllSuggestions).toHaveBeenCalledWith(
        '1',
        'mockFQN',
        SuggestionType.SuggestTagLabel,
        SuggestionAction.Reject
      );
    });
  });

  it('handles edge case of empty suggestions response', async () => {
    (getSuggestionsList as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0, after: null, before: null },
    });

    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('suggestions-count')).toHaveTextContent('0');
      expect(screen.getByTestId('users-count')).toHaveTextContent('0');
      expect(screen.getByTestId('suggestion-limit')).toHaveTextContent('0');
      expect(screen.getByTestId('pending-count')).toHaveTextContent('0'); // 0 - 0
    });
  });

  it('updates pending count correctly for fetchSuggestionsByUserId with duplicates', async () => {
    (getSuggestionsByUserId as jest.Mock).mockResolvedValue({
      data: [MOCK_SUGGESTIONS[0]], // Only 1 suggestion (duplicate)
    });

    render(
      <SuggestionsProvider>
        <TestComponent />
      </SuggestionsProvider>
    );

    // Wait for initial load (3 suggestions, limit 25, pending = 22)
    await waitFor(() => {
      expect(screen.getByTestId('pending-count')).toHaveTextContent('22');
    });

    const fetchByUserIdBtn = screen.getByText('Fetch By User ID');
    fireEvent.click(fetchByUserIdBtn);

    await waitFor(() => {
      // After user fetch: still 3 suggestions (duplicate filtered), pending updated based on limit - merged.length
      expect(screen.getByTestId('pending-count')).toHaveTextContent('22'); // 25 - 3
    });
  });
});
