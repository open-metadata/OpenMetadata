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

import {
  EventSourceMessage,
  fetchEventSource,
} from '@microsoft/fetch-event-source';
import { act, renderHook } from '@testing-library/react-hooks';
import {
  LogStreamEndReason,
  LogStreamEvent,
  LogStreamEventType,
} from '../../../generated/entity/services/ingestionPipelines/logStreamEvent';
import {
  getIngestionLogStreamUrl,
  useLogStream,
  withLogStreamCursor,
} from './useLogStream';

jest.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: jest.fn(),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn().mockResolvedValue('test-jwt-token'),
}));

const mockEnsureFreshToken = jest.fn().mockResolvedValue(undefined);

// `ensureFreshToken` is wrapped in an arrow function rather than referenced
// directly so the read of `mockEnsureFreshToken` is deferred until the real
// call site invokes it — jest hoists this factory above the `const`
// declaration above, so an eager read would throw a TDZ ReferenceError.
jest.mock('../../../utils/Auth/AuthCoordinator', () => ({
  authCoordinator: {
    ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
  },
}));

jest.mock('../../../utils/HistoryUtils', () => ({
  getBasePath: jest.fn().mockReturnValue(''),
}));

const mockFetchEventSource = fetchEventSource as jest.MockedFunction<
  typeof fetchEventSource
>;

type StreamInput = Parameters<typeof fetchEventSource>[0];
type StreamOptions = Parameters<typeof fetchEventSource>[1];

const FQN = 'sample_data.log_pipeline';
const RUN_ID = 'scheduled__2026-08-11T00:00:00+00:00';
const BASE_URL = `/api/v1/services/ingestionPipelines/logs/${encodeURIComponent(
  FQN
)}/stream/${encodeURIComponent(RUN_ID)}`;

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const neverResolve = () => new Promise<void>(() => undefined);

const send = (options: StreamOptions, event: LogStreamEvent) => {
  options?.onmessage?.({ data: JSON.stringify(event) } as EventSourceMessage);
};

const sendRaw = (options: StreamOptions, data: string) => {
  options?.onmessage?.({ data } as EventSourceMessage);
};

/** Opens successfully, delivers `events`, then hangs (server still streaming). */
const openAndSend =
  (...events: LogStreamEvent[]) =>
  async (_url: StreamInput, options: StreamOptions) => {
    await options?.onopen?.({ ok: true, status: 200 } as Response);
    events.forEach((event) => send(options, event));

    return neverResolve();
  };

/** Opens successfully, delivers `events`, then closes cleanly. */
const openSendAndClose =
  (...events: LogStreamEvent[]) =>
  async (_url: StreamInput, options: StreamOptions) => {
    await options?.onopen?.({ ok: true, status: 200 } as Response);
    events.forEach((event) => send(options, event));
  };

const renderStream = (enabled = true) =>
  renderHook(() => useLogStream({ streamUrl: BASE_URL, enabled }));

describe('useLogStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('connects with the stream URL and bearer token, without a cursor', async () => {
    mockFetchEventSource.mockImplementation(() => neverResolve());

    renderStream();

    await flushAsync();

    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetchEventSource.mock.calls[0];

    expect(url).toBe(BASE_URL);
    expect(options?.headers).toEqual({
      Authorization: 'Bearer test-jwt-token',
    });
  });

  it('does not connect when disabled', async () => {
    renderStream(false);

    await flushAsync();

    expect(mockFetchEventSource).not.toHaveBeenCalled();
  });

  it('does not connect without a stream url', async () => {
    renderHook(() => useLogStream({ streamUrl: '', enabled: true }));

    await flushAsync();

    expect(mockFetchEventSource).not.toHaveBeenCalled();
  });

  it('appends log frames in order and reports live health', async () => {
    mockFetchEventSource.mockImplementation(
      openAndSend(
        { eventType: LogStreamEventType.Logs, logs: 'first\n', after: '1' },
        { eventType: LogStreamEventType.Logs, logs: 'second\n', after: '2' }
      )
    );

    const { result } = renderStream();

    await flushAsync();

    expect(result.current.logs).toBe('first\nsecond\n');
    expect(result.current.loading).toBe(false);
    expect(result.current.health).toBe('live');
    expect(result.current.streamDone).toBe(false);
  });

  it('latches the truncated flag from a replayed frame', async () => {
    mockFetchEventSource.mockImplementation(
      openAndSend(
        {
          eventType: LogStreamEventType.Logs,
          logs: 'mid-run\n',
          after: '40',
          replay: true,
          truncated: true,
        },
        { eventType: LogStreamEventType.Logs, logs: 'more\n', after: '41' }
      )
    );

    const { result } = renderStream();

    await flushAsync();

    expect(result.current.truncated).toBe(true);
  });

  it('ignores a malformed frame without killing the stream', async () => {
    mockFetchEventSource.mockImplementation(
      async (_url, options: StreamOptions) => {
        await options?.onopen?.({ ok: true, status: 200 } as Response);
        sendRaw(options, 'not json');
        send(options, {
          eventType: LogStreamEventType.Logs,
          logs: 'survived\n',
          after: '1',
        });

        return neverResolve();
      }
    );

    const { result } = renderStream();

    await flushAsync();

    expect(result.current.logs).toBe('survived\n');
    expect(result.current.streamDone).toBe(false);
  });

  it('stops on a complete frame for a finished run', async () => {
    mockFetchEventSource.mockImplementation(
      openSendAndClose(
        { eventType: LogStreamEventType.Logs, logs: 'done\n', after: '9' },
        {
          eventType: LogStreamEventType.Complete,
          reason: LogStreamEndReason.RunFinished,
          after: '9',
        }
      )
    );

    const { result } = renderStream();

    await flushAsync();

    expect(result.current.streamDone).toBe(true);
    expect(result.current.endReason).toBe(LogStreamEndReason.RunFinished);
    expect(result.current.logs).toBe('done\n');
    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);
  });

  it('resumes from the last cursor after a server-capped complete', async () => {
    mockFetchEventSource
      .mockImplementationOnce(
        openSendAndClose(
          { eventType: LogStreamEventType.Logs, logs: 'chunk-1\n', after: '5' },
          {
            eventType: LogStreamEventType.Complete,
            reason: LogStreamEndReason.IdleTimeout,
            after: '5',
          }
        )
      )
      .mockImplementationOnce(
        openAndSend({
          eventType: LogStreamEventType.Logs,
          logs: 'chunk-2\n',
          after: '6',
        })
      );

    const { result } = renderStream();

    await flushAsync();

    expect(mockFetchEventSource).toHaveBeenCalledTimes(2);
    expect(mockFetchEventSource.mock.calls[1][0]).toBe(`${BASE_URL}?after=5`);
    expect(result.current.logs).toBe('chunk-1\nchunk-2\n');
    expect(result.current.streamDone).toBe(false);
  });

  it('surfaces an error frame and stops', async () => {
    mockFetchEventSource.mockImplementation(
      openSendAndClose({
        eventType: LogStreamEventType.Error,
        message: 'No log backend is configured on this deployment.',
      })
    );

    const { result } = renderStream();

    await flushAsync();

    expect(result.current.error).toBe(
      'No log backend is configured on this deployment.'
    );
    expect(result.current.streamDone).toBe(true);
    expect(result.current.health).toBe('unavailable');
    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);
  });

  it('stops without retrying when the deployment has no stream support', async () => {
    mockFetchEventSource.mockImplementation(
      async (_url, options: StreamOptions) => {
        await options?.onopen?.({ ok: false, status: 503 } as Response);
      }
    );

    const { result } = renderStream();

    await flushAsync();

    expect(result.current.health).toBe('unavailable');
    expect(result.current.streamDone).toBe(true);
    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);
  });

  it('refreshes the token once on a 401 and retries', async () => {
    jest.useFakeTimers();

    mockFetchEventSource
      .mockImplementationOnce(async (_url, options: StreamOptions) => {
        await options?.onopen?.({ ok: false, status: 401 } as Response);
      })
      .mockImplementationOnce(
        openAndSend({
          eventType: LogStreamEventType.Logs,
          logs: 'after-refresh\n',
          after: '1',
        })
      );

    const { result } = renderStream();

    await flushAsync();

    expect(mockEnsureFreshToken).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    await flushAsync();

    expect(mockFetchEventSource).toHaveBeenCalledTimes(2);
    expect(result.current.logs).toBe('after-refresh\n');

    jest.useRealTimers();
  });

  it('aborts the connection on unmount', async () => {
    let capturedOptions: StreamOptions | undefined;
    mockFetchEventSource.mockImplementation(
      async (_url, options: StreamOptions) => {
        capturedOptions = options;

        return neverResolve();
      }
    );

    const { unmount } = renderStream();

    await flushAsync();

    expect(capturedOptions?.signal?.aborted).toBe(false);

    unmount();

    expect(capturedOptions?.signal?.aborted).toBe(true);
  });

  it('resumes a url that already has query params with an ampersand', async () => {
    const urlWithQuery = `${BASE_URL}?tail=true`;
    mockFetchEventSource
      .mockImplementationOnce(
        openSendAndClose(
          {
            eventType: LogStreamEventType.Logs,
            logs: 'chunk-1\n',
            after: '7',
          },
          {
            // A resumable end, so the reconnect is immediate rather than after a
            // backoff this test would have to wait out.
            eventType: LogStreamEventType.Complete,
            reason: LogStreamEndReason.IdleTimeout,
            after: '7',
          }
        )
      )
      .mockImplementationOnce(() => neverResolve());

    renderHook(() => useLogStream({ streamUrl: urlWithQuery, enabled: true }));

    await flushAsync();

    expect(mockFetchEventSource.mock.calls[1][0]).toBe(
      `${urlWithQuery}&after=7`
    );
  });
});

describe('log stream urls', () => {
  it('builds the ingestion stream url with an encoded fqn and run id', () => {
    expect(getIngestionLogStreamUrl(FQN, RUN_ID)).toBe(BASE_URL);
  });

  it('leaves a url untouched without a cursor', () => {
    expect(withLogStreamCursor(BASE_URL)).toBe(BASE_URL);
  });

  it('appends the cursor as the only query param', () => {
    expect(withLogStreamCursor(BASE_URL, 'chunk:12')).toBe(
      `${BASE_URL}?after=chunk%3A12`
    );
  });

  it('appends the cursor to a url that already has query params', () => {
    expect(withLogStreamCursor(`${BASE_URL}?tail=true`, '5')).toBe(
      `${BASE_URL}?tail=true&after=5`
    );
  });
});
