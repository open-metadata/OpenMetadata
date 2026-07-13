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
        if (page.after) {
          setCommitted((prev) => prev + page.content);
          setNextCursor(page.after);
          setReachedTail(false);
        } else {
          setTail(page.content);
          setTailCursor(cursor);
          setNextCursor(undefined);
          setReachedTail(true);
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
        }
      }
    },
    []
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
        if (page.after) {
          carried += page.content;
          cursor = page.after;
        } else {
          if (carried) {
            setCommitted((prev) => prev + carried);
          }
          setTail(page.content);
          setTailCursor(cursor);
          done = true;
        }
      }
    } catch (error) {
      if (requestId === requestIdRef.current) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        busyRef.current = false;
      }
    }
  }, [reachedTail, tailCursor]);

  usePollingEffect(pollTail, {
    enabled: enabled && isLive && reachedTail,
    intervalMs,
  });

  const logs = committed + tail;
  const totalLines = useMemo(
    () => (logs ? logs.split('\n').length : 0),
    [logs]
  );

  return { logs, hasMore, loading, loadingMore, totalLines, loadMore };
};
