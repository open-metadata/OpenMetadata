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
import { getBasePath } from '../../../utils/HistoryUtils';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServicePureUtils';
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

export type { StreamHealth };

interface UseServiceProgressStreamProps {
  serviceCategory: ServiceCategory;
  serviceFqn?: string;
  onEvent: (event: ServiceProgressEvent) => void;
}

export const getServiceProgressStreamUrl = (
  serviceCategory: ServiceCategory,
  serviceFqn: string
): string => {
  const serviceType = getEntityTypeFromServiceCategory(serviceCategory);

  return `${getBasePath()}/api/v1/services/ingestionPipelines/progress/service/${serviceType}/${getEncodedFqn(
    serviceFqn
  )}/stream`;
};

interface StreamSubscriber {
  onEvent: (event: ServiceProgressEvent) => void;
  onHealthChange: (health: StreamHealth) => void;
}

interface StreamConnection {
  controller: AbortController;
  subscribers: Set<StreamSubscriber>;
  health: StreamHealth;
}

/**
 * One physical SSE connection per stream URL, shared by every subscriber to
 * that URL. Multiple views on the same service page (the metadata agents view
 * and the Collate AI agents widget) subscribe to the same URL and receive the
 * same event fan-out instead of each opening a duplicate connection. The
 * connection opens on the first subscriber and is aborted when the last one
 * unsubscribes.
 *
 * A subscriber that joins an already-open connection does not replay the
 * backend's on-connect active-run snapshot (that fired for the first
 * subscriber); it receives every subsequent live frame. Consumers seed their
 * initial state from their own fetch, so this only affects late joiners of an
 * in-flight run, which the next live frame reconciles.
 */
const activeStreams = new Map<string, StreamConnection>();

/**
 * Forgets a connection whose read loop has exited for good. Leaving it in
 * activeStreams would hand every future subscriber a permanently silent
 * stream; dropping it lets the next subscriber reconnect fresh. Guards
 * against deleting a replacement connection registered under the same URL.
 */
const dropTerminatedConnection = (
  url: string,
  connection: StreamConnection
): void => {
  if (activeStreams.get(url) === connection) {
    activeStreams.delete(url);
  }
};

const broadcastHealth = (
  connection: StreamConnection,
  health: StreamHealth
): void => {
  connection.health = health;
  connection.subscribers.forEach((subscriber) =>
    subscriber.onHealthChange(health)
  );
};

const broadcastEvent = (connection: StreamConnection, data: string): void => {
  if (!data) {
    return;
  }
  try {
    const event = JSON.parse(data) as ServiceProgressEvent;
    connection.subscribers.forEach((subscriber) => subscriber.onEvent(event));
  } catch {
    // A malformed frame must not kill the stream.
  }
};

/**
 * Runs the reconnect loop for one shared connection. The backend replays a
 * snapshot of every active run on connect, then pushes live
 * ServiceProgressEvent frames; heartbeat comments keep the connection warm.
 * Native EventSource cannot send the Authorization header the JWT filter
 * requires, hence the fetch-based client.
 *
 * Reconnects with exponential backoff on transient failures; a 503 means
 * progress tracking is not configured on the backend and stops the stream
 * for the session. A 401 triggers one token refresh before retrying.
 */
const runStream = (url: string, connection: StreamConnection): void => {
  const { signal } = connection.controller;

  const updateHealth = (health: StreamHealth) => {
    if (!signal.aborted) {
      broadcastHealth(connection, health);
    }
  };

  const retryState = createStreamRetryState();
  const handleOpen = createStreamOpenHandler(retryState, () =>
    updateHealth('live')
  );

  const connectOnce = async () => {
    const token = await getOidcToken();
    await fetchEventSource(url, {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      onopen: handleOpen,
      onmessage: (message) => broadcastEvent(connection, message.data),
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
          dropTerminatedConnection(url, connection);

          return;
        }
        updateHealth(nextRetryHealth(retryState));
        await abortableSleep(getBackoffDelay(retryState.attempt), signal);
      }
    }
  };

  void streamForever();
};

const subscribeToStream = (
  url: string,
  subscriber: StreamSubscriber
): (() => void) => {
  let connection = activeStreams.get(url);
  if (!connection) {
    connection = {
      controller: new AbortController(),
      subscribers: new Set(),
      health: 'connecting',
    };
    activeStreams.set(url, connection);
    runStream(url, connection);
  }
  connection.subscribers.add(subscriber);
  subscriber.onHealthChange(connection.health);

  return () => {
    const current = activeStreams.get(url);
    if (!current) {
      return;
    }
    current.subscribers.delete(subscriber);
    if (current.subscribers.size === 0) {
      current.controller.abort();
      activeStreams.delete(url);
    }
  };
};

/**
 * Subscribes the caller to the shared per-service SSE progress stream. All
 * callers with the same serviceCategory/serviceFqn share a single underlying
 * connection (see {@link subscribeToStream}).
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

    const url = getServiceProgressStreamUrl(serviceCategory, serviceFqn);
    const subscriber: StreamSubscriber = {
      onEvent: (event) => onEventRef.current(event),
      onHealthChange: setStreamHealth,
    };

    return subscribeToStream(url, subscriber);
  }, [serviceCategory, serviceFqn]);

  return { streamHealth };
};
