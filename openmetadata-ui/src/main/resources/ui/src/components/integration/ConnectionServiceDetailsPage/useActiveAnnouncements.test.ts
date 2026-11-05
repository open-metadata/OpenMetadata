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
import { act, renderHook, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { getActiveAnnouncements } from '../../../rest/announcementsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useActiveAnnouncements } from './useActiveAnnouncements';

jest.mock('../../../rest/announcementsAPI', () => ({
  getActiveAnnouncements: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const announcement = (id: string) => ({ id });

const renderAnnouncements = (fqn = 'sales_db') =>
  renderHook(
    (props) => useActiveAnnouncements(EntityType.DATABASE_SERVICE, props.fqn),
    {
      initialProps: { fqn },
    }
  );

describe('useActiveAnnouncements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getActiveAnnouncements as jest.Mock).mockResolvedValue({
      data: [announcement('a1')],
    });
  });

  it("loads the entity's active announcements", async () => {
    const { result } = renderAnnouncements();

    await waitFor(() =>
      expect(result.current.announcements).toEqual([announcement('a1')])
    );

    expect(getActiveAnnouncements).toHaveBeenCalledWith(
      '<#E::databaseService::sales_db>'
    );
  });

  it('asks for nothing before the entity has loaded', () => {
    const { result } = renderAnnouncements('');

    expect(getActiveAnnouncements).not.toHaveBeenCalled();
    expect(result.current.announcements).toEqual([]);
  });

  it('reloads them on refetch', async () => {
    const { result } = renderAnnouncements();
    await waitFor(() => expect(result.current.announcements).toHaveLength(1));
    (getActiveAnnouncements as jest.Mock).mockResolvedValueOnce({ data: [] });

    await act(() => result.current.refetch());

    expect(result.current.announcements).toEqual([]);
  });

  it("keeps the current entity's announcements when the previous one's arrive later", async () => {
    const pending: Array<(value: unknown) => void> = [];
    (getActiveAnnouncements as jest.Mock)
      .mockImplementationOnce(
        () => new Promise((resolve) => pending.push(resolve))
      )
      .mockResolvedValueOnce({ data: [announcement('current')] });
    const { result, rerender } = renderAnnouncements('old_db');

    rerender({ fqn: 'sales_db' });
    await waitFor(() =>
      expect(result.current.announcements).toEqual([announcement('current')])
    );
    await act(async () => pending[0]({ data: [announcement('stale')] }));

    expect(result.current.announcements).toEqual([announcement('current')]);
  });

  it('says why when they cannot be loaded', async () => {
    const error = new Error('boom');
    (getActiveAnnouncements as jest.Mock).mockRejectedValueOnce(error);
    renderAnnouncements();

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));
  });
});
