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
import { renderHook } from '@testing-library/react-hooks';
import { AlertType } from '../generated/events/api/alertCapabilitiesRequest';
import { getAlertCapabilities } from '../rest/alertsAPI';
import { showErrorToast } from '../utils/ToastUtils';
import { useAlertCapabilities } from './useAlertCapabilities';

jest.mock('../rest/alertsAPI', () => ({
  getAlertCapabilities: jest.fn(),
}));

const mockGetAlertCapabilities = getAlertCapabilities as jest.Mock;

const answer = (sources: string[]) => ({
  alertType: AlertType.Notification,
  sources: sources.map((name) => ({ name, kind: 'entity', selected: true })),
  filters: [],
  triggers: [],
});

const renderWith = (sources: string[]) =>
  renderHook(
    (props: { sources: string[] }) =>
      useAlertCapabilities({
        alertType: AlertType.Notification,
        sources: props.sources,
      }),
    { initialProps: { sources } }
  );

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('useAlertCapabilities', () => {
  beforeEach(() => {
    mockGetAlertCapabilities.mockReset();
    (showErrorToast as jest.Mock).mockReset();
    mockGetAlertCapabilities.mockImplementation(({ sources }) =>
      Promise.resolve(answer(sources))
    );
  });

  it('asks nothing while nothing is selected', () => {
    const { result } = renderWith([]);

    expect(mockGetAlertCapabilities).not.toHaveBeenCalled();
    expect(result.current.selection).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });

  it('asks once per distinct selection, whatever its order', async () => {
    const { result, rerender, waitFor } = renderWith([]);

    rerender({ sources: ['table'] });
    await waitFor(() => expect(result.current.selection).toBeDefined());
    rerender({ sources: ['table', 'topic'] });
    await waitFor(() =>
      expect(result.current.selection?.sources).toHaveLength(2)
    );
    rerender({ sources: ['topic', 'table'] });
    rerender({ sources: ['table'] });
    rerender({ sources: ['table', 'topic'] });

    expect(mockGetAlertCapabilities).toHaveBeenCalledTimes(2);
    expect(result.current.selection?.sources).toHaveLength(2);
  });

  it('forgets what was said about another selection while it asks', async () => {
    const { result, rerender, waitFor } = renderWith(['table']);
    await waitFor(() => expect(result.current.selection).toBeDefined());

    rerender({ sources: ['table', 'topic'] });

    expect(result.current.selection).toBeUndefined();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selection?.sources).toHaveLength(2);
  });

  it('shows the error when the server cannot answer', async () => {
    mockGetAlertCapabilities.mockRejectedValue(new Error('boom'));
    const { result, waitFor } = renderWith(['table']);
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(result.current.selection).toBeUndefined();
  });
});
