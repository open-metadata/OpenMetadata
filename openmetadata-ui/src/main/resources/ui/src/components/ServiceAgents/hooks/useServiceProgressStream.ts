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
import { useEffect, useRef, useState } from 'react';
import { ServiceCategory } from '../../../enums/service.enum';
import { ServiceProgressEvent } from '../../../generated/entity/services/ingestionPipelines/serviceProgressEvent';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import { getBasePath } from '../../../utils/HistoryUtils';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServicePureUtils';
import { getEncodedFqn } from '../../../utils/StringUtils';
import { getOidcToken } from '../../../utils/SwTokenStorageUtils';

export type StreamHealth = 'connecting' | 'live' | 'unavailable' | 'down';

interface UseServiceProgressStreamProps {
  serviceCategory: ServiceCategory;
  serviceFqn?: string;
  onEvent: (event: ServiceProgressEvent) => void;
}

const MAX_ATTEMPTS_BEFORE_DOWN = 5;
const MAX_BACKOFF_MS = 30000;
const BASE_BACKOFF_MS = 1000;

class FatalStreamError extends Error {
  constructor(public readonly health: StreamHealth) {
    super(`Stream terminated: ${health}`);
  }
}

class RetriableStreamError extends Error {}

const getBackoffDelay = (attempt: number): number =>
  Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);

const abortableSleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        resolve();
      },
      { once: true }
    );
  });

export const getServiceProgressStreamUrl = (
  serviceCategory: ServiceCategory,
  serviceFqn: string
): string => {
  const serviceType = getEntityTypeFromServiceCategory(serviceCategory);

  return `${getBasePath()}/api/v1/services/ingestionPipelines/progress/service/${serviceType}/${getEncodedFqn(
    serviceFqn
  )}/stream`;
};

/**
 * Holds one SSE connection per service page to the backend progress stream.
 * The backend replays a snapshot of every active run on connect, then pushes
 * live ServiceProgressEvent frames; heartbeat comments keep the connection
 * warm. Native EventSource cannot send the Authorization header the JWT
 * filter requires, hence the fetch-based client.
 *
 * Reconnects with exponential backoff on transient failures; a 503 means
 * progress tracking is not configured on the backend and stops the stream
 * for the session. A 401 triggers one token refresh before retrying.
 */
export const useServiceProgressStream = ({
  serviceCategory,
  serviceFqn,
  onEvent,
}: UseServiceProgressStreamProps): { streamHealth: StreamHealth } => {
  const [streamHealth, setStreamHealth] = useState<StreamHealth>('connecting');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!serviceFqn) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;
    const url = getServiceProgressStreamUrl(serviceCategory, serviceFqn);

    const updateHealth = (health: StreamHealth) => {
      if (!signal.aborted) {
        setStreamHealth(health);
      }
    };

    let attempt = 0;
    let consecutiveUnauthorized = 0;

    const handleOpen = async (response: Response): Promise<void> => {
      if (response.ok) {
        attempt = 0;
        consecutiveUnauthorized = 0;
        updateHealth('live');

        return;
      }
      if (response.status === 503) {
        throw new FatalStreamError('unavailable');
      }
      if (response.status === 401) {
        consecutiveUnauthorized += 1;
        if (consecutiveUnauthorized > 1) {
          throw new FatalStreamError('down');
        }
        await TokenService.getInstance().refreshToken();
      }

      throw new RetriableStreamError();
    };

    const handleMessage = (data: string) => {
      if (!data) {
        return;
      }
      try {
        onEventRef.current(JSON.parse(data) as ServiceProgressEvent);
      } catch {
        // A malformed frame must not kill the stream.
      }
    };

    const connectOnce = async () => {
      const token = await getOidcToken();
      await fetchEventSource(url, {
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        onopen: handleOpen,
        onmessage: (message) => handleMessage(message.data),
        onerror: (error) => {
          // Rethrow so the outer loop owns retry timing and token refresh.
          throw error;
        },
      });
    };

    const streamForever = async () => {
      while (!signal.aborted) {
        try {
          await connectOnce();

          // Resolved: server closed the stream cleanly; reconnect.
          throw new RetriableStreamError();
        } catch (error) {
          if (signal.aborted) {
            return;
          }
          if (error instanceof FatalStreamError) {
            updateHealth(error.health);

            return;
          }
          attempt += 1;
          updateHealth(
            attempt >= MAX_ATTEMPTS_BEFORE_DOWN ? 'down' : 'connecting'
          );
          await abortableSleep(getBackoffDelay(attempt), signal);
        }
      }
    };

    void streamForever();

    return () => controller.abort();
  }, [serviceCategory, serviceFqn]);

  return { streamHealth };
};
