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

import { useCallback, useEffect, useState } from 'react';
import { Agent, AgentsState } from '../AgentsPage.interface';
import { seedAgents } from '../mock/agents.mock';

const TICK_MS = 1400;

const advance = (agent: Agent): Agent => {
  let next = agent;
  if (agent.status === 'running') {
    const pct = Math.min(100, agent.pct + (2 + Math.random() * 3.5));
    const assets = Math.min(
      agent.target,
      Math.round((agent.target * pct) / 100)
    );
    const eta =
      agent.eta === null
        ? null
        : Math.max(0, agent.eta - (3 + Math.round(Math.random() * 3)));
    next =
      pct >= 100
        ? {
            ...agent,
            status: 'success',
            pct: 100,
            assets: agent.target,
            eta: 0,
            finishedAt: 'just now',
          }
        : { ...agent, pct, assets, eta };
  }

  return next;
};

const releaseQueued = (agent: Agent, all: Agent[]): Agent => {
  let next = agent;
  if (agent.status === 'queued' && agent.after) {
    const predecessor = all.find((x) => x.name === agent.after);
    if (predecessor && predecessor.status === 'success') {
      next = {
        ...agent,
        status: 'running',
        eta: 180 + Math.round(Math.random() * 120),
      };
    }
  }

  return next;
};

export const useSimulatedAgents = (): {
  data: AgentsState;
  runAgent: (id: string) => void;
} => {
  const [data, setData] = useState<AgentsState>(seedAgents);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const stepped: AgentsState = {
          metadata: prev.metadata.map(advance),
          ai: prev.ai.map(advance),
        };
        const flat = [...stepped.metadata, ...stepped.ai];

        return {
          metadata: stepped.metadata.map((a) => releaseQueued(a, flat)),
          ai: stepped.ai.map((a) => releaseQueued(a, flat)),
        };
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  const runAgent = useCallback((agentId: string) => {
    const restart = (a: Agent): Agent =>
      a.id === agentId
        ? {
            ...a,
            status: 'running',
            pct: 0,
            assets: 0,
            eta: 120 + Math.round(Math.random() * 120),
            errors: 0,
            warnings: 0,
            finishedAt: undefined,
            failStep: undefined,
          }
        : a;

    setData((prev) => ({
      metadata: prev.metadata.map(restart),
      ai: prev.ai.map(restart),
    }));
  }, []);

  return { data, runAgent };
};
