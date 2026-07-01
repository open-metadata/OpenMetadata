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

import { AxiosError } from 'axios';
import { FC, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ServiceCategory } from '../../../enums/service.enum';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ServicesType } from '../../../interface/service.interface';
import { deleteIngestionPipelineById } from '../../../rest/ingestionPipelineAPI';
import { getEditIngestionPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import AddIngestionButton from '../../Settings/Services/Ingestion/AddIngestionButton.component';
import { IcCode } from '../AgentIcons';
import '../agents-preview.css';
import { Agent } from '../AgentsPage.interface';
import { useAgentActions } from '../hooks/useAgentActions';
import AgentGroup from './AgentGroup.component';
import DeploymentSummaryCard from './DeploymentSummaryCard.component';
import LogViewerDrawer from './LogViewerDrawer.component';
import RunHistoryDrawer from './RunHistoryDrawer.component';

interface MetadataAgentsViewProps {
  agents: Agent[];
  ingestionPipelineList: IngestionPipeline[];
  serviceCategory: ServiceCategory;
  serviceDetails: ServicesType;
  serviceName: string;
  showAddAgent: boolean;
  onRefresh: () => void;
}

const MetadataAgentsView: FC<MetadataAgentsViewProps> = ({
  agents,
  ingestionPipelineList,
  serviceCategory,
  serviceDetails,
  serviceName,
  showAddAgent,
  onRefresh,
}) => {
  const navigate = useNavigate();
  const { runAgent, redeployAgent, killAgent, toggleAgent } =
    useAgentActions(onRefresh);
  const [runsFor, setRunsFor] = useState<{
    agent: Agent;
    index: number;
  } | null>(null);
  const [logsFor, setLogsFor] = useState<Agent | null>(null);

  const onLogs = useCallback((agent: Agent) => setLogsFor(agent), []);
  const onRun = useCallback(
    (agent: Agent) => {
      void runAgent(agent);
    },
    [runAgent]
  );
  const onRunDetails = useCallback(
    (agent: Agent, index: number) => setRunsFor({ agent, index }),
    []
  );

  const deleteAgent = useCallback(
    async (agent: Agent) => {
      try {
        await deleteIngestionPipelineById(agent.id);
        onRefresh();
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [onRefresh]
  );

  const onAction = useCallback(
    (action: string, agent: Agent) => {
      switch (action) {
        case 'run':
          void runAgent(agent);

          break;
        case 'redeploy':
          void redeployAgent(agent);

          break;
        case 'kill':
          void killAgent(agent);

          break;
        case 'pause':
          void toggleAgent(agent);

          break;
        case 'edit':
          navigate(
            getEditIngestionPath(
              serviceCategory,
              serviceName,
              agent.fqn,
              agent.pipelineType
            )
          );

          break;
        case 'delete':
          void deleteAgent(agent);

          break;
        default:
          break;
      }
    },
    [
      runAgent,
      redeployAgent,
      killAgent,
      toggleAgent,
      navigate,
      serviceCategory,
      serviceName,
      deleteAgent,
    ]
  );

  const addAgentSlot = useMemo(
    () =>
      showAddAgent ? (
        <AddIngestionButton
          ingestionList={ingestionPipelineList}
          serviceCategory={serviceCategory}
          serviceDetails={serviceDetails}
          serviceName={serviceName}
        />
      ) : undefined,
    [
      showAddAgent,
      ingestionPipelineList,
      serviceCategory,
      serviceDetails,
      serviceName,
    ]
  );

  return (
    <div className="agents-preview-root">
      <DeploymentSummaryCard agents={agents} />
      <AgentGroup
        addAgentSlot={addAgentSlot}
        agents={agents}
        canCreateAgent={showAddAgent}
        descKey="message.metadata-agents-description"
        icon={<IcCode />}
        titleKey="label.metadata-agent-plural"
        onAction={onAction}
        onLogs={onLogs}
        onRun={onRun}
        onRunDetails={onRunDetails}
      />
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
        <LogViewerDrawer agent={logsFor} onClose={() => setLogsFor(null)} />
      )}
    </div>
  );
};

export default MetadataAgentsView;
