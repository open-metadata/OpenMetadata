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

import { useEffect, useRef, useState } from 'react';
import { TabSpecificField } from '../../../enums/entity.enum';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionPipelineByFqn } from '../../../rest/ingestionPipelineAPI';
import { Agent } from '../AgentsPage.interface';
import { mapPipelineToAgent } from '../utils/agentsDataMapper';

const POLL_MS = 5000;

/**
 * Derives the Agent view-model from the ingestion pipelines and keeps running
 * agents live by polling their latest status every ~5s. Polling is skipped
 * entirely while no agent is running.
 */
export const useMetadataAgents = (
  pipelines: IngestionPipeline[]
): { agents: Agent[] } => {
  const [agents, setAgents] = useState<Agent[]>(() =>
    pipelines.map(mapPipelineToAgent)
  );
  const agentsRef = useRef(agents);
  agentsRef.current = agents;

  useEffect(() => {
    setAgents(pipelines.map(mapPipelineToAgent));
  }, [pipelines]);

  useEffect(() => {
    const pollAgent = async (agent: Agent) => {
      try {
        const fresh = await getIngestionPipelineByFqn(agent.fqn, {
          fields: TabSpecificField.PIPELINE_STATUSES,
        });
        const mapped = mapPipelineToAgent(fresh);
        setAgents((prev) => prev.map((a) => (a.id === mapped.id ? mapped : a)));
      } catch {
        // A transient status-poll failure must not disrupt the list.
      }
    };

    const intervalId = setInterval(() => {
      const runningAgents = agentsRef.current.filter(
        (agent) => agent.status === 'running'
      );
      runningAgents.forEach((agent) => {
        void pollAgent(agent);
      });
    }, POLL_MS);

    return () => clearInterval(intervalId);
  }, []);

  return { agents };
};
