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
import { TabSpecificField } from '../../../enums/entity.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ServiceProgressEvent } from '../../../generated/entity/services/ingestionPipelines/serviceProgressEvent';
import { getIngestionPipelineByFqn } from '../../../rest/ingestionPipelineAPI';
import {
  applyProgressToAgent,
  isTerminalProgressUpdate,
  resetAgentProgress,
} from '../../../utils/AgentsProgressPureUtils';
import { Agent } from '../AgentsPage.interface';
import { mapPipelineToAgent } from '../utils/agentsDataMapper';
import { useServiceProgressStream } from './useServiceProgressStream';

interface LastRunEvent {
  runId: string;
  timestamp: number;
}

/**
 * Derives the Agent view-model from the ingestion pipelines and keeps running
 * agents live via one service-scoped SSE connection
 * (`/services/ingestionPipelines/progress/service/{serviceType}/{serviceFqn}/stream`).
 * The backend replays active-run snapshots on connect and pushes every
 * subsequent ProgressUpdate, so no polling is needed.
 *
 * Progress events carry no error/warning counts, so once the LAST running
 * agent reaches a terminal event, every agent that completed during the
 * session is refetched once to reconcile errors/warnings/finishedAt from
 * pipelineStatuses.
 */
export const useMetadataAgents = (
  pipelines: IngestionPipeline[],
  serviceCategory: ServiceCategory,
  serviceFqn?: string
): { agents: Agent[] } => {
  const [agents, setAgents] = useState<Agent[]>(() =>
    pipelines.map(mapPipelineToAgent)
  );
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  const liveOverridesRef = useRef<Map<string, Agent>>(new Map());
  const lastRunEventRef = useRef<Map<string, LastRunEvent>>(new Map());
  const completedThisSessionRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setAgents(
      pipelines.map((pipeline) => {
        const base = mapPipelineToAgent(pipeline);
        const live = liveOverridesRef.current.get(base.fqn);

        return live?.status === 'running'
          ? {
              ...base,
              status: live.status,
              pct: live.pct,
              assets: live.assets,
              target: live.target,
              eta: live.eta,
            }
          : base;
      })
    );
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

  const syncCompletedAgents = useCallback(() => {
    const completedFqns = Array.from(completedThisSessionRef.current);
    completedThisSessionRef.current.clear();
    completedFqns.forEach((fqn) => {
      void refetchAgent(fqn);
    });
  }, [refetchAgent]);

  const isStaleEvent = useCallback((event: ServiceProgressEvent): boolean => {
    const lastEvent = lastRunEventRef.current.get(event.pipelineFqn);

    return Boolean(
      lastEvent?.runId === event.runId &&
        event.event.timestamp <= lastEvent.timestamp
    );
  }, []);

  const handleProgressEvent = useCallback(
    (event: ServiceProgressEvent) => {
      const known = agentsRef.current.some(
        (agent) => agent.fqn === event.pipelineFqn
      );
      if (!known || isStaleEvent(event)) {
        return;
      }

      const lastEvent = lastRunEventRef.current.get(event.pipelineFqn);
      const isNewRun = lastEvent?.runId !== event.runId;
      lastRunEventRef.current.set(event.pipelineFqn, {
        runId: event.runId,
        timestamp: event.event.timestamp,
      });

      const isTerminal = isTerminalProgressUpdate(event.event.updateType);
      const nextAgents = agentsRef.current.map((agent) => {
        if (agent.fqn !== event.pipelineFqn) {
          return agent;
        }
        const base = isNewRun ? resetAgentProgress(agent) : agent;
        const next = applyProgressToAgent(base, event.event);
        if (isTerminal) {
          liveOverridesRef.current.delete(agent.fqn);
        } else {
          liveOverridesRef.current.set(agent.fqn, next);
        }

        return next;
      });

      agentsRef.current = nextAgents;
      setAgents(nextAgents);

      if (isTerminal) {
        completedThisSessionRef.current.add(event.pipelineFqn);
        const anyRunning = nextAgents.some(
          (agent) => agent.status === 'running'
        );
        if (!anyRunning) {
          syncCompletedAgents();
        }
      }
    },
    [isStaleEvent, syncCompletedAgents]
  );

  useServiceProgressStream({
    serviceCategory,
    serviceFqn,
    onEvent: handleProgressEvent,
  });

  return { agents };
};
