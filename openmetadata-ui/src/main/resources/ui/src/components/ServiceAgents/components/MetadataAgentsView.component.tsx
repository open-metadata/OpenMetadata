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
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as CodeIcon } from '../../../assets/svg/agents/code.svg';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ServicesType } from '../../../interface/service.interface';
import { deleteIngestionPipelineById } from '../../../rest/ingestionPipelineAPI';
import { getEditIngestionPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import LogViewerModal from '../../common/LogViewerModal/LogViewerModal.component';
import ConfirmationModal from '../../Modals/ConfirmationModal/ConfirmationModal';
import AddIngestionButton from '../../Settings/Services/Ingestion/AddIngestionButton.component';
import '../agents-preview.css';
import { Agent } from '../AgentsPage.interface';
import { useAgentActions } from '../hooks/useAgentActions';
import { useAgentLogs } from '../hooks/useAgentLogs';
import AgentGroup from './AgentGroup.component';
import DeploymentSummaryCard from './DeploymentSummaryCard.component';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { runAgent, redeployAgent, killAgent, toggleAgent } =
    useAgentActions(onRefresh);
  const [runsFor, setRunsFor] = useState<{
    agent: Agent;
    runId?: string;
  } | null>(null);
  const [logsFor, setLogsFor] = useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { rawText, isLoading: isLogsLoading } = useAgentLogs(
    logsFor?.id ?? '',
    logsFor?.pipelineType ?? PipelineType.Metadata,
    Boolean(logsFor)
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
            getEditIngestionPath(
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
      const blob = new Blob([rawText], { type: 'text/plain' });
      const anchor = document.createElement('a');
      anchor.href = URL.createObjectURL(blob);
      anchor.download = `${logsFor.name.replace(/\s+/g, '_')}_logs.txt`;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [logsFor, rawText]);

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
    <div data-testid="metadata-agents-view">
      <DeploymentSummaryCard agents={agents} />
      <AgentGroup
        addAgentSlot={addAgentSlot}
        agents={agents}
        canCreateAgent={showAddAgent}
        descKey="message.metadata-agents-description"
        icon={<CodeIcon height={18} width={18} />}
        titleKey="label.metadata-agent-plural"
        onAction={onAction}
        onLogs={onLogs}
        onRun={onRun}
        onRunDetails={onRunDetails}
      />
      {runsFor && (
        <RunHistoryDrawer
          agent={runsFor.agent}
          initialRunId={runsFor.runId}
          onClose={() => setRunsFor(null)}
          onOpenLogs={(agent) => {
            setRunsFor(null);
            setLogsFor(agent);
          }}
        />
      )}
      {logsFor && (
        <LogViewerModal
          open
          loading={isLogsLoading}
          logs={rawText}
          title={`${logsFor.name} · ${t('label.log-plural')}`}
          onClose={() => setLogsFor(null)}
          onDownload={handleDownloadLogs}
        />
      )}
      {deleteTarget && (
        <ConfirmationModal
          visible
          bodyText={t('message.are-you-sure-want-to-text', {
            text: `${t('label.delete').toLowerCase()} ${deleteTarget.name}`,
          })}
          cancelText={t('label.cancel')}
          confirmText={t('label.delete')}
          header={t('label.delete-agent')}
          isLoading={isDeleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
};

export default MetadataAgentsView;
