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
  SlideoutMenu,
} from '@openmetadata/ui-core-components';
import { FC, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LogsIcon } from '../../../assets/svg/agents/logs.svg';
import { ReactComponent as PlayIcon } from '../../../assets/svg/agents/play.svg';
import { getUtcOffsetLabel } from '../../../utils/date-time/DateTimeUtils';
import { Agent, AgentRun, RunStatus } from '../AgentsPage.interface';
import { useAgentRuns } from '../hooks/useAgentRuns';
import { AGENT_TYPE_ICON, fmtNum, RUN_META } from '../utils/agents.utils';
import RunGlyph from './RunGlyph.component';
import RunStepRow from './RunStepRow.component';

// ---- stat tile ----
interface StatTileProps {
  value: string;
  label: string;
  testId?: string;
  tone?: 'error' | 'warn' | 'ok';
}

const STAT_TONE_CLASS: Record<string, string> = {
  error: 'tw:text-error-primary',
  warn: 'tw:text-utility-warning-700',
  ok: 'tw:text-utility-success-700',
};

const StatTile: FC<StatTileProps> = ({ value, label, testId, tone }) => (
  <Card
    className="tw:flex-1 tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:px-3.5 tw:py-3"
    data-testid={testId}
    variant="ghost">
    <div
      className={`tw:text-xl tw:font-bold tw:leading-tight tw:tracking-tight tw:tabular-nums ${
        (tone && STAT_TONE_CLASS[tone]) ?? 'tw:text-primary'
      }`}>
      {value}
    </div>
    <div className="tw:mt-0.5 tw:text-xs tw:leading-tight tw:text-tertiary">
      {label}
    </div>
  </Card>
);

// ---- run history rail ----
interface RunHistoryProps {
  runs: AgentRun[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

const RunHistory: FC<RunHistoryProps> = ({ runs, selectedId, onSelect }) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:gap-2 tw:overflow-x-auto tw:pb-1">
      {runs.map((r) => {
        const m = RUN_META[r.status];
        const label = t(m.labelKey);
        const isSelected = r.id === selectedId;
        const [startDate, startTime] = r.startedAt.split(' · ');

        return (
          <button
            className={`tw:relative tw:w-[132px] tw:shrink-0 tw:cursor-pointer tw:overflow-hidden tw:rounded-xl tw:border tw:px-3 tw:py-2.5 tw:text-left ${
              isSelected
                ? 'tw:border-utility-brand-600 tw:bg-primary tw:ring-4 tw:ring-utility-brand-600/10'
                : 'tw:border-secondary tw:bg-secondary'
            }`}
            data-testid="run-history-item"
            key={r.id}
            type="button"
            onClick={() => onSelect(r.id)}>
            <div
              className={`tw:absolute tw:bottom-0 tw:left-0 tw:top-0 tw:w-1 ${m.barClassName}`}
            />
            <Box align="center" className="tw:mb-1.5 tw:gap-1.5">
              <RunGlyph size={14} status={r.status as RunStatus} />
              <span
                className={`tw:whitespace-nowrap tw:text-xs tw:font-semibold tw:leading-none ${m.textClassName}`}>
                {label}
              </span>
            </Box>
            <div className="tw:truncate tw:text-xs tw:font-medium tw:leading-tight tw:text-secondary">
              {startDate}
            </div>
            <div className="tw:mt-px tw:text-xs tw:leading-tight tw:text-quaternary">
              {startTime ? `${startTime} · ` : ''}
              {t('label.duration-in-minute', { duration: r.duration })}
            </div>
          </button>
        );
      })}
    </Box>
  );
};

// ---- drawer ----
interface RunHistoryDrawerProps {
  agent: Agent;
  open: boolean;
  initialRunId?: string;
  onClose: () => void;
  onOpenLogs: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
}

const RunHistoryDrawer: FC<RunHistoryDrawerProps> = ({
  agent,
  open,
  initialRunId,
  onClose,
  onOpenLogs,
  onRun,
}) => {
  const { t } = useTranslation();
  const { runs, isLoading } = useAgentRuns(agent.fqn, true);
  const [selId, setSelId] = useState<string | undefined>();
  const Icon = AGENT_TYPE_ICON[agent.type] ?? (() => null);

  useEffect(() => {
    if (runs.length > 0 && !runs.some((r) => r.id === selId)) {
      const initialRun = initialRunId
        ? runs.find((r) => r.id === initialRunId)
        : undefined;
      setSelId((initialRun ?? runs[0]).id);
    }
  }, [runs, initialRunId, selId]);

  const run = runs.find((r) => r.id === selId) ?? runs[0];
  const m = run ? RUN_META[run.status] : undefined;
  const runLabel = m ? t(m.labelKey) : '';
  const tot = run?.totals;

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <SlideoutMenu
      isDismissable
      className="tw:z-50"
      data-testid="run-history-drawer"
      dialogClassName="tw:gap-0"
      isOpen={open}
      width={720}
      onOpenChange={handleOpenChange}>
      <SlideoutMenu.Header
        className="tw:gap-3 tw:border-b tw:border-secondary tw:bg-primary tw:px-5.5 tw:py-4.5"
        onClose={onClose}>
        <Box align="center" className="tw:flex-1 tw:gap-3 tw:mr-8">
          <span className="tw:grid tw:size-9.5 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:bg-tertiary tw:text-fg-secondary">
            <Icon height={18} width={18} />
          </span>
          <div className="tw:flex-1">
            <div className="tw:text-md tw:font-bold tw:text-primary tw:leading-none">
              {agent.name}
            </div>
            <div className="tw:text-xs tw:text-quaternary">
              {t('label.run-history-and-details')}
            </div>
          </div>
          <Button
            className="tw:font-semibold tw:ring-secondary"
            color="secondary"
            data-testid="raw-logs-button"
            iconLeading={<LogsIcon height={15} width={15} />}
            size="sm"
            onClick={() => onOpenLogs(agent)}>
            {t('label.raw-logs')}
          </Button>
          <Button
            className="tw:font-semibold tw:text-brand-tertiary tw:ring-secondary"
            color="secondary"
            data-testid="drawer-run-now-button"
            iconLeading={<PlayIcon height={14} width={14} />}
            size="sm"
            onClick={() => onRun(agent)}>
            {t('label.run-now')}
          </Button>
        </Box>
      </SlideoutMenu.Header>

      <SlideoutMenu.Content className="tw:overflow-y-auto tw:px-5.5 tw:pb-10 tw:pt-5 tw:bg-disabled_subtle tw:gap-0">
        {/* run history rail */}
        <div className="tw:mb-2.5 tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wider tw:text-quaternary">
          {t('label.recent-run-plural')}
        </div>
        <RunHistory runs={runs} selectedId={selId} onSelect={setSelId} />

        {run && m && tot ? (
          <>
            {/* selected run header */}
            <Box align="center" className="tw:mb-3.5 tw:mt-5.5 tw:gap-2.5">
              <RunGlyph size={20} status={run.status} />
              <div className="tw:flex-1">
                <div className="tw:text-md tw:font-bold tw:text-primary tw:leading-none">
                  {runLabel}
                </div>
                <div className="tw:text-xs tw:text-tertiary">
                  {run.startedAt} ({getUtcOffsetLabel()}) &middot;{' '}
                  {t('message.ran-for-duration', { duration: run.duration })}
                </div>
              </div>
              <Badge
                className="tw:font-semibold"
                color={m.color}
                data-testid="selected-run-status"
                size="sm"
                type="pill-color">
                {runLabel}
              </Badge>
            </Box>

            {/* stat strip */}
            <Box className="tw:mb-5.5 tw:gap-2.5">
              <StatTile
                label={t('label.processed')}
                testId="run-stat-processed"
                value={fmtNum(tot.records)}
              />
              <StatTile
                label={t('label.filtered-lowercase')}
                testId="run-stat-filtered"
                value={fmtNum(tot.filtered)}
              />
              <StatTile
                label={t('label.updated-lowercase')}
                testId="run-stat-updated"
                value={fmtNum(tot.updated)}
              />
              <StatTile
                label={t('label.warning-plural-lowercase')}
                testId="run-stat-warnings"
                tone={tot.warnings ? 'warn' : undefined}
                value={fmtNum(tot.warnings)}
              />
              <StatTile
                label={t('label.error-plural-lowercase')}
                testId="run-stat-errors"
                tone={tot.errors ? 'error' : undefined}
                value={fmtNum(tot.errors)}
              />
            </Box>

            {/* steps card */}
            <Card
              className="tw:rounded-2xl tw:border tw:border-secondary tw:bg-primary tw:px-4.5 tw:py-1 tw:shadow-xs"
              data-testid="run-steps-card"
              variant="ghost">
              <Box
                align="center"
                className="tw:border-b tw:border-secondary tw:pb-2.5 tw:pt-3.5"
                justify="between">
                <span className="tw:text-sm tw:font-semibold tw:text-secondary">
                  {t('label.steps')}
                </span>
                <span className="tw:text-xs tw:text-quaternary">
                  {run.steps.length} {t('label.steps-lowercase')}
                </span>
              </Box>
              {run.steps.map((s, idx) => (
                <RunStepRow
                  isLast={idx === run.steps.length - 1}
                  key={idx}
                  step={s}
                />
              ))}
            </Card>
          </>
        ) : (
          <div className="tw:px-1 tw:py-10 tw:text-center tw:text-sm tw:text-quaternary">
            {isLoading
              ? `${t('label.loading')}...`
              : t('message.no-recent-runs')}
          </div>
        )}
      </SlideoutMenu.Content>
    </SlideoutMenu>
  );
};

export default RunHistoryDrawer;
