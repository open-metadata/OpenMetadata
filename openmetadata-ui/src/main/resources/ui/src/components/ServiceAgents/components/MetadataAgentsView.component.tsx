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

import { Code01 } from '@untitledui/icons';
import { AxiosError } from 'axios';
import { FC, ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DISABLED } from '../../../constants/constants';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { ServicesType } from '../../../interface/service.interface';
import { deleteIngestionPipelineById } from '../../../rest/ingestionPipelineAPI';
import connectionsRouterClassBase from '../../../utils/ConnectionsRouterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { downloadFile } from '../../../utils/Export/ExportUtils';
import {
  getErrorPlaceHolder,
  getLogViewerStatusFromAgentStatus,
} from '../../../utils/IngestionUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import DeleteModal from '../../common/DeleteModal/DeleteModal';
import LogViewerModal from '../../common/LogViewerModal/LogViewerModal.component';
import AddIngestionButton from '../../Settings/Services/Ingestion/AddIngestionButton.component';
import '../agents-preview.css';
import { Agent } from '../AgentsPage.interface';
import { useAgentActions } from '../hooks/useAgentActions';
import { useAgentLogs } from '../hooks/useAgentLogs';
import { useAgentPermissions } from '../hooks/useAgentPermissions';
import AgentGroup from './AgentGroup.component';
import RunHistoryDrawer from './RunHistoryDrawer.component';

interface MetadataAgentsViewProps {
  addAgentSlot?: ReactNode;
  agents: Agent[];
  ingestionPipelineList: IngestionPipeline[];
  serviceCategory: ServiceCategory;
  serviceDetails: ServicesType;
  serviceName: string;
  showAddAgent: boolean;
  onRefresh: () => void;
}

const MetadataAgentsView: FC<MetadataAgentsViewProps> = ({
  addAgentSlot: addAgentSlotProp,
  agents,
  ingestionPipelineList,
  serviceCategory,
  serviceDetails,
  serviceName,
  showAddAgent,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { platform } = useAirflowStatus();
  const { theme } = useApplicationStore();
  const { runAgent, redeployAgent, killAgent, toggleAgent } =
    useAgentActions(onRefresh);
  const agentFqns = useMemo(() => agents.map((agent) => agent.fqn), [agents]);
  const { agentPermissions } = useAgentPermissions(agentFqns);
  const [runsFor, setRunsFor] = useState<{
    agent: Agent;
    runId?: string;
  } | null>(null);
  const [logsFor, setLogsFor] = useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // The `agents` prop updates live (service progress stream), so read the
  // current status of the open agent from it rather than the click-time
  // snapshot — this is what tells polling when the run has finished.
  const liveLogsAgent = useMemo(
    () => agents.find((agent) => agent.id === logsFor?.id) ?? logsFor,
    [agents, logsFor]
  );
  const isLogsAgentActive =
    liveLogsAgent?.status === 'running' || liveLogsAgent?.status === 'queued';

  const { rawText, isLoading: isLogsLoading } = useAgentLogs(
    logsFor?.fqn ?? '',
    logsFor?.pipelineType ?? PipelineType.Metadata,
    Boolean(logsFor),
    isLogsAgentActive
  );

  const onLogs = useCallback((agent: Agent) => setLogsFor(agent), []);
  const onRun = useCallback(
    (agent: Agent) => {
      void runAgent(agent);
    },
    [runAgent]
  );
  const onRunDetails = useCallback(
    (agent: Agent, runId?: string) => setRunsFor({ agent, runId }),
    []
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteIngestionPipelineById(deleteTarget.id);
      onRefresh();
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onRefresh]);

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
            connectionsRouterClassBase.getEditIngestionPath(
              serviceCategory,
              serviceName,
              agent.fqn,
              agent.pipelineType
            )
          );

          break;
        case 'delete':
          setDeleteTarget(agent);

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
    ]
  );

  const handleDownloadLogs = useCallback(() => {
    if (!logsFor) {
      return;
    }
    try {
      downloadFile(rawText, `${logsFor.name.replace(/\s+/g, '_')}_logs.txt`);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [logsFor, rawText]);

  const emptyPlaceholder = useMemo(
    () => getErrorPlaceHolder(agents.length, platform === DISABLED, theme),
    [agents.length, platform, theme]
  );

  const extraMenuItems = useMemo(
    () =>
      serviceUtilClassBase.getExtraIngestionMenuItems(
        serviceCategory,
        serviceName,
        navigate,
        serviceDetails
      ),
    [navigate, serviceCategory, serviceDetails, serviceName]
  );

  const addAgentSlot = useMemo(() => {
    if (addAgentSlotProp) {
      return addAgentSlotProp;
    }

    return showAddAgent ? (
      <AddIngestionButton
        extraMenuItems={extraMenuItems}
        ingestionList={ingestionPipelineList}
        serviceCategory={serviceCategory}
        serviceDetails={serviceDetails}
        serviceName={serviceName}
      />
    ) : undefined;
  }, [
    addAgentSlotProp,
    showAddAgent,
    extraMenuItems,
    ingestionPipelineList,
    serviceCategory,
    serviceDetails,
    serviceName,
  ]);

  return (
    <div data-testid="metadata-agents-view">
      <AgentGroup
        addAgentSlot={addAgentSlot}
        agentPermissions={agentPermissions}
        agents={agents}
        canCreateAgent={showAddAgent}
        dataTestId="metadata-agent-group"
        descKey="message.metadata-agents-description"
        emptyPlaceholder={emptyPlaceholder}
        icon={<Code01 size={18} />}
        titleKey="label.metadata-agent-plural"
        onAction={onAction}
        onLogs={onLogs}
        onRun={onRun}
        onRunDetails={onRunDetails}
      />
      {runsFor && (
        <RunHistoryDrawer
          open
          agent={runsFor.agent}
          initialRunId={runsFor.runId}
          onClose={() => setRunsFor(null)}
          onOpenLogs={(agent) => {
            setLogsFor(agent);
          }}
          onRun={onRun}
        />
      )}
      {logsFor && (
        <LogViewerModal
          open
          lastRun={logsFor.finishedAt}
          loading={isLogsLoading}
          logs={rawText}
          mode={isLogsAgentActive ? 'stream' : 'static'}
          runId={getEntityName(logsFor)}
          status={getLogViewerStatusFromAgentStatus(logsFor.status)}
          title={`${logsFor.name} · ${t('label.log-plural')}`}
          totalLines={rawText.split('\n').length}
          onClose={() => setLogsFor(null)}
          onDownload={handleDownloadLogs}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          open
          entityTitle={t('label.agent')}
          isDeleting={isDeleting}
          message={t('message.delete-entity-permanently', {
            entityType: deleteTarget.name,
          })}
          onCancel={() => setDeleteTarget(null)}
          onDelete={() => void confirmDelete()}
        />
      )}
    </div>
  );
};

export default MetadataAgentsView;
