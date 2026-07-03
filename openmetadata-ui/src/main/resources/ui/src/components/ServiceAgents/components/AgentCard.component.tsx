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

import { Box, Button, Card } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AlertCircleIcon } from '../../../assets/svg/agents/alert-circle.svg';
import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/agents/alert-triangle.svg';
import { ReactComponent as AssetIcon } from '../../../assets/svg/agents/asset.svg';
import { ReactComponent as ClockIcon } from '../../../assets/svg/agents/clock.svg';
import { ReactComponent as LogsIcon } from '../../../assets/svg/agents/logs.svg';
import { ReactComponent as PlayIcon } from '../../../assets/svg/agents/play.svg';
import { ReactComponent as TerminalIcon } from '../../../assets/svg/agents/terminal.svg';
import { Agent } from '../AgentsPage.interface';
import {
  AGENT_ICON_CLASS,
  AGENT_TYPE_ICON,
  fmtEta,
  fmtNum,
  RUN_DOT_CLASS,
  RUN_META,
} from '../utils/agents.utils';
import AgentOverflowMenu from './AgentOverflowMenu.component';
import Metric from './shared/Metric.component';
import ProgressBar from './shared/ProgressBar.component';
import StatusPill from './shared/StatusPill.component';

interface AgentCardProps {
  agent: Agent;
  onAction: (action: string, agent: Agent) => void;
  onLogs: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
  onRunDetails: (agent: Agent, runId?: string) => void;
}

const AgentCard: FC<AgentCardProps> = ({
  agent,
  onAction,
  onLogs,
  onRun,
  onRunDetails,
}) => {
  const { t } = useTranslation();
  const Icon = AGENT_TYPE_ICON[agent.type] ?? AGENT_TYPE_ICON.Metadata;
  const isRunning = agent.status === 'running';
  const isFailed = agent.status === 'failed';
  const isQueued = agent.status === 'queued';
  const isSuccess = agent.status === 'success';
  const unitIcon =
    agent.unit === 'queries' ? (
      <TerminalIcon height={15} width={15} />
    ) : (
      <AssetIcon height={15} width={15} />
    );

  return (
    <Card
      className={`tw:relative tw:overflow-hidden tw:rounded-2xl tw:border tw:bg-primary tw:px-4.5 tw:py-4 tw:shadow-xs ${
        isFailed ? 'tw:border-utility-error-200' : 'tw:border-secondary'
      }`}
      variant="ghost">
      {isRunning && (
        <div className="tw:absolute tw:bottom-0 tw:left-0 tw:top-0 tw:w-1 tw:bg-utility-brand-500" />
      )}
      <Box align="center" className="tw:gap-3.5">
        {/* identity */}
        <Box align="center" className="tw:w-[250px] tw:shrink-0 tw:gap-3">
          <span
            className={`tw:grid tw:size-9.5 tw:shrink-0 tw:place-items-center tw:rounded-xl ${
              isRunning ? 'tw:bg-brand-primary' : 'tw:bg-tertiary'
            } ${AGENT_ICON_CLASS[agent.status]}`}>
            <Icon height={18} width={18} />
          </span>
          <div className="tw:min-w-0">
            <div className="tw:truncate tw:text-sm tw:font-semibold tw:text-primary tw:leading-tight">
              {agent.name}
            </div>
            <div className="tw:mt-px tw:text-xs tw:text-quaternary">
              {agent.type}
            </div>
          </div>
        </Box>

        {/* live status zone */}
        <div className="tw:min-w-0 tw:flex-1">
          <Box
            align="center"
            className={`tw:gap-3.5${isRunning ? ' tw:mb-2' : ''}`}>
            <StatusPill status={agent.status} />
            {isRunning && (
              <Metric
                icon={unitIcon}
                label={`${agent.unit} ${agent.verb}`}
                value={fmtNum(agent.assets)}
              />
            )}
            {isRunning && (
              <Metric
                icon={<ClockIcon height={15} width={15} />}
                value={fmtEta(agent.eta)}
              />
            )}
            {isSuccess && (
              <Metric
                icon={unitIcon}
                label={`${agent.unit} · ${t('label.finished-lowercase')} ${
                  agent.finishedAt
                }`}
                value={fmtNum(agent.assets)}
              />
            )}
            {isQueued && agent.after && (
              <span className="tw:text-sm tw:text-tertiary">
                {t('label.starts-after')}{' '}
                <strong className="tw:font-semibold tw:text-secondary">
                  {agent.after}
                </strong>
              </span>
            )}
            {isFailed && agent.failStep && (
              <Metric
                icon={<AlertCircleIcon height={15} width={15} />}
                label={`· ${fmtNum(agent.assets)} ${agent.unit} ${t(
                  'label.before-error'
                )}`}
                tone="error"
                value={`${t('label.failed-at')} ${agent.failStep}`}
              />
            )}
            <span className="tw:flex-1" />
            {agent.errors > 0 && (
              <Metric
                icon={<AlertCircleIcon height={15} width={15} />}
                label={t('label.error-plural-lowercase')}
                tone="error"
                value={agent.errors}
              />
            )}
            {agent.warnings > 0 && (
              <Metric
                icon={<AlertTriangleIcon height={15} width={15} />}
                label={t('label.warning-plural-lowercase')}
                tone="warn"
                value={agent.warnings}
              />
            )}
          </Box>
          {isRunning && <ProgressBar pct={agent.pct} status={agent.status} />}
          {!isRunning && agent.recentRuns.length > 0 && (
            <Box align="center" className="tw:mt-2 tw:gap-2">
              <span className="tw:text-xs tw:text-quaternary">
                {t('label.recent-runs-sentence')}
              </span>
              <Box className="tw:gap-1">
                {agent.recentRuns.map((run, index) => (
                  <button
                    className={`tw:size-[13px] tw:cursor-pointer tw:rounded tw:border-0 tw:p-0 ${
                      RUN_DOT_CLASS[run.status] ?? 'tw:bg-utility-gray-300'
                    }${index === 0 ? '' : ' tw:opacity-[0.55]'}`}
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
                size="sm"
                onClick={() => onRunDetails(agent)}>
                {t('label.view-run-history')}
              </Button>
            </Box>
          )}
        </div>

        {/* actions */}
        <Box align="center" className="tw:shrink-0 tw:gap-2">
          {isFailed ? (
            <Button
              className="tw:font-semibold"
              color="primary"
              iconLeading={<AlertTriangleIcon height={15} width={15} />}
              size="sm"
              onClick={() => onRunDetails(agent)}>
              {t('label.diagnose')}
            </Button>
          ) : (
            <Button
              className="tw:font-semibold tw:text-brand-tertiary tw:ring-secondary"
              color="secondary"
              iconLeading={<LogsIcon height={15} width={15} />}
              size="sm"
              onClick={() => onLogs(agent)}>
              {t('label.log-plural')}
            </Button>
          )}
          {!isRunning && (
            <Button
              className="tw:font-semibold tw:text-brand-tertiary tw:ring-secondary"
              color="secondary"
              iconLeading={<PlayIcon height={14} width={14} />}
              size="sm"
              onClick={() => onRun(agent)}>
              {t('label.run')}
            </Button>
          )}
          <AgentOverflowMenu
            status={agent.status}
            onAction={(action) => onAction(action, agent)}
          />
        </Box>
      </Box>
    </Card>
  );
};

export default AgentCard;
