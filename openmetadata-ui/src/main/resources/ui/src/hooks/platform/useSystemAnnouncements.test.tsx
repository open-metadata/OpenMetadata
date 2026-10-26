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
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  AnnouncementStatus,
  AnnouncementType,
} from '../../generated/entity/feed/announcement';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
} from '../../rest/announcementsAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  useDeleteSystemAnnouncement,
  useSaveSystemAnnouncement,
  useSystemAnnouncementsList,
} from './useSystemAnnouncements';

jest.mock('../../rest/announcementsAPI', () => ({
  listAnnouncements: jest.fn(),
  createAnnouncement: jest.fn(),
  deleteAnnouncement: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockList = listAnnouncements as jest.Mock;

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const lastParams = () => mockList.mock.calls[mockList.mock.calls.length - 1][0];

const announcement = (id: string, displayName: string, startTime: number) => ({
  id,
  name: id,
  displayName,
  description: '',
  startTime,
  endTime: startTime + 1,
});

describe('useSystemAnnouncementsList', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockList.mockResolvedValue({
      data: [],
      paging: { total: 30, after: 'cursor-2' },
    });
  });

  it('lists only system announcements, filtered on the server', async () => {
    const { result } = renderHook(() => useSystemAnnouncementsList(), {
      wrapper,
    });

    await waitFor(() => expect(mockList).toHaveBeenCalled());

    expect(lastParams()).toEqual(
      expect.objectContaining({ system: true, limit: 1000 })
    );

    act(() =>
      result.current.updateFilters({
        status: AnnouncementStatus.Active,
        type: AnnouncementType.Critical,
      })
    );

    await waitFor(() =>
      expect(lastParams()).toEqual(
        expect.objectContaining({
          system: true,
          status: AnnouncementStatus.Active,
          type: AnnouncementType.Critical,
        })
      )
    );

    expect(result.current.hasFilters).toBe(true);
  });

  it('surfaces a server error at once instead of retrying behind the skeleton', async () => {
    mockList.mockRejectedValue({ response: { status: 500 } });
    const retryingWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: 3 } } })}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useSystemAnnouncementsList(), {
      wrapper: retryingWrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.isLoading).toBe(false);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('clears every filter, not only the search', async () => {
    const { result } = renderHook(() => useSystemAnnouncementsList(), {
      wrapper,
    });
    await waitFor(() => expect(mockList).toHaveBeenCalled());

    act(() =>
      result.current.updateFilters({
        search: 'outage',
        status: AnnouncementStatus.Scheduled,
        type: AnnouncementType.Critical,
      })
    );
    act(() => result.current.clearFilters());

    expect(result.current.filters).toEqual({ search: '' });
    expect(result.current.hasFilters).toBe(false);

    await waitFor(() =>
      expect(lastParams()).toEqual(
        expect.objectContaining({ status: undefined, type: undefined })
      )
    );
  });

  it('searches titles in the browser, across every fetched announcement', async () => {
    mockList.mockResolvedValue({
      data: [
        announcement('a', 'Snowflake credentials expire', 1),
        announcement('b', 'Planned MAINTENANCE window', 3),
        announcement('c', 'Glossary API retired', 2),
      ],
      paging: { total: 3 },
    });
    const { result } = renderHook(() => useSystemAnnouncementsList(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.total).toBe(3));

    act(() => result.current.updateFilters({ search: '  maintenance ' }));

    expect(result.current.announcements.map(({ id }) => id)).toEqual(['b']);
    // Typing never refetches: the search is not part of the request.
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(lastParams()).not.toHaveProperty('q');
  });

  it('pages locally, newest start first, and starts over when the filters change', async () => {
    mockList.mockResolvedValue({
      data: Array.from({ length: 25 }, (_, i) =>
        announcement(`a${i}`, `Announcement ${i}`, i)
      ),
      paging: { total: 25 },
    });
    const { result } = renderHook(() => useSystemAnnouncementsList(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.total).toBe(25));

    expect(result.current.pageCount).toBe(3);
    expect(result.current.announcements[0].id).toBe('a24');

    act(() => result.current.goToPage(3));

    expect(result.current.page).toBe(3);
    expect(result.current.announcements.map(({ id }) => id)).toEqual([
      'a4',
      'a3',
      'a2',
      'a1',
      'a0',
    ]);

    act(() => result.current.updateFilters({ type: AnnouncementType.Notice }));

    expect(result.current.page).toBe(1);
  });
});

describe('system announcement mutations', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports a failed save and does not treat it as saved', async () => {
    const error = new Error('conflict');
    (createAnnouncement as jest.Mock).mockRejectedValue(error);
    const onSaved = jest.fn();
    const { result } = renderHook(() => useSaveSystemAnnouncement(onSaved), {
      wrapper,
    });

    act(() =>
      result.current.mutate({
        request: { description: 'Body', startTime: 1, endTime: 2 },
      })
    );

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(onSaved).not.toHaveBeenCalled();
  });

  it('hard-deletes, and reports a failed delete without closing', async () => {
    const onDeleted = jest.fn();
    const { result } = renderHook(
      () => useDeleteSystemAnnouncement(onDeleted),
      { wrapper }
    );

    (deleteAnnouncement as jest.Mock).mockResolvedValueOnce({});
    act(() => result.current.mutate('a1'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));

    expect(deleteAnnouncement).toHaveBeenCalledWith('a1', true);

    const error = new Error('forbidden');
    (deleteAnnouncement as jest.Mock).mockRejectedValueOnce(error);
    act(() => result.current.mutate('a2'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(onDeleted).toHaveBeenCalledTimes(1);
  });
});
