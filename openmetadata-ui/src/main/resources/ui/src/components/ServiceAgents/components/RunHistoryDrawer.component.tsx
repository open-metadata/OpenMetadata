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

import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RunGlyph, RunIcon } from '../AgentIcons';
import { Agent, AgentRun, RunStatus } from '../AgentsPage.interface';
import { useAgentRuns } from '../hooks/useAgentRuns';
import { AGENT_TYPE_ICON, fmtNum, RUN_META } from '../utils/agents.utils';
import RunStepRow from './RunStepRow.component';

// ---- stat tile ----
interface StatTileProps {
  value: string;
  label: string;
  tone?: 'error' | 'warn' | 'ok';
}

const StatTile: FC<StatTileProps> = ({ value, label, tone }) => {
  let color = 'var(--fg-primary)';

  if (tone === 'error') {
    color = 'var(--error-600)';
  } else if (tone === 'warn') {
    color = 'var(--warning-700)';
  } else if (tone === 'ok') {
    color = 'var(--success-700)';
  }

  return (
    <div
      style={{
        flex: 1,
        padding: '12px 14px',
        background: '#fff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
      }}>
      <div
        style={{
          font: '700 20px Inter',
          letterSpacing: '-0.02em',
          color,
          fontVariantNumeric: 'tabular-nums',
        }}>
        {value}
      </div>
      <div
        style={{
          font: '400 11.5px Inter',
          color: 'var(--fg-tertiary)',
          marginTop: 2,
        }}>
        {label}
      </div>
    </div>
  );
};

// ---- run history rail ----
interface RunHistoryProps {
  runs: AgentRun[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

const RunHistory: FC<RunHistoryProps> = ({ runs, selectedId, onSelect }) => {
  const { t } = useTranslation();

  return (
    <div
      style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {runs.map((r) => {
        const m = RUN_META[r.status];
        const label = t(m.labelKey);
        const isSelected = r.id === selectedId;

        return (
          <button
            key={r.id}
            style={{
              flexShrink: 0,
              width: 132,
              textAlign: 'left',
              cursor: 'pointer',
              padding: '10px 12px',
              borderRadius: 10,
              background: isSelected ? '#fff' : 'var(--gray-25)',
              border: `1px solid ${
                isSelected ? 'var(--border-brand)' : 'var(--border-subtle)'
              }`,
              boxShadow: isSelected
                ? '0 0 0 3px rgba(21,112,239,0.10)'
                : 'none',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={() => onSelect(r.id)}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 3,
                background: m.bar,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
              }}>
              <RunGlyph size={14} status={r.status as RunStatus} />
              <span style={{ font: '600 11.5px Inter', color: m.fg }}>
                {label}
              </span>
            </div>
            <div
              style={{
                font: '500 11px Inter',
                color: 'var(--fg-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
              {r.startedAt.split(' · ')[0]}
            </div>
            <div
              style={{
                font: '400 10.5px Inter',
                color: 'var(--fg-muted)',
                marginTop: 1,
              }}>
              {r.startedAt.split(' · ')[1]} &middot; {r.duration}m
            </div>
          </button>
        );
      })}
    </div>
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(16,24,40,0.62)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}>
      <div
        style={{
          width: 720,
          maxWidth: '94vw',
          height: '100%',
          background: 'var(--bg-subtle)',
          boxShadow: 'var(--shadow-2xl)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'rddrawer .22s ease',
        }}
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '18px 22px',
            background: '#fff',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--gray-50)',
              color: 'var(--fg-secondary)',
            }}>
            <Icon />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 16px Inter', color: 'var(--fg-primary)' }}>
              {agent.name}
            </div>
            <div style={{ font: '400 12px Inter', color: 'var(--fg-muted)' }}>
              {t('label.run-history-and-details')}
            </div>
          </div>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 13px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: '#fff',
              cursor: 'pointer',
              font: '600 13px Inter',
              color: 'var(--fg-secondary)',
              boxShadow: 'var(--shadow-btn-secondary)',
            }}
            onClick={() => onOpenLogs(agent)}>
            <svg
              fill="none"
              height="15"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
              width="15">
              <line x1="8" x2="16" y1="8" y2="8" />
              <line x1="8" x2="16" y1="12" y2="12" />
              <line x1="8" x2="13" y1="16" y2="16" />
            </svg>
            {t('label.raw-logs')}
          </button>
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 13px',
              borderRadius: 8,
              border: '1px solid var(--border-default)',
              background: '#fff',
              cursor: 'pointer',
              font: '600 13px Inter',
              color: 'var(--fg-link)',
              boxShadow: 'var(--shadow-btn-secondary)',
            }}>
            <RunIcon />
            {t('label.run-now')}
          </button>
          <button
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: 0,
              background: 'none',
              cursor: 'pointer',
              color: 'var(--fg-muted)',
              display: 'grid',
              placeItems: 'center',
            }}
            title={t('label.close')}
            onClick={onClose}>
            <svg
              fill="none"
              height="20"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="20">
              <line x1="6" x2="18" y1="6" y2="18" />
              <line x1="18" x2="6" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* scroll body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px 40px',
          }}>
          {/* run history rail */}
          <div
            style={{
              font: '600 11px Inter',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--fg-muted)',
              marginBottom: 10,
            }}>
            {t('label.recent-run-plural')}
          </div>
          <RunHistory runs={runs} selectedId={selId} onSelect={setSelId} />

          {run && m && tot ? (
            <>
              {/* selected run header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  margin: '22px 0 14px',
                }}>
                <RunGlyph size={20} status={run.status} />
            <div style={{ flex: 1 }}>
              <div
                style={{ font: '700 15px Inter', color: 'var(--fg-primary)' }}>
                {runLabel}
              </div>
              <div
                style={{
                  font: '400 12px Inter',
                  color: 'var(--fg-tertiary)',
                }}>
                {run.startedAt} (UTC−07:00) &middot; ran for {run.duration} min
              </div>
            </div>
            <span
              style={{
                font: '600 11.5px Inter',
                color: m.fg,
                background: m.bg,
                border: `1px solid ${m.bd}`,
                borderRadius: 9999,
                padding: '4px 11px',
              }}>
              {runLabel}
            </span>
          </div>

          {/* stat strip */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
            <StatTile
              label={t('label.records-processed')}
              value={fmtNum(tot.records)}
            />
            <StatTile
              label={t('label.filtered')}
              value={fmtNum(tot.filtered)}
            />
            <StatTile label={t('label.updated')} value={fmtNum(tot.updated)} />
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
          </div>

          {/* steps card */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border-default)',
              borderRadius: 14,
              padding: '4px 18px',
              boxShadow: 'var(--shadow-xs)',
            }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 0 10px',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
              <span
                style={{
                  font: '600 13px Inter',
                  color: 'var(--fg-secondary)',
                }}>
                {t('label.steps')}
              </span>
              <span
                style={{ font: '400 12px Inter', color: 'var(--fg-muted)' }}>
                {run.steps.length} {t('label.steps').toLowerCase()}
              </span>
            </div>
            {run.steps.map((s, idx) => (
              <RunStepRow
                isLast={idx === run.steps.length - 1}
                key={idx}
                step={s}
              />
            ))}
          </div>
            </>
          ) : (
            <div
              style={{
                color: 'var(--fg-muted)',
                font: '400 13px Inter',
                padding: '40px 4px',
                textAlign: 'center',
              }}>
              {isLoading
                ? `${t('label.loading')}...`
                : t('message.no-recent-runs')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RunHistoryDrawer;
