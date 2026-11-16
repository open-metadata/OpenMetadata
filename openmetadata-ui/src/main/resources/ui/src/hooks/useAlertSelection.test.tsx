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

  it('is ready once the server has answered, and stays ready', async () => {
    const { result, rerender, waitFor } = renderHook(
      (props: { sources: string[] }) =>
        useAlertSelection({
          alertType: AlertType.Notification,
          sources: props.sources,
        }),
      { initialProps: { sources: [] as string[] } }
    );

    expect(result.current.ready).toBe(false);

    await waitFor(() => expect(result.current.ready).toBe(true));
    rerender({ sources: ['task'] });

    expect(result.current.ready).toBe(true);
  });

  // The empty form asks first; a saved alert's sources only arrive after it has loaded.
  it('does not describe the saved sources with the answer for an empty form', async () => {
    let answerTask: (value: unknown) => void = jest.fn();
    mockGetAlertCapabilities.mockImplementation(({ sources }) =>
      sources.length
        ? new Promise((resolve) => (answerTask = resolve))
        : Promise.resolve(answer([], ['Owners', 'Users']))
    );
    const { result, rerender, waitFor } = renderHook(
      (props: { sources: string[] }) =>
        useAlertSelection({
          alertType: AlertType.Notification,
          sources: props.sources,
        }),
      { initialProps: { sources: [] as string[] } }
    );
    await waitFor(() => expect(result.current.ready).toBe(true));

    rerender({ sources: ['task'] });

    expect(result.current.support.supportedFilters).toBeUndefined();

    answerTask(answer(['task'], ['Owners', 'Mentions']));
    await waitFor(() =>
      expect(result.current.support.supportedFilters).toHaveLength(1)
    );
  });

  // A filter one source supports may not hold for the one just added, and the save would refuse it.
  it('offers no rule from the previous answer while it asks about a new source', async () => {
    let answerBoth: (value: unknown) => void = jest.fn();
    mockGetAlertCapabilities.mockImplementation(({ sources }) =>
      sources.length > 1
        ? new Promise((resolve) => (answerBoth = resolve))
        : Promise.resolve(answer(sources, ['Owners']))
    );
    const { result, rerender, waitFor } = renderHook(
      (props: { sources: string[] }) =>
        useAlertSelection({
          alertType: AlertType.Notification,
          sources: props.sources,
        }),
      { initialProps: { sources: ['task'] } }
    );
    await waitFor(() =>
      expect(result.current.support.supportedFilters).toHaveLength(1)
    );

    rerender({ sources: ['task', 'conversation'] });

    expect(result.current.support.supportedFilters).toBeUndefined();
    expect(result.current.support.hasFilters).toBe(true);

    answerBoth(answer(['task', 'conversation'], ['Owners']));
    await waitFor(() =>
      expect(result.current.support.supportedFilters).toHaveLength(1)
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

  it('keeps the same search when a new answer says the same thing', async () => {
    const { result, rerender, waitFor } = renderHook(
      ({ input }) =>
        useAlertSelection({
          alertType: AlertType.Notification,
          sources: ['task'],
          input,
        }),
      { initialProps: { input: {} } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    const firstSearch = result.current.search;

    rerender({ input: { filters: [{ name: 'filterByMentionedName' }] } });
    await waitFor(() =>
      expect(mockGetAlertCapabilities).toHaveBeenCalledTimes(2)
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.search).toBe(firstSearch);
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
