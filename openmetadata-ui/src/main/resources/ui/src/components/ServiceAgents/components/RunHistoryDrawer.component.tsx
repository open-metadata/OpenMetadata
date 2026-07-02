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

import { Badge, Box, Button, Card } from '@openmetadata/ui-core-components';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/agents/close.svg';
import { ReactComponent as LogsIcon } from '../../../assets/svg/agents/logs.svg';
import { ReactComponent as PlayIcon } from '../../../assets/svg/agents/play.svg';
import { Agent, AgentRun, RunStatus } from '../AgentsPage.interface';
import { useAgentRuns } from '../hooks/useAgentRuns';
import { AGENT_TYPE_ICON, fmtNum, RUN_META } from '../utils/agents.utils';
import RunGlyph from './RunGlyph.component';
import RunStepRow from './RunStepRow.component';

// ---- stat tile ----
interface StatTileProps {
  value: string;
  label: string;
  tone?: 'error' | 'warn' | 'ok';
}

const STAT_TONE_CLASS: Record<string, string> = {
  error: 'tw:text-error-primary',
  warn: 'tw:text-utility-warning-700',
  ok: 'tw:text-utility-success-700',
};

const StatTile: FC<StatTileProps> = ({ value, label, tone }) => (
  <Card
    className="tw:flex-1 tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:px-3.5 tw:py-3"
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

        return (
          <button
            className={`tw:relative tw:w-[132px] tw:shrink-0 tw:cursor-pointer tw:overflow-hidden tw:rounded-xl tw:border tw:px-3 tw:py-2.5 tw:text-left ${
              isSelected
                ? 'tw:border-utility-brand-600 tw:bg-primary tw:ring-4 tw:ring-utility-brand-600/10'
                : 'tw:border-secondary tw:bg-secondary'
            }`}
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
              {r.startedAt.split(' · ')[0]}
            </div>
            <div className="tw:mt-px tw:text-xs tw:leading-tight tw:text-quaternary">
              {r.startedAt.split(' · ')[1]} &middot; {r.duration}m
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
  initialIndex: number;
  onClose: () => void;
  onOpenLogs: (agent: Agent) => void;
}

const RunHistoryDrawer: FC<RunHistoryDrawerProps> = ({
  agent,
  initialIndex,
  onClose,
  onOpenLogs,
}) => {
  const { t } = useTranslation();
  const { runs, isLoading } = useAgentRuns(agent.fqn, true);
  const [selId, setSelId] = useState<string | undefined>();
  const Icon = AGENT_TYPE_ICON[agent.type] ?? (() => null);

  useEffect(() => {
    if (runs.length > 0 && !runs.some((r) => r.id === selId)) {
      const safeIndex = Math.min(initialIndex, runs.length - 1);
      setSelId(runs[safeIndex].id);
    }
  }, [runs, initialIndex, selId]);

  const run = runs.find((r) => r.id === selId) ?? runs[0];
  const m = run ? RUN_META[run.status] : undefined;
  const runLabel = m ? t(m.labelKey) : '';
  const tot = run?.totals;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);

    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <Box
      className="tw:fixed tw:inset-0 tw:z-50 tw:bg-overlay/60 tw:backdrop-blur-xs"
      justify="end"
      onClick={onClose}>
      <Box
        className="agents-drawer tw:h-full tw:w-[720px] tw:max-w-[94vw] tw:bg-secondary tw:shadow-2xl"
        direction="col"
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <Box
          align="center"
          className="tw:gap-3 tw:border-b tw:border-secondary tw:bg-primary tw:px-5.5 tw:py-4.5">
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
            iconLeading={<LogsIcon height={15} width={15} />}
            size="sm"
            onClick={() => onOpenLogs(agent)}>
            {t('label.raw-logs')}
          </Button>
          <Button
            className="tw:font-semibold tw:text-brand-tertiary tw:ring-secondary"
            color="secondary"
            iconLeading={<PlayIcon height={14} width={14} />}
            size="sm">
            {t('label.run-now')}
          </Button>
          <Button
            aria-label={t('label.close')}
            className="tw:text-quaternary"
            color="tertiary"
            iconLeading={<CloseIcon height={20} width={20} />}
            size="sm"
            onClick={onClose}
          />
        </Box>

        {/* scroll body */}
        <div className="tw:flex-1 tw:overflow-y-auto tw:px-5.5 tw:pb-10 tw:pt-5 tw:bg-disabled_subtle">
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
                    {run.startedAt} (UTC−07:00) &middot; ran for {run.duration}{' '}
                    min
                  </div>
                </div>
                <Badge
                  className="tw:font-semibold"
                  color={m.color}
                  size="sm"
                  type="pill-color">
                  {runLabel}
                </Badge>
              </Box>

              {/* stat strip */}
              <Box className="tw:mb-5.5 tw:gap-2.5">
                <StatTile
                  label={t('label.records-processed')}
                  value={fmtNum(tot.records)}
                />
                <StatTile
                  label={t('label.filtered').toLowerCase()}
                  value={fmtNum(tot.filtered)}
                />
                <StatTile
                  label={t('label.updated').toLowerCase()}
                  value={fmtNum(tot.updated)}
                />
                <StatTile
                  label={t('label.warning-plural-lowercase')}
                  tone={tot.warnings ? 'warn' : undefined}
                  value={fmtNum(tot.warnings)}
                />
                <StatTile
                  label={t('label.error-plural-lowercase')}
                  tone={tot.errors ? 'error' : undefined}
                  value={fmtNum(tot.errors)}
                />
              </Box>

              {/* steps card */}
              <Card
                className="tw:rounded-2xl tw:border tw:border-secondary tw:bg-primary tw:px-4.5 tw:py-1 tw:shadow-xs"
                variant="ghost">
                <Box
                  align="center"
                  className="tw:border-b tw:border-secondary tw:pb-2.5 tw:pt-3.5"
                  justify="between">
                  <span className="tw:text-sm tw:font-semibold tw:text-secondary">
                    {t('label.steps')}
                  </span>
                  <span className="tw:text-xs tw:text-quaternary">
                    {run.steps.length} {t('label.steps').toLowerCase()}
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
        </div>
      </Box>
    </Box>
  );
};

export default RunHistoryDrawer;
