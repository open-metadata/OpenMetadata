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
import './agents-preview.css';
import { Agent, AgentTab } from './AgentsPage.interface';
import { IcCode, IcSparkle } from './AgentIcons';
import AgentsPageHeader from './components/AgentsPageHeader.component';
import AgentGroup from './components/AgentGroup.component';
import AgentsTabBar from './components/AgentsTabBar.component';
import { seedAgents, SERVICE_INFO } from './mock/agents.mock';

const AgentsPage: FC = () => {
  const [data] = useState(seedAgents);
  const [tab, setTab] = useState<AgentTab>('metadata');
  // TODO(real-data): replace with usePermissionProvider().permissions.ingestionPipeline.Create
  const canCreateAgent = true;

  const noop = (_agent: Agent) => undefined;
  const noopAction = (_action: string, _agent: Agent) => undefined;
  const noopDetails = (_agent: Agent, _index: number) => undefined;

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
        <AgentsTabBar
          counts={{ ai: data.ai.length, metadata: data.metadata.length }}
          tab={tab}
          onChange={setTab}
        />
        <div className="tw:grid tw:gap-5">
          <AgentGroup
            {...group}
            canCreateAgent={canCreateAgent}
            onAction={noopAction}
            onLogs={noop}
            onRun={noop}
            onRunDetails={noopDetails}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
