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
import { renderHook, waitFor } from '@testing-library/react';
import { useLogStream } from './useLogStream';

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  getOidcToken: jest.fn().mockResolvedValue('test-token'),
}));

jest.mock('../../../utils/HistoryUtils', () => ({
  getBasePath: jest.fn().mockReturnValue(''),
}));

jest.mock('../../../utils/StringUtils', () => ({
  getEncodedFqn: jest.fn((fqn: string) => fqn),
}));

const encoder = new TextEncoder();

// Builds a minimal reader mock — the hook only calls getReader() then read().
const makeReaderMock = (chunks: string[]) => {
  let index = 0;

  return {
    read: jest.fn().mockImplementation(async () => {
      if (index < chunks.length) {
        return { done: false, value: encoder.encode(chunks[index++]) };
      }

      return { done: true, value: undefined };
    }),
  };
};

const mockFetch = (chunks: string[], ok = true, status = 200) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    body: { getReader: () => makeReaderMock(chunks) },
  });
};

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('useLogStream', () => {
  it('does not fetch when enabled is false', () => {
    renderHook(() => useLogStream('my.pipeline', 'run-1', false));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches with the correct URL and Authorization header', async () => {
    mockFetch(['data: hello\n\n']);

    renderHook(() => useLogStream('my.pipeline', 'run-1', true));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toBe(
      '/api/v1/services/ingestionPipelines/logs/my.pipeline/stream/run-1'
    );
    expect(options.headers).toEqual({ Authorization: 'Bearer test-token' });
  });

  it('parses data: lines and accumulates them into logs', async () => {
    mockFetch(['data: line one\ndata: line two\n']);

    const { result } = renderHook(() =>
      useLogStream('my.pipeline', 'run-1', true)
    );

    await waitFor(() => expect(result.current.streamDone).toBe(true));

    expect(result.current.logs).toBe('line one\nline two');
  });

  it('ignores non-data SSE meta lines', async () => {
    mockFetch(['event: open\nid: 1\ndata: real line\nretry: 3000\n\n']);

    const { result } = renderHook(() =>
      useLogStream('my.pipeline', 'run-1', true)
    );

    await waitFor(() => expect(result.current.streamDone).toBe(true));

    expect(result.current.logs).toBe('real line');
  });

  it('sets loading false after first data line arrives', async () => {
    mockFetch(['data: first line\n']);

    const { result } = renderHook(() =>
      useLogStream('my.pipeline', 'run-1', true)
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('sets streamDone true when the stream closes naturally', async () => {
    mockFetch(['data: only line\n']);

    const { result } = renderHook(() =>
      useLogStream('my.pipeline', 'run-1', true)
    );

    await waitFor(() => expect(result.current.streamDone).toBe(true));

    expect(result.current.error).toBeNull();
  });

  it('sets error and clears loading on a non-2xx response', async () => {
    mockFetch([], false, 404);

    const { result } = renderHook(() =>
      useLogStream('my.pipeline', 'run-1', true)
    );

    await waitFor(() =>
      expect(result.current.error).toBe('Server returned 404')
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.streamDone).toBe(false);
  });

  it('aborts the fetch on unmount', async () => {
    mockFetch(['data: line\n']);

    const { unmount } = renderHook(() =>
      useLogStream('my.pipeline', 'run-1', true)
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const signal: AbortSignal = (global.fetch as jest.Mock).mock.calls[0][1]
      .signal;

    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  it('resets state and reconnects when fqn or runId changes', async () => {
    mockFetch(['data: run-1 line\n']);

    const { result, rerender } = renderHook(
      ({ fqn, runId }: { fqn: string; runId: string }) =>
        useLogStream(fqn, runId, true),
      { initialProps: { fqn: 'my.pipeline', runId: 'run-1' } }
    );

    await waitFor(() => expect(result.current.streamDone).toBe(true));

    mockFetch(['data: run-2 line\n']);
    rerender({ fqn: 'my.pipeline', runId: 'run-2' });

    await waitFor(() => expect(result.current.logs).toBe('run-2 line'));
  });
});
