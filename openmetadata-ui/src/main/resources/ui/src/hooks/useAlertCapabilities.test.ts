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
import { act, renderHook } from '@testing-library/react-hooks';
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

const renderWith = (sources: string[], quiet = false) =>
  renderHook(
    (props: { sources: string[] }) =>
      useAlertCapabilities({
        alertType: AlertType.Notification,
        sources: props.sources,
        quiet,
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

  // The empty selection says who alerts can be sent to before any source is chosen.
  it('asks about the empty selection too', async () => {
    const { result, waitFor } = renderWith([]);
    await waitFor(() => expect(result.current.selection).toBeDefined());

    expect(mockGetAlertCapabilities).toHaveBeenCalledWith(
      expect.objectContaining({ sources: [] })
    );
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

    expect(mockGetAlertCapabilities).toHaveBeenCalledTimes(3);
    expect(result.current.selection?.sources).toHaveLength(2);
  });

  it('keeps the last answer while it asks about another selection', async () => {
    const { result, rerender, waitFor } = renderWith(['table']);
    await waitFor(() => expect(result.current.selection).toBeDefined());

    rerender({ sources: ['table', 'topic'] });

    expect(result.current.selection?.sources).toHaveLength(1);
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.selection?.sources).toHaveLength(2);
  });

  it('never shows an answer to a selection the user has left', async () => {
    let answerTheFirst: (value: unknown) => void = jest.fn();
    mockGetAlertCapabilities
      .mockImplementationOnce(
        () => new Promise((resolve) => (answerTheFirst = resolve))
      )
      .mockImplementation(({ sources }) => Promise.resolve(answer(sources)));
    const { result, rerender, waitFor } = renderWith(['table']);

    rerender({ sources: ['topic'] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      answerTheFirst(answer(['table']));
    });

    expect(result.current.selection?.sources[0].name).toBe('topic');
  });

  it('shows the error when the server cannot answer', async () => {
    mockGetAlertCapabilities.mockRejectedValue(new Error('boom'));
    const { result, waitFor } = renderWith(['table']);
    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(result.current.selection).toBeUndefined();
  });

  it('says nothing when asked to be quiet', async () => {
    mockGetAlertCapabilities.mockRejectedValue(new Error('boom'));
    const { result, waitFor } = renderWith(['table'], true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(showErrorToast).not.toHaveBeenCalled();
  });
});
