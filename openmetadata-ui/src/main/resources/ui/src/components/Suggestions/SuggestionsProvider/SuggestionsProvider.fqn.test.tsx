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
import { fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { MOCK_SUGGESTIONS } from '../../../mocks/Suggestions.mock';
import { getSuggestionsList } from '../../../rest/suggestionsAPI';
import SuggestionsProvider, {
  useSuggestionsContext,
} from './SuggestionsProvider';

jest.mock('../../../hooks/usePubSub', () => ({
  usePub: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../rest/suggestionsAPI', () => ({
  getSuggestionsList: jest.fn(),
  getSuggestionsByUserId: jest.fn(),
  approveRejectAllSuggestions: jest.fn().mockResolvedValue({}),
  updateSuggestionStatus: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => {
  // Stable reference: the provider's fetch effect depends on `permissions`,
  // so returning a new object each render would refire the effect in a loop.
  // Non-empty so the `!isEmpty(permissions)` gate lets the fetch effect fire.
  const stablePermissions = { View: true };

  return {
    usePermissionProvider: jest
      .fn()
      .mockReturnValue({ permissions: stablePermissions }),
  };
});

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

// NOTE: `useFqn` and `useRequiredParams` are intentionally NOT mocked here.
// This file exercises the real route-param -> getFqnParts trimming pipeline
// (the code path the bug report says diverged), so the assertions prove the
// provider really trims the column/field suffix off the route :fqn before
// handing it to the suggestions REST call.

// Surfaces the provider's pending-count bookkeeping so the navigation
// regression case can assert the count never goes negative. The entity FQN
// itself is asserted via the `getSuggestionsList` call argument (the value
// actually sent to the backend), which is the real fix target.
function Probe() {
  const {
    suggestionLimit,
    suggestionPendingCount,
    suggestions: contextSuggestions,
  } = useSuggestionsContext();

  return (
    <>
      <div data-testid="suggestions-count">{contextSuggestions.length}</div>
      <div data-testid="suggestion-limit">{suggestionLimit}</div>
      <div data-testid="pending-count">{suggestionPendingCount}</div>
    </>
  );
}

// A child that can drive real in-router navigation so the effect dependency
// changes can be observed (mirrors GenericProvider.openColumnDetailPanel
// replacing the URL when a field panel opens/closes).
function NavigateButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();

  return (
    <button data-testid={`nav-${label}`} onClick={() => navigate(to)}>
      {label}
    </button>
  );
}

const renderProviderAt = (url: string, extra?: React.ReactNode) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          element={
            <SuggestionsProvider>
              <Probe />
              {extra}
            </SuggestionsProvider>
          }
          path="/:entityType/:fqn/:tab"
        />
      </Routes>
    </MemoryRouter>
  );

describe('SuggestionsProvider entity FQN trimming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSuggestionsList as jest.Mock).mockResolvedValue({
      data: MOCK_SUGGESTIONS,
      paging: { total: MOCK_SUGGESTIONS.length, after: null, before: null },
    });
  });

  it('queries suggestions with the trimmed parent FQN on a column-augmented topic URL', async () => {
    renderProviderAt('/topic/kafka_service.orders_topic.user/schema');

    // The provider must NOT forward the column-augmented FQN to the API; it has
    // to trim to the parent-entity FQN (service.topic) so the backend
    // prefix-match query finds the suggestions stored against the parent.
    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledWith({
        entityFQN: 'kafka_service.orders_topic',
        limit: 10,
      });
    });

    // And it must never have queried using the raw column-augmented route FQN.
    expect(getSuggestionsList).not.toHaveBeenCalledWith(
      expect.objectContaining({
        entityFQN: 'kafka_service.orders_topic.user',
      })
    );
  });

  it('does not over-trim a plain (non-column-augmented) topic URL', async () => {
    renderProviderAt('/topic/kafka_service.orders_topic/schema');

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledWith({
        entityFQN: 'kafka_service.orders_topic',
        limit: 10,
      });
    });
  });

  it('trims table FQNs to the 4-part parent (service.database.schema.table)', async () => {
    // A table column-augmented URL such as the one SchemaTable produces when a
    // column detail panel is open.
    renderProviderAt(
      '/table/svc.db.schema.orders.user_address.description/schema'
    );

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledWith({
        entityFQN: 'svc.db.schema.orders',
        limit: 10,
      });
    });

    expect(getSuggestionsList).not.toHaveBeenCalledWith(
      expect.objectContaining({
        entityFQN: 'svc.db.schema.orders.user_address.description',
      })
    );
  });

  it('trims API endpoint FQNs to the 3-part parent (service.collection.endpoint)', async () => {
    renderProviderAt('/apiEndpoint/svc.collection.ep.users_response/schema');

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledWith({
        entityFQN: 'svc.collection.ep',
        limit: 10,
      });
    });
  });

  it('trims search index FQNs to the 2-part parent (service.index)', async () => {
    renderProviderAt('/searchIndex/svc.idx.users.description/schema');

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledWith({
        entityFQN: 'svc.idx',
        limit: 10,
      });
    });
  });

  it('does not refetch (and never drives the pending count negative) when navigating plain -> column on the same entity', async () => {
    // 1. Land on the plain topic URL: one fetch against the parent FQN.
    const { getByTestId } = renderProviderAt(
      '/topic/kafka_service.orders_topic/schema',
      <NavigateButton
        label="open-column"
        to="/topic/kafka_service.orders_topic.user/schema"
      />
    );

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledTimes(1);
      expect(getSuggestionsList).toHaveBeenLastCalledWith({
        entityFQN: 'kafka_service.orders_topic',
        limit: 10,
      });
    });
    // Initial load: total 3, displayed 3 -> pending 0 (never negative).
    await waitFor(() => {
      expect(getByTestId('suggestions-count')).toHaveTextContent('3');
      expect(getByTestId('suggestion-limit')).toHaveTextContent('3');
      expect(getByTestId('pending-count')).toHaveTextContent('0');
    });

    // 2. Open the column detail panel: URL becomes column-augmented. Because
    //    the provider now derives entityFqn from the trimmed parent FQN, the
    //    trimmed value is unchanged, so the fetch effect must NOT refire. The
    //    pre-fix bug refetched with the longer FQN, got data: [], and ran the
    //    pending count to 0 - 3 = -3.
    fireEvent.click(getByTestId('nav-open-column'));

    // Still exactly one fetch; the pending count never went negative.
    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledTimes(1);
    });

    expect(getByTestId('pending-count')).toHaveTextContent('0');
    expect(getByTestId('suggestions-count')).toHaveTextContent('3');
  });

  it('refetches with the new trimmed parent FQN when navigating to a different entity', async () => {
    const { getByTestId } = renderProviderAt(
      '/topic/kafka_service.orders_topic/schema',
      <NavigateButton
        label="other-topic"
        to="/topic/kafka_service.other_topic/schema"
      />
    );

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(getByTestId('nav-other-topic'));

    await waitFor(() => {
      expect(getSuggestionsList).toHaveBeenCalledTimes(2);
      expect(getSuggestionsList).toHaveBeenLastCalledWith({
        entityFQN: 'kafka_service.other_topic',
        limit: 10,
      });
    });
  });
});
