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
import {
  AssetIcon,
  ClockIcon,
  ErrIcon,
  LogsIcon,
  QueryIcon,
  RunIcon,
  WarnIcon,
} from '../AgentIcons';
import { Agent } from '../AgentsPage.interface';
import {
  agentAccentColor,
  AGENT_TYPE_ICON,
  fmtEta,
  fmtNum,
  RECENT_RUN_STATUSES,
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
  onRunDetails: (agent: Agent, index: number) => void;
}

const RUN_DOT_COLOR: Record<string, string> = {
  failed: 'var(--error-500)',
  partial: 'var(--warning-500)',
  success: 'var(--success-500)',
};

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
  const accent = agentAccentColor(agent.status);
  const recent = RECENT_RUN_STATUSES[agent.status];
  const unitIcon = agent.unit === 'queries' ? <QueryIcon /> : <AssetIcon />;

  return (
    <Card
      className="tw:relative tw:overflow-hidden tw:rounded-[14px] tw:border tw:bg-white tw:px-[18px] tw:py-4 tw:shadow-xs"
      style={{
        borderColor: isFailed ? 'var(--error-200)' : 'var(--border-default)',
      }}
      variant="ghost">
      {isRunning && (
        <div
          className="tw:absolute tw:bottom-0 tw:left-0 tw:top-0 tw:w-[3px]"
          style={{ background: 'var(--blue-500)' }}
        />
      )}
      <Box align="center" className="tw:gap-3.5">
        {/* identity */}
        <Box align="center" className="tw:w-[250px] tw:shrink-0 tw:gap-3">
          <span
            className="tw:grid tw:h-[38px] tw:w-[38px] tw:shrink-0 tw:place-items-center tw:rounded-[10px]"
            style={{
              background: isRunning ? 'var(--blue-50)' : 'var(--gray-50)',
              color: accent,
            }}>
            <Icon />
          </span>
          <div className="tw:min-w-0">
            <div className="tw:truncate tw:text-sm tw:font-semibold tw:text-[color:var(--fg-primary)]">
              {agent.name}
            </div>
            <div className="tw:mt-px tw:text-xs tw:text-[color:var(--fg-muted)]">
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
              <Metric icon={<ClockIcon />} value={fmtEta(agent.eta)} />
            )}
            {isSuccess && (
              <Metric
                icon={unitIcon}
                label={`${agent.unit} · ${t('label.finished')} ${
                  agent.finishedAt
                }`}
                value={fmtNum(agent.assets)}
              />
            )}
            {isQueued && (
              <span className="tw:text-[13px] tw:text-[color:var(--fg-tertiary)]">
                {t('label.starts-after')}{' '}
                <strong className="tw:font-semibold tw:text-[color:var(--fg-secondary)]">
                  {agent.after}
                </strong>
              </span>
            )}
            {isFailed && (
              <Metric
                icon={<ErrIcon />}
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
                icon={<ErrIcon />}
                label={t('label.error-plural-lowercase')}
                tone="error"
                value={agent.errors}
              />
            )}
            {agent.warnings > 0 && (
              <Metric
                icon={<WarnIcon />}
                label={t('label.warning-plural-lowercase')}
                tone="warn"
                value={agent.warnings}
              />
            )}
          </Box>
          {isRunning && <ProgressBar pct={agent.pct} status={agent.status} />}
          {!isRunning && !isQueued && (
            <Box align="center" className="tw:mt-2 tw:gap-2">
              <span className="tw:text-[11px] tw:text-[color:var(--fg-muted)]">
                {t('label.recent-run-plural')}
              </span>
              <Box className="tw:gap-1">
                {recent.map((rs, index) => (
                  <button
                    className="tw:h-[13px] tw:w-[13px] tw:cursor-pointer tw:rounded tw:border-0 tw:p-0"
                    key={`${agent.id}-${index}`}
                    style={{
                      background: RUN_DOT_COLOR[rs] ?? 'var(--gray-300)',
                      opacity: index === 0 ? 1 : 0.55,
                    }}
                    type="button"
                    onClick={() => onRunDetails(agent, index)}
                  />
                ))}
              </Box>
              <button
                className="tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0 tw:text-[11.5px] tw:font-semibold tw:text-[color:var(--fg-link)]"
                type="button"
                onClick={() => onRunDetails(agent, 0)}>
                {t('label.view-run-history')}
              </button>
            </Box>
          )}
        </div>

        {/* actions */}
        <Box align="center" className="tw:shrink-0 tw:gap-2">
          {isFailed ? (
            <Button
              color="secondary"
              iconLeading={WarnIcon}
              size="sm"
              onClick={() => onRunDetails(agent, 0)}>
              {t('label.diagnose')}
            </Button>
          ) : (
            <Button
              color="secondary"
              iconLeading={LogsIcon}
              size="sm"
              onClick={() => onLogs(agent)}>
              {t('label.log-plural')}
            </Button>
          )}
          {!isRunning && (
            <Button
              color="secondary"
              iconLeading={RunIcon}
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
