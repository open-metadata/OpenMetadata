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

import { FC, useState } from 'react';
import { IcCode, IcSparkle } from './AgentIcons';
import './agents-preview.css';
import { Agent, AgentTab } from './AgentsPage.interface';
import AgentGroup from './components/AgentGroup.component';
import AgentsPageHeader from './components/AgentsPageHeader.component';
import AgentsTabBar from './components/AgentsTabBar.component';
import DeploymentSummaryCard from './components/DeploymentSummaryCard.component';
import LogViewerDrawer from './components/LogViewerDrawer.component';
import RunHistoryDrawer from './components/RunHistoryDrawer.component';
import { useSimulatedAgents } from './hooks/useSimulatedAgents';
import { SERVICE_INFO } from './mock/agents.mock';

const AgentsPage: FC = () => {
  const { data, runAgent } = useSimulatedAgents();
  const [tab, setTab] = useState<AgentTab>('metadata');
  const [runsFor, setRunsFor] = useState<{
    agent: Agent;
    index: number;
  } | null>(null);
  const [logsFor, setLogsFor] = useState<Agent | null>(null);
  // TODO(real-data): replace with usePermissionProvider().permissions.ingestionPipeline.Create
  const canCreateAgent = true;

  const onRunDetails = (agent: Agent, index: number) =>
    setRunsFor({ agent, index });
  const onLogs = (agent: Agent) => setLogsFor(agent);
  const onRun = (agent: Agent) => runAgent(agent.id);
  const onAction = (action: string, agent: Agent) => {
    if (action === 'run' || action === 'redeploy') {
      runAgent(agent.id);
    }
  };

  const group =
    tab === 'metadata'
      ? {
          agents: data.metadata,
          descKey: 'message.metadata-agents-description',
          icon: <IcCode />,
          titleKey: 'label.metadata-agent-plural',
        }
      : {
          agents: data.ai,
          descKey: 'message.collate-ai-agents-description',
          icon: <IcSparkle />,
          titleKey: 'label.collate-ai-agent-plural',
        };

  return (
    <div className="agents-preview-root tw:flex-1 tw:overflow-y-auto tw:bg-[color:var(--bg-app)]">
      <div className="tw:mx-auto tw:max-w-[1080px] tw:px-9 tw:pb-20 tw:pt-7">
        <AgentsPageHeader service={SERVICE_INFO} />
        <DeploymentSummaryCard agents={[...data.metadata, ...data.ai]} />
        <AgentsTabBar
          counts={{ ai: data.ai.length, metadata: data.metadata.length }}
          tab={tab}
          onChange={setTab}
        />
        <div className="tw:grid tw:gap-5">
          <AgentGroup
            {...group}
            canCreateAgent={canCreateAgent}
            onAction={onAction}
            onLogs={onLogs}
            onRun={onRun}
            onRunDetails={onRunDetails}
          />
        </div>
      </div>
      {runsFor && (
        <RunHistoryDrawer
          agent={runsFor.agent}
          initialIndex={runsFor.index}
          onClose={() => setRunsFor(null)}
          onOpenLogs={(agent) => {
            setRunsFor(null);
            setLogsFor(agent);
          }}
        />
      )}
      {logsFor && (
        <LogViewerDrawer
          agent={logsFor}
          onClose={() => setLogsFor(null)}
        />
      )}
    </div>
  );
};

export default AgentsPage;
