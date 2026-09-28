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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import InboxIconButton from './InboxIconButton';

const mockListVisibleTasks = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../../../../rest/tasksAPI', () => ({
  listMyVisibleTasks: (...args: unknown[]) => mockListVisibleTasks(...args),
  TaskStatusGroup: { Open: 'open', Active: 'active', Closed: 'closed' },
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'user-1' } }),
}));

jest.mock('../../../../hooks/usePersonalSpaceStore', () => ({
  usePersonalSpaceStore: (selector: (s: unknown) => unknown) =>
    selector({ inboxDateRange: undefined }),
}));

jest.mock('../InboxPage/inbox.utils', () => ({
  getDefaultInboxDateRange: () => ({ startTs: 10, endTs: 20 }),
}));

jest.mock('../personalSpace.constants', () => ({
  PERSONAL_SPACE_ROUTES: {
    INBOX: '/inbox',
    INBOX_ACTIVITY: '/inbox/activity',
    INBOX_TASKS: '/inbox/tasks',
    MY_DATA: '/my-data',
  },
}));

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/other' }),
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@untitledui/icons', () => ({
  Inbox01: () => <span data-testid="inbox-icon" />,
}));

const renderButton = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InboxIconButton />
    </QueryClientProvider>
  );
};

describe('InboxIconButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts only the Open task group for the current window', async () => {
    mockListVisibleTasks.mockResolvedValue({ paging: { total: 9 } });

    renderButton();

    await waitFor(() =>
      expect(screen.getByTestId('ai-inbox-badge')).toHaveTextContent('9')
    );

    expect(mockListVisibleTasks).toHaveBeenCalledWith({
      limit: 1,
      startTs: 10,
      endTs: 20,
      statusGroup: 'open',
    });
  });

  it('renders no badge when there are no open tasks', async () => {
    mockListVisibleTasks.mockResolvedValue({ paging: { total: 0 } });

    renderButton();

    await waitFor(() => expect(mockListVisibleTasks).toHaveBeenCalled());

    expect(screen.queryByTestId('ai-inbox-badge')).not.toBeInTheDocument();
  });

  it('caps the badge at 99+', async () => {
    mockListVisibleTasks.mockResolvedValue({ paging: { total: 150 } });

    renderButton();

    await waitFor(() =>
      expect(screen.getByTestId('ai-inbox-badge')).toHaveTextContent('99+')
    );
  });
});
