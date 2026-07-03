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

import { fetchEventSource } from '@microsoft/fetch-event-source';
import { act, renderHook } from '@testing-library/react-hooks';
import { ServiceCategory } from '../../../enums/service.enum';
import { useServiceProgressStream } from './useServiceProgressStream';

jest.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: jest.fn(),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn().mockResolvedValue('test-jwt-token'),
}));

const mockRefreshToken = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../utils/Auth/TokenService/TokenServiceUtil', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({ refreshToken: mockRefreshToken }),
  },
}));

jest.mock('../../../utils/HistoryUtils', () => ({
  getBasePath: jest.fn().mockReturnValue(''),
}));

const mockFetchEventSource = fetchEventSource as jest.MockedFunction<
  typeof fetchEventSource
>;

type StreamOptions = Parameters<typeof fetchEventSource>[1];

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const neverResolve = () => new Promise<void>(() => undefined);

describe('useServiceProgressStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('connects with the service stream URL and bearer token', async () => {
    mockFetchEventSource.mockImplementation(() => neverResolve());

    renderHook(() =>
      useServiceProgressStream({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        serviceFqn: 'testSnowflake',
        onEvent: jest.fn(),
      })
    );

    await flushAsync();

    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);

    const [url, options] = mockFetchEventSource.mock.calls[0];

    expect(url).toBe(
      '/api/v1/services/ingestionPipelines/progress/service/databaseService/testSnowflake/stream'
    );
    expect(options?.headers).toEqual({
      Authorization: 'Bearer test-jwt-token',
    });
  });

  it('does not connect without a service fqn', async () => {
    renderHook(() =>
      useServiceProgressStream({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        serviceFqn: undefined,
        onEvent: jest.fn(),
      })
    );

    await flushAsync();

    expect(mockFetchEventSource).not.toHaveBeenCalled();
  });

  it('reports live health and dispatches parsed events', async () => {
    const onEvent = jest.fn();
    let capturedOptions: StreamOptions;
    mockFetchEventSource.mockImplementation(async (_url, options) => {
      capturedOptions = options;
      await options?.onopen?.({
        ok: true,
        status: 200,
      } as Response);

      return neverResolve();
    });

    const { result } = renderHook(() =>
      useServiceProgressStream({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        serviceFqn: 'testSnowflake',
        onEvent,
      })
    );

    await flushAsync();

    expect(result.current.streamHealth).toBe('live');

    const payload = {
      pipelineFqn: 'testSnowflake.metadata_agent',
      runId: 'run-1',
      event: { runId: 'run-1', timestamp: 1, updateType: 'PROCESSING' },
    };
    act(() => {
      capturedOptions?.onmessage?.({
        data: JSON.stringify(payload),
        event: '',
        id: '',
        retry: undefined,
      });
    });

    expect(onEvent).toHaveBeenCalledWith(payload);
  });

  it('ignores malformed frames without killing the stream', async () => {
    const onEvent = jest.fn();
    let capturedOptions: StreamOptions;
    mockFetchEventSource.mockImplementation(async (_url, options) => {
      capturedOptions = options;
      await options?.onopen?.({ ok: true, status: 200 } as Response);

      return neverResolve();
    });

    renderHook(() =>
      useServiceProgressStream({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        serviceFqn: 'testSnowflake',
        onEvent,
      })
    );

    await flushAsync();

    expect(() =>
      capturedOptions?.onmessage?.({
        data: 'not-json',
        event: '',
        id: '',
        retry: undefined,
      })
    ).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('stops permanently with unavailable health on 503', async () => {
    mockFetchEventSource.mockImplementation(async (_url, options) => {
      await options?.onopen?.({ ok: false, status: 503 } as Response);
    });

    const { result } = renderHook(() =>
      useServiceProgressStream({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        serviceFqn: 'testSnowflake',
        onEvent: jest.fn(),
      })
    );

    await flushAsync();

    expect(result.current.streamHealth).toBe('unavailable');
    expect(mockFetchEventSource).toHaveBeenCalledTimes(1);
  });

  it('refreshes the token once on 401 and reconnects', async () => {
    jest.useFakeTimers();
    try {
      mockFetchEventSource
        .mockImplementationOnce(async (_url, options) => {
          await options?.onopen?.({ ok: false, status: 401 } as Response);
        })
        .mockImplementation(() => neverResolve());

      renderHook(() =>
        useServiceProgressStream({
          serviceCategory: ServiceCategory.DATABASE_SERVICES,
          serviceFqn: 'testSnowflake',
          onEvent: jest.fn(),
        })
      );

      await flushAsync();

      expect(mockRefreshToken).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await flushAsync();

      expect(mockFetchEventSource).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('aborts the connection on unmount', async () => {
    let capturedSignal: AbortSignal | undefined;
    mockFetchEventSource.mockImplementation((_url, options) => {
      capturedSignal = options?.signal ?? undefined;

      return neverResolve();
    });

    const { unmount } = renderHook(() =>
      useServiceProgressStream({
        serviceCategory: ServiceCategory.DATABASE_SERVICES,
        serviceFqn: 'testSnowflake',
        onEvent: jest.fn(),
      })
    );

    await flushAsync();

    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});
