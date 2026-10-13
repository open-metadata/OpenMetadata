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
import { renderHook } from '@testing-library/react-hooks';
import { ReactNode } from 'react';
import { AlertType } from '../generated/events/api/alertCapabilitiesRequest';
import { getAlertCapabilities } from '../rest/alertsAPI';
import {
  AlertSelection,
  AlertSelectionProvider,
  useAlertSelection,
  useAlertSelectionContext,
} from './useAlertSelection';

jest.mock('../rest/alertsAPI', () => ({
  getAlertCapabilities: jest.fn(),
}));

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../utils/AlertsClassBase', () => ({
  __esModule: true,
  default: { getSourceNameSearch: jest.fn().mockReturnValue({}) },
}));

const mockGetAlertCapabilities = getAlertCapabilities as jest.Mock;

const answer = (sources: string[], recipientCategories: string[]) => ({
  alertType: AlertType.Notification,
  sources: sources.map((name) => ({ name, kind: 'activity', selected: true })),
  filters: [{ condition: { name: 'filterByMentionedName' }, sources }],
  triggers: [],
  recipientCategories,
});

describe('useAlertSelection', () => {
  beforeEach(() => {
    mockGetAlertCapabilities.mockReset();
    mockGetAlertCapabilities.mockImplementation(({ sources }) =>
      Promise.resolve(
        answer(
          sources,
          sources.length ? ['Owners', 'Mentions'] : ['Owners', 'Users']
        )
      )
    );
  });

  it('knows who alerts can be sent to before any source is chosen', async () => {
    const { result, waitFor } = renderHook(() =>
      useAlertSelection({ alertType: AlertType.Notification })
    );

    await waitFor(() =>
      expect(result.current.support.recipientCategories).toEqual([
        'Owners',
        'Users',
      ])
    );
  });

  it('says what the chosen sources support, from one answer of the server', async () => {
    const { result, waitFor } = renderHook(() =>
      useAlertSelection({
        alertType: AlertType.Notification,
        sources: ['task', 'conversation'],
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetAlertCapabilities).toHaveBeenCalledTimes(1);
    expect(result.current.sources).toEqual(['task', 'conversation']);
    expect(result.current.support.recipientCategories).toEqual([
      'Owners',
      'Mentions',
    ]);
    expect(
      result.current.support.supportedFilters?.map((filter) => filter.name)
    ).toEqual(['filterByMentionedName']);
  });

  it('lets every field inside the page read the same selection', async () => {
    const { result: page, waitFor } = renderHook(() =>
      useAlertSelection({
        alertType: AlertType.Notification,
        sources: ['task'],
      })
    );
    await waitFor(() => expect(page.current.loading).toBe(false));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AlertSelectionProvider value={page.current as AlertSelection}>
        {children}
      </AlertSelectionProvider>
    );

    const { result: field } = renderHook(() => useAlertSelectionContext(), {
      wrapper,
    });

    expect(field.current).toBe(page.current);
  });

  it('shows nothing selected to a field outside any page', async () => {
    const { result } = renderHook(() => useAlertSelectionContext());

    expect(result.current.sources).toEqual([]);
    expect(result.current.support.recipientCategories).toBeUndefined();
    await expect(result.current.search.byName('orders')).resolves.toEqual([]);
  });
});
