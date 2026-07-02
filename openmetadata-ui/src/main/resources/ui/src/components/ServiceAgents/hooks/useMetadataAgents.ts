/*
 *  Copyright 2025 Collate.
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { SOCKET_EVENTS } from '../../../constants/constants';
import { useWebSocketConnector } from '../../../context/WebSocketProvider/WebSocketProvider';
import { TabSpecificField } from '../../../enums/entity.enum';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionPipelineByFqn } from '../../../rest/ingestionPipelineAPI';
import { AgentsLiveInfo } from '../../ServiceInsights/ServiceInsightsTab.interface';
import { Agent } from '../AgentsPage.interface';
import { mapPipelineToAgent } from '../utils/agentsDataMapper';

const POLL_MS = 5000;

interface AgentsLiveStreamPayload {
  serviceName?: string;
  ingestionPipelineStatus?: AgentsLiveInfo[];
}

/**
 * Derives the Agent view-model from the ingestion pipelines and keeps running
 * agents live via two channels:
 *
 * 1. A websocket subscription on `agentsLiveStream` — same push pattern the
 *    Service Insights tab uses for `chartDataStream`. The backend does not
 *    emit this event yet; the handler is placeholder wiring so agents refresh
 *    the moment the backend lands.
 * 2. A ~5s polling fallback that re-fetches only the running agents. Polling
 *    is skipped entirely while no agent is running.
 */
export const useMetadataAgents = (
  pipelines: IngestionPipeline[],
  serviceName?: string
): { agents: Agent[] } => {
  const { socket } = useWebSocketConnector();
  const [agents, setAgents] = useState<Agent[]>(() =>
    pipelines.map(mapPipelineToAgent)
  );
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  useEffect(() => {
    setAgents(pipelines.map(mapPipelineToAgent));
  }, [pipelines]);

  const refetchAgent = useCallback(async (fqn: string) => {
    try {
      const fresh = await getIngestionPipelineByFqn(fqn, {
        fields: TabSpecificField.PIPELINE_STATUSES,
      });
      const mapped = mapPipelineToAgent(fresh);
      setAgents((prev) => prev.map((a) => (a.id === mapped.id ? mapped : a)));
    } catch {
      // A transient status fetch failure must not disrupt the list.
    }
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleLiveUpdate = (rawPayload: string) => {
      try {
        const payload = JSON.parse(rawPayload) as AgentsLiveStreamPayload;
        if (serviceName && payload.serviceName !== serviceName) {
          return;
        }
        payload.ingestionPipelineStatus?.forEach((pipelineStatus) => {
          const agent = agentsRef.current.find(
            (a) =>
              a.id === pipelineStatus.id ||
              a.fqn === pipelineStatus.fullyQualifiedName
          );
          if (agent) {
            void refetchAgent(agent.fqn);
          }
        });
      } catch {
        // Malformed live payloads are ignored; polling remains the fallback.
      }
    };

    socket.on(SOCKET_EVENTS.AGENTS_LIVE_STREAM, handleLiveUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.AGENTS_LIVE_STREAM, handleLiveUpdate);
    };
  }, [socket, serviceName, refetchAgent]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const runningAgents = agentsRef.current.filter(
        (agent) => agent.status === 'running'
      );
      runningAgents.forEach((agent) => {
        void refetchAgent(agent.fqn);
      });
    }, POLL_MS);

    return () => clearInterval(intervalId);
  }, [refetchAgent]);

  return { agents };
};
