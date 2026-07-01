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
import { useEffect, useRef, useState } from 'react';
import { getBasePath } from '../../../utils/HistoryUtils';
import { getEncodedFqn } from '../../../utils/StringUtils';
import { getOidcToken } from '../../../utils/SwTokenStorageUtils';

export interface UseLogStreamResult {
  logs: string;
  loading: boolean;
  streamDone: boolean;
  error: string | null;
}

export const useLogStream = (
  fqn: string,
  runId: string,
  enabled: boolean
): UseLogStreamResult => {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamDone, setStreamDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasReceivedData = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    hasReceivedData.current = false;

    setLogs('');
    setLoading(true);
    setStreamDone(false);
    setError(null);

    const connect = async () => {
      try {
        const token = await getOidcToken();
        const url = `${getBasePath()}/api/v1/services/ingestionPipelines/logs/${getEncodedFqn(
          fqn
        )}/stream/${runId}`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.ok) {
          setError(`Server returned ${response.status}`);
          setLoading(false);
          setStreamDone(true);

          return;
        }

        const reader = response.body?.getReader();

        if (!reader) {
          setError('Response body is not readable');
          setLoading(false);

          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            buffer += decoder.decode();

            break;
          }

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) {
              continue;
            }

            const content = line.slice(6);

            if (!content) {
              continue;
            }

            if (!hasReceivedData.current) {
              hasReceivedData.current = true;
              setLoading(false);
            }

            setLogs((prev) => (prev ? `${prev}\n${content}` : content));
          }
        }

        if (buffer.startsWith('data: ')) {
          const content = buffer.slice(6);

          if (content) {
            setLogs((prev) => (prev ? `${prev}\n${content}` : content));
          }
        }

        setStreamDone(true);
        setLoading(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }

        setError((err as Error).message ?? 'Unknown error');
        setLoading(false);
        setStreamDone(true);
      }
    };

    connect();

    return () => {
      controller.abort();
    };
  }, [fqn, runId, enabled]);

  return { logs, loading, streamDone, error };
};
