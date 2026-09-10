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
import { useEffect, useState } from 'react';
import {
  LogStreamEndReason,
  LogStreamEvent,
  LogStreamEventType,
} from '../../../generated/entity/services/ingestionPipelines/logStreamEvent';
import { getBasePath } from '../../../utils/HistoryUtils';
import {
  abortableSleep,
  createStreamOpenHandler,
  createStreamRetryState,
  FatalStreamError,
  getBackoffDelay,
  nextRetryHealth,
  RetriableStreamError,
  StreamHealth,
} from '../../../utils/SseStreamUtils';
import { getEncodedFqn } from '../../../utils/StringUtils';
import { getOidcToken } from '../../../utils/SwTokenStorageUtils';

export interface UseLogStreamParams {
  // Base URL of the SSE endpoint to tail, without a cursor — the hook appends
  // its own `after` on reconnect. Any endpoint that emits LogStreamEvent frames
  // can be tailed; `getIngestionLogStreamUrl` builds the ingestion one.
  streamUrl: string;
  enabled: boolean;
}

export interface UseLogStreamResult {
  logs: string;
  loading: boolean;
  // The server said it is done sending, or the stream failed unrecoverably.
  streamDone: boolean;
  endReason?: LogStreamEndReason;
  // The server could not replay the whole backlog: earlier history has to come
  // from the paginated log endpoint.
  truncated: boolean;
  error: string | null;
  health: StreamHealth;
}

/**
 * A `complete` for one of these reasons is the server shedding load, not the run
 * ending — the log keeps growing, so reconnect from the cursor. `runFinished`
 * and `maxBytes` are final: there is either nothing more to read, or nothing
 * more this stream is willing to send.
 */
const RESUMABLE_END_REASONS = new Set<LogStreamEndReason>([
  LogStreamEndReason.IdleTimeout,
  LogStreamEndReason.MaxDuration,
]);

/**
 * Adds the resume cursor to a stream URL. Uses `&` when the caller's URL already
 * carries query parameters, so an endpoint that takes its own does not lose them
 * — or silently drop the cursor — on reconnect.
 */
export const withLogStreamCursor = (base: string, after?: string): string => {
  if (!after) {
    return base;
  }

  const separator = base.includes('?') ? '&' : '?';

  return `${base}${separator}after=${encodeURIComponent(after)}`;
};

/**
 * Stream URL for one ingestion run's logs.
 *
 * @param fqn Pipeline id or fullyQualifiedName — the endpoint accepts either.
 * @param runId Run to tail. A UUID on object storage, or the pipeline service's
 *   own run identifier (e.g. Airflow's `scheduled__<timestamp>`).
 */
export const getIngestionLogStreamUrl = (fqn: string, runId: string): string =>
  `${getBasePath()}/api/v1/services/ingestionPipelines/logs/${getEncodedFqn(
    fqn
  )}/stream/${encodeURIComponent(runId)}`;

/**
 * Tails one run's logs over Server-Sent Events.
 *
 * The backend reads from whichever log backend holds the run (object storage or
 * the pipeline service) and pushes one JSON {@link LogStreamEvent} per frame,
 * each carrying an opaque `after` cursor. This hook keeps that cursor and
 * reconnects with `?after=<cursor>` on any drop, so a lost connection neither
 * re-reads nor skips content.
 *
 * The endpoint is the caller's to choose: it takes a URL rather than a pipeline
 * so any resource exposing the same event contract — an ingestion pipeline here,
 * an entity that wraps one elsewhere — reuses this loop instead of copying it.
 *
 * Native EventSource cannot send the Authorization header the JWT filter
 * requires, hence the fetch-based client.
 */
export const useLogStream = ({
  streamUrl,
  enabled,
}: UseLogStreamParams): UseLogStreamResult => {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamDone, setStreamDone] = useState(false);
  const [endReason, setEndReason] = useState<LogStreamEndReason>();
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<StreamHealth>('connecting');

  useEffect(() => {
    if (!enabled || !streamUrl) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const retryState = createStreamRetryState();

    // Refs rather than state: the stream loop must read the latest value
    // synchronously, before React has committed anything.
    const cursorRef = { current: undefined as string | undefined };
    const terminalRef = { current: false };
    const resumeNowRef = { current: false };

    setLogs('');
    setLoading(true);
    setStreamDone(false);
    setEndReason(undefined);
    setTruncated(false);
    setError(null);
    setHealth('connecting');

    const update = (apply: () => void) => {
      if (!signal.aborted) {
        apply();
      }
    };

    const setHealthLive = () => update(() => setHealth('live'));

    const handleLogs = (event: LogStreamEvent) => {
      if (event.truncated) {
        update(() => setTruncated(true));
      }

      if (event.logs) {
        const appendChunk = (prev: string) => prev + event.logs;
        update(() => setLogs(appendChunk));
      }

      update(() => setLoading(false));
    };

    const handleComplete = (event: LogStreamEvent) => {
      const reason = event.reason;
      const resumable =
        reason !== undefined && RESUMABLE_END_REASONS.has(reason);

      if (resumable) {
        // The run is still going; come straight back rather than serving a
        // backoff sentence for the server's own cap.
        resumeNowRef.current = true;
        retryState.attempt = 0;

        return;
      }

      terminalRef.current = true;
      update(() => {
        setEndReason(reason);
        setStreamDone(true);
        setLoading(false);

        if (event.message) {
          setError(event.message);
        }
      });
    };

    const handleError = (event: LogStreamEvent) => {
      terminalRef.current = true;
      update(() => {
        setError(event.message ?? 'Log stream failed');
        setStreamDone(true);
        setLoading(false);
        setHealth('unavailable');
      });
    };

    const handleFrame = (data: string) => {
      if (!data) {
        return;
      }

      let event: LogStreamEvent;
      try {
        event = JSON.parse(data) as LogStreamEvent;
      } catch {
        // A malformed frame must not kill the stream.
        return;
      }

      if (event.after) {
        cursorRef.current = event.after;
      }

      if (event.eventType === LogStreamEventType.Logs) {
        handleLogs(event);
      } else if (event.eventType === LogStreamEventType.Complete) {
        handleComplete(event);
      } else if (event.eventType === LogStreamEventType.Error) {
        handleError(event);
      }
    };

    const connectOnce = async () => {
      const token = await getOidcToken();
      await fetchEventSource(
        withLogStreamCursor(streamUrl, cursorRef.current),
        {
          signal,
          headers: { Authorization: `Bearer ${token}` },
          onopen: createStreamOpenHandler(retryState, setHealthLive),
          onmessage: (message) => handleFrame(message.data),
          onerror: (streamError) => {
            // Rethrow so the loop below owns retry timing and token refresh.
            throw streamError;
          },
        }
      );
    };

    const streamForever = async () => {
      while (!signal.aborted && !terminalRef.current) {
        try {
          await connectOnce();

          // Resolved without a terminal frame: the server closed mid-run.
          throw new RetriableStreamError();
        } catch (streamError) {
          if (signal.aborted || terminalRef.current) {
            return;
          }

          if (streamError instanceof FatalStreamError) {
            const { health: fatalHealth } = streamError;
            update(() => {
              setHealth(fatalHealth);
              setStreamDone(true);
              setLoading(false);
            });

            return;
          }

          if (resumeNowRef.current) {
            resumeNowRef.current = false;

            continue;
          }

          const retryHealth = nextRetryHealth(retryState);
          update(() => setHealth(retryHealth));
          await abortableSleep(getBackoffDelay(retryState.attempt), signal);
        }
      }
    };

    void streamForever();

    return () => {
      controller.abort();
    };
  }, [streamUrl, enabled]);

  return {
    logs,
    loading,
    streamDone,
    endReason,
    truncated,
    error,
    health,
  };
};
