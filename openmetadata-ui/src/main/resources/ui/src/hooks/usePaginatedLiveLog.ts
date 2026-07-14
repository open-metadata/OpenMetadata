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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showErrorToast } from '../utils/ToastUtils';
import { usePollingEffect } from './usePollingEffect';

export interface LogPage {
  content: string;
  // Cursor to fetch the NEXT page. Backends omit it for the last (growing) page.
  after?: string;
  total?: string;
}

export interface UsePaginatedLiveLogParams {
  // Fetches one page (chunk) of the log at the given cursor.
  fetchPage: (cursor?: string) => Promise<LogPage>;
  // Identity of the log being viewed; changing it resets + refetches.
  resetKey: string;
  // Whether to fetch at all (e.g. modal open AND id resolved).
  enabled: boolean;
  // Whether the underlying run is still active — gates tail polling.
  isLive: boolean;
  intervalMs?: number;
}

export interface UsePaginatedLiveLogResult {
  logs: string;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  totalLines: number;
  loadMore: () => void;
}

// Backends disagree on how they signal the final page: K8s/S3 omit `after`,
// while Airflow returns `after === total`. Treat either as the tail so live
// tailing + pagination end-detection work across all deployments.
const isTailPage = (page: LogPage): boolean =>
  !page.after ||
  (page.total !== undefined && Number(page.after) >= Number(page.total));

/**
 * Paginated log reader with tail polling. Models the log as an immutable
 * `committed` prefix (complete pages, each returned an `after` cursor) plus a
 * `tail` (the last/growing page, which omits `after`). Forward pagination
 * (`loadMore`) preserves infinite scroll; while `isLive` it polls ONLY the tail
 * page and replaces it — so a growing log never duplicates already-shown lines.
 */
export const usePaginatedLiveLog = ({
  fetchPage,
  resetKey,
  enabled,
  isLive,
  intervalMs,
}: UsePaginatedLiveLogParams): UsePaginatedLiveLogResult => {
  const [committed, setCommitted] = useState('');
  const [tail, setTail] = useState('');
  const [tailCursor, setTailCursor] = useState<string | undefined>();
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [reachedTail, setReachedTail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Keep the latest fetchPage without making effects depend on its identity.
  const fetchPageRef = useRef(fetchPage);
  useEffect(() => {
    fetchPageRef.current = fetchPage;
  });

  // Bumped on reset to invalidate in-flight responses; shared busy lock so
  // loadMore and the tail poll never interleave.
  const requestIdRef = useRef(0);
  const busyRef = useRef(false);

  // A final tail read requested (on the live→terminal edge) while a request was
  // in flight; flushed once the lock frees so trailing lines are never lost.
  const pendingFinalRef = useRef(false);
  const pollTailRef = useRef<() => Promise<void>>();

  const flushFinalTail = useCallback(() => {
    if (pendingFinalRef.current && !busyRef.current) {
      pendingFinalRef.current = false;
      pollTailRef.current?.();
    }
  }, []);

  const fetchForward = useCallback(
    async (cursor: string | undefined, isInitial: boolean) => {
      if (busyRef.current) {
        return;
      }
      const requestId = requestIdRef.current;
      busyRef.current = true;
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const page = await fetchPageRef.current(cursor);
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (isTailPage(page)) {
          setTail(page.content);
          setTailCursor(cursor);
          setNextCursor(undefined);
          setReachedTail(true);
        } else {
          setCommitted((prev) => prev + page.content);
          setNextCursor(page.after);
          setReachedTail(false);
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          busyRef.current = false;
          if (isInitial) {
            setLoading(false);
          } else {
            setLoadingMore(false);
          }
          flushFinalTail();
        }
      }
    },
    [flushFinalTail]
  );

  useEffect(() => {
    requestIdRef.current += 1;
    busyRef.current = false;
    setCommitted('');
    setTail('');
    setTailCursor(undefined);
    setNextCursor(undefined);
    setReachedTail(false);
    if (enabled && resetKey) {
      fetchForward(undefined, true);
    }
  }, [resetKey, enabled]);

  const hasMore = nextCursor !== undefined;

  const loadMore = useCallback(() => {
    if (hasMore && !busyRef.current) {
      fetchForward(nextCursor, false);
    }
  }, [hasMore, nextCursor, fetchForward]);

  const pollTail = useCallback(async () => {
    if (!reachedTail || busyRef.current) {
      return;
    }
    const requestId = requestIdRef.current;
    busyRef.current = true;
    try {
      let cursor = tailCursor;
      let carried = '';
      // Re-read the tail; if it rolled over into new complete chunks, commit
      // them and walk forward to the new tail.
      let done = false;
      while (!done) {
        const page = await fetchPageRef.current(cursor);
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (isTailPage(page)) {
          if (carried) {
            setCommitted((prev) => prev + carried);
          }
          setTail(page.content);
          setTailCursor(cursor);
          done = true;
        } else {
          carried += page.content;
          cursor = page.after;
        }
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        busyRef.current = false;
        flushFinalTail();
      }
    }
  }, [reachedTail, tailCursor, flushFinalTail]);

  useEffect(() => {
    pollTailRef.current = pollTail;
  });

  usePollingEffect(pollTail, {
    enabled: enabled && isLive && reachedTail,
    intervalMs,
  });

  // Tail polling stops the moment `isLive` flips false, so lines written between
  // the last poll and the run's terminal transition would be lost. Request one
  // final tail read on that true→false edge; if a request is in flight it is
  // deferred (via `flushFinalTail`) until the lock frees, so it never no-ops.
  const prevIsLiveRef = useRef(isLive);
  useEffect(() => {
    const wasLive = prevIsLiveRef.current;
    prevIsLiveRef.current = isLive;
    if (wasLive && !isLive && enabled && reachedTail) {
      pendingFinalRef.current = true;
      flushFinalTail();
    }
  }, [isLive, enabled, reachedTail, flushFinalTail]);

  const logs = committed + tail;
  const totalLines = useMemo(
    () => (logs ? logs.split('\n').length : 0),
    [logs]
  );

  return { logs, hasMore, loading, loadingMore, totalLines, loadMore };
};
