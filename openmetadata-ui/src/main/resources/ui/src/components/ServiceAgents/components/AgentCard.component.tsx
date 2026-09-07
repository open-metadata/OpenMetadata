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

import {
  Badge,
  Box,
  Button,
  Card,
  Skeleton,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  AlertTriangle,
  AlignLeft,
  Calendar,
  Clock,
  Database01,
  Terminal,
} from '@untitledui/icons';
import { TFunction } from 'i18next';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PlayIcon } from '../../../assets/svg/agents/play.svg';
import { useScheduleDescriptionTexts } from '../../../hooks/useScheduleDescriptionTexts';
import { Agent, AgentActionPermissions } from '../AgentsPage.interface';
import { useAgentActionAvailability } from '../hooks/useAgentActionAvailability';
import {
  AGENT_ICON_CLASS,
  AGENT_TYPE_ICON,
  canRunAgent,
  fmtNum,
  formatEtaLong,
  getAgentTypeLabelKey,
  getEtaInfo,
  getFinishedSuffix,
  getUnitLabelKey,
  getUnitVerbLabelKey,
  NO_AGENT_PERMISSIONS,
  RUN_DOT_CLASS,
  RUN_META,
  shouldShowLastRunMetric,
} from '../utils/agents.utils';
import AgentOverflowMenu from './AgentOverflowMenu.component';
import Metric from './shared/Metric.component';
import ProgressBar from './shared/ProgressBar.component';
import StatusPill from './shared/StatusPill.component';

interface AgentCardProps {
  agent: Agent;
  allowedActions?: string[];
  permissions?: AgentActionPermissions;
  onAction: (action: string, agent: Agent) => void | Promise<void>;
  onLogs: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
  onRunDetails: (agent: Agent, runId?: string) => void;
}

interface AgentIdentityProps {
  agent: Agent;
  isRunning: boolean;
}

/** Icon, name, type label and (if scheduled) the schedule tooltip. */
const AgentIdentity: FC<AgentIdentityProps> = ({ agent, isRunning }) => {
  const { t } = useTranslation();
  const { descriptionFirstPart, descriptionSecondPart } =
    useScheduleDescriptionTexts(agent.schedule);
  const scheduleText = [descriptionFirstPart, descriptionSecondPart]
    .filter(Boolean)
    .join(', ');
  const showSchedule = Boolean(agent.schedule) && Boolean(descriptionFirstPart);
  const Icon = AGENT_TYPE_ICON[agent.type] ?? AGENT_TYPE_ICON.Metadata;

  return (
    <Box
      align="start"
      className="tw:w-[30%] tw:min-w-[300px] tw:max-w-[520px] tw:shrink-0 tw:gap-3">
      <span
        className={`tw:grid tw:size-9.5 tw:shrink-0 tw:place-items-center tw:rounded-xl ${
          isRunning ? 'tw:bg-brand-primary' : 'tw:bg-tertiary'
        } ${AGENT_ICON_CLASS[agent.status]}`}>
        <Icon height={18} width={18} />
      </span>
      <div className="tw:min-w-0">
        <Tooltip placement="top" title={agent.name}>
          <TooltipTrigger className="tw:block tw:!w-full tw:min-w-0 tw:text-left">
            <span
              className="tw:block tw:truncate tw:text-sm tw:font-semibold tw:text-primary tw:leading-tight"
              data-testid="pipeline-name">
              {agent.name}
            </span>
          </TooltipTrigger>
        </Tooltip>
        <div
          className="tw:mt-px tw:text-xs tw:text-quaternary"
          data-testid="pipeline-type">
          {t(getAgentTypeLabelKey(agent.type))}
        </div>
        {showSchedule && (
          <Tooltip placement="top" title={scheduleText}>
            <TooltipTrigger className="tw:block tw:!w-full tw:min-w-0 tw:text-left">
              <span
                className="tw:mt-px tw:flex tw:min-w-0 tw:items-center tw:gap-1 tw:text-xs tw:font-semibold tw:text-secondary"
                data-testid="agent-schedule">
                <Calendar className="tw:shrink-0" size={12} />
                <span className="tw:truncate">{scheduleText}</span>
              </span>
            </TooltipTrigger>
          </Tooltip>
        )}
      </div>
    </Box>
  );
};

/** Queries icon for query-count agents, asset icon otherwise. */
const getUnitIcon = (unit: string): ReactNode =>
  unit === 'queries' ? <Terminal size={15} /> : <Database01 size={15} />;

interface QueuedStartInfoProps {
  after: string | undefined;
  isQueued: boolean;
}

/** "Starts after <label>" note shown while a queued agent waits on a dependency. */
const QueuedStartInfo: FC<QueuedStartInfoProps> = ({ after, isQueued }) => {
  const { t } = useTranslation();

  if (!isQueued || !after) {
    return null;
  }

  return (
    <span className="tw:text-sm tw:text-tertiary">
      {t('label.starts-after')}{' '}
      <strong className="tw:font-semibold tw:text-secondary">{after}</strong>
    </span>
  );
};

interface RecentRunsSectionProps {
  agent: Agent;
  onRunDetails: (agent: Agent, runId?: string) => void;
}

/** Row of recent-run status dots plus the link to the full run history. */
const RecentRunsSection: FC<RecentRunsSectionProps> = ({
  agent,
  onRunDetails,
}) => {
  const { t } = useTranslation();

  if (agent.recentRuns.length === 0) {
    return null;
  }

  // Runs read oldest-to-newest, so the latest one is the rightmost dot.
  const latestRunIndex = agent.recentRuns.length - 1;

  return (
    <Box align="center" className="tw:mt-2 tw:gap-2">
      <span className="tw:text-xs tw:text-quaternary">
        {t('label.recent-runs-sentence')}
      </span>
      <Box className="tw:gap-1">
        {agent.recentRuns.map((run, index) => (
          <button
            aria-label={t('message.run-status-click-details', {
              status: t(RUN_META[run.status].labelKey),
            })}
            className={`tw:size-[13px] tw:cursor-pointer tw:rounded tw:border-0 tw:p-0 ${
              RUN_DOT_CLASS[run.status] ?? 'tw:bg-utility-gray-300'
            }${index === latestRunIndex ? '' : ' tw:opacity-[0.55]'}`}
            data-run-status={run.status}
            data-testid="agent-run-dot"
            key={run.id}
            title={t('message.run-status-click-details', {
              status: t(RUN_META[run.status].labelKey),
            })}
            type="button"
            onClick={() => onRunDetails(agent, run.id)}
          />
        ))}
      </Box>
      <Button
        className="tw:text-xs tw:font-semibold tw:text-brand-tertiary"
        color="link-color"
        data-testid="view-run-history-button"
        size="sm"
        onClick={() => onRunDetails(agent)}>
        {t('label.view-run-history')}
      </Button>
    </Box>
  );
};

interface AgentLiveStatusZoneProps {
  agent: Agent;
  isNone: boolean;
  isPaused: boolean;
  isQueued: boolean;
  isRunning: boolean;
  isSuccess: boolean;
  onRunDetails: (agent: Agent, runId?: string) => void;
}

/** Status pill/paused badge + live metrics, the progress bar, and recent runs. */
const AgentLiveStatusZone: FC<AgentLiveStatusZoneProps> = ({
  agent,
  isNone,
  isPaused,
  isQueued,
  isRunning,
  isSuccess,
  onRunDetails,
}) => {
  const { t } = useTranslation();
  const showLastRunMetric = shouldShowLastRunMetric(agent, isSuccess, isNone);
  const finishedSuffix = getFinishedSuffix(agent, t);
  const unitLabel = t(getUnitLabelKey(agent.unit));
  const unitVerbLabel = t(getUnitVerbLabelKey(agent.verb));
  const etaLabel = formatEtaLong(getEtaInfo(agent.eta), t);
  const unitIcon = getUnitIcon(agent.unit);

  const assetsMetric = isRunning ? (
    <Metric
      dataTestId="agent-assets-metric"
      icon={unitIcon}
      label={unitVerbLabel}
      value={fmtNum(agent.assets)}
    />
  ) : null;
  const etaMetric = isRunning ? (
    <Metric
      dataTestId="agent-eta-metric"
      icon={<Clock size={15} />}
      value={etaLabel}
    />
  ) : null;
  const lastRunMetric = showLastRunMetric ? (
    <Metric
      icon={unitIcon}
      label={`${unitLabel}${finishedSuffix}`}
      value={fmtNum(agent.assets)}
    />
  ) : null;

  return (
    <div className="tw:min-w-0 tw:flex-1">
      <Box
        align="center"
        className={`tw:gap-3.5${isRunning ? ' tw:mb-2' : ''}`}>
        {isPaused ? (
          <Badge
            className="tw:gap-1.5 tw:font-semibold"
            color="warning"
            data-testid="paused-pipeline-badge"
            size="sm"
            type="pill-color">
            <span className="tw:size-1.5 tw:rounded-full tw:bg-utility-yellow-500" />
            {t('label.paused')}
          </Badge>
        ) : (
          <>
            <StatusPill status={agent.status} />
            {assetsMetric}
            {etaMetric}
            {lastRunMetric}
            <QueuedStartInfo after={agent.after} isQueued={isQueued} />
          </>
        )}
      </Box>
      {isRunning && (
        <div data-testid="agent-progress-bar">
          <ProgressBar pct={agent.pct} status={agent.status} />
        </div>
      )}
      {!isRunning && (
        <RecentRunsSection agent={agent} onRunDetails={onRunDetails} />
      )}
    </div>
  );
};

interface AgentAlertsProps {
  agent: Agent;
  t: TFunction;
}

/**
 * Kept out of the status rows so the block stays vertically centered in the
 * card alongside the actions.
 */
const AgentAlerts: FC<AgentAlertsProps> = ({ agent, t }) => {
  if (agent.errors <= 0 && agent.warnings <= 0) {
    return null;
  }

  return (
    <Box align="center" className="tw:shrink-0 tw:gap-3.5">
      {agent.errors > 0 && (
        <Metric
          dataTestId="agent-errors-metric"
          icon={<AlertCircle size={15} />}
          label={t('label.error-plural-lowercase')}
          tone="error"
          value={agent.errors}
        />
      )}
      {agent.warnings > 0 && (
        <Metric
          dataTestId="agent-warnings-metric"
          icon={<AlertTriangle size={15} />}
          label={t('label.warning-plural-lowercase')}
          tone="warn"
          value={agent.warnings}
        />
      )}
    </Box>
  );
};

interface AgentActionsBlockProps {
  agent: Agent;
  allowedActions?: string[];
  isFailed: boolean;
  isPending: boolean;
  isUnavailable: boolean;
  onAction: (action: string, agent: Agent) => void | Promise<void>;
  onLogs: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
  onRunDetails: (agent: Agent, runId?: string) => void;
  permissions: AgentActionPermissions;
}

/**
 * Diagnose opens the run history, which is read from OpenMetadata's own
 * tables, so it stays available while the pipeline service does not answer.
 */
const AgentActionsBlock: FC<AgentActionsBlockProps> = ({
  agent,
  allowedActions,
  isFailed,
  isPending,
  isUnavailable,
  onAction,
  onLogs,
  onRun,
  onRunDetails,
  permissions,
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" className="tw:shrink-0 tw:gap-2">
      {isFailed && (
        <Button
          className="tw:font-semibold"
          color="primary"
          data-testid="diagnose-button"
          iconLeading={<AlertTriangle size={15} />}
          size="sm"
          onClick={() => onRunDetails(agent)}>
          {t('label.diagnose')}
        </Button>
      )}
      {isPending ? (
        <span
          aria-busy
          aria-label={t('label.loading')}
          aria-live="polite"
          className="tw:flex tw:items-center tw:gap-2"
          data-testid="agent-card-actions-skeleton"
          role="status">
          <Skeleton height={32} variant="rounded" width={88} />
          <Skeleton className="tw:size-8.5" variant="rounded" />
        </span>
      ) : (
        <>
          {!isFailed && (
            <Button
              className="tw:font-semibold tw:text-brand-tertiary tw:after:outline-secondary"
              color="secondary"
              data-testid="logs-button"
              iconLeading={<AlignLeft size={15} />}
              isDisabled={isUnavailable}
              size="sm"
              onClick={() => onLogs(agent)}>
              {t('label.log-plural')}
            </Button>
          )}
          {canRunAgent(agent, permissions) && (
            <Button
              className="tw:font-semibold tw:text-brand-tertiary tw:after:outline-secondary"
              color="secondary"
              data-testid="run-agent-button"
              iconLeading={<PlayIcon height={14} width={14} />}
              isDisabled={isUnavailable}
              size="sm"
              onClick={() => onRun(agent)}>
              {t('label.run')}
            </Button>
          )}
          <AgentOverflowMenu
            allowedActions={allowedActions}
            enabled={agent.enabled}
            isDisabled={isUnavailable}
            permissions={permissions}
            status={agent.status}
            onAction={(action) => onAction(action, agent)}
          />
        </>
      )}
    </Box>
  );
};

const AgentCard: FC<AgentCardProps> = ({
  agent,
  allowedActions,
  permissions = NO_AGENT_PERMISSIONS,
  onAction,
  onLogs,
  onRun,
  onRunDetails,
}) => {
  const { t } = useTranslation();
  const { isPending, isUnavailable } = useAgentActionAvailability();
  const isRunning = agent.status === 'running';
  const isFailed = agent.status === 'failed';
  const isQueued = agent.status === 'queued';
  const isSuccess = agent.status === 'success';
  const isNone = agent.status === 'none';
  // `enabled` defaults to true in the IngestionPipeline schema, so an absent
  // flag means the agent is running and only an explicit false means paused.
  const isPaused = agent.enabled === false;

  return (
    <Card
      className={`tw:relative tw:overflow-hidden tw:rounded-2xl tw:border tw:bg-primary tw:px-4.5 tw:py-4 tw:shadow-xs ${
        isFailed ? 'tw:border-utility-error-200' : 'tw:border-secondary'
      }`}
      data-testid={`agent-card-${agent.fqn}`}
      variant="ghost">
      {isRunning && (
        <div className="tw:absolute tw:bottom-0 tw:left-0 tw:top-0 tw:w-1 tw:bg-utility-brand-500" />
      )}
      <Box align="center" className="tw:gap-3.5">
        <AgentIdentity agent={agent} isRunning={isRunning} />
        <AgentLiveStatusZone
          agent={agent}
          isNone={isNone}
          isPaused={isPaused}
          isQueued={isQueued}
          isRunning={isRunning}
          isSuccess={isSuccess}
          onRunDetails={onRunDetails}
        />
        <AgentAlerts agent={agent} t={t} />
        <AgentActionsBlock
          agent={agent}
          allowedActions={allowedActions}
          isFailed={isFailed}
          isPending={isPending}
          isUnavailable={isUnavailable}
          permissions={permissions}
          onAction={onAction}
          onLogs={onLogs}
          onRun={onRun}
          onRunDetails={onRunDetails}
        />
      </Box>
    </Card>
  );
};

export default AgentCard;
