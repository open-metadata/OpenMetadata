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

import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Agent, AgentStatus } from '../AgentsPage.interface';
import { ALL_AGENT_PERMISSIONS, canRunAgent } from './agents.utils';

const baseAgent: Agent = {
  id: 'agent-1',
  fqn: 'service.agent-1',
  pipelineType: PipelineType.Metadata,
  name: 'Metadata Agent',
  type: 'Metadata',
  unit: 'assets',
  verb: 'ingested',
  status: 'success',
  pct: 100,
  eta: 0,
  assets: 100,
  target: 100,
  errors: 0,
  warnings: 0,
  recentRuns: [],
};

const agentWithStatus = (status: AgentStatus): Agent => ({
  ...baseAgent,
  status,
});

describe('canRunAgent', () => {
  it.each<AgentStatus>(['success', 'failed', 'none'])(
    'should allow running a %s agent with trigger permission',
    (status) => {
      expect(canRunAgent(agentWithStatus(status), ALL_AGENT_PERMISSIONS)).toBe(
        true
      );
    }
  );

  it.each<AgentStatus>(['running', 'queued'])(
    'should block running a %s agent so a duplicate run is not queued',
    (status) => {
      expect(canRunAgent(agentWithStatus(status), ALL_AGENT_PERMISSIONS)).toBe(
        false
      );
    }
  );

  it('should block running without trigger permission', () => {
    expect(
      canRunAgent(baseAgent, { trigger: false, edit: true, delete: true })
    ).toBe(false);
  });

  it('should block running while permissions are unresolved', () => {
    expect(canRunAgent(baseAgent)).toBe(false);
  });
});
