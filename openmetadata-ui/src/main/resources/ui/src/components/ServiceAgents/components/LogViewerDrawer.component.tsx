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

import { ChangeEvent, FC, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IcSearch } from '../AgentIcons';
import { Agent, LogLevel } from '../AgentsPage.interface';
import { useAgentLogs } from '../hooks/useAgentLogs';
import { AGENT_TYPE_ICON } from '../utils/agents.utils';

interface LogViewerDrawerProps {
  agent: Agent;
  onClose: () => void;
}

interface LvLevelMeta {
  color: string;
  label: string;
}

const LV_LEVEL: Record<LogLevel, LvLevelMeta> = {
  info: { color: '#A6F4C5', label: 'INFO' },
  warn: { color: '#FEC84B', label: 'WARN' },
  error: { color: '#FDA29B', label: 'ERROR' },
  debug: { color: '#84CAFF', label: 'DEBUG' },
};

type LevelFilter = 'all' | LogLevel;

const LogViewerDrawer: FC<LogViewerDrawerProps> = ({ agent, onClose }) => {
  const { t } = useTranslation();
  const { lines: all, isLoading, hasMore, loadMore } = useAgentLogs(
    agent.id,
    agent.pipelineType,
    true
  );
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [wrap, setWrap] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);

    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, []);

  const rows = all.filter(
    (l) =>
      (level === 'all' || l.level === level) &&
      (!query || l.text.toLowerCase().includes(query.toLowerCase()))
  );

  const counts = useMemo(
    () =>
      all.reduce<Record<string, number>>((m, l) => {
        m[l.level] = (m[l.level] ?? 0) + 1;

        return m;
      }, {}),
    [all]
  );

  const handleDownload = () => {
    try {
      const txt = all
        .map((l) => `[${l.time}] ${LV_LEVEL[l.level].label} ${l.text}`)
        .join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
      a.download = `${(agent.name ?? 'agent').replace(/\s+/g, '_')}_logs.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (_e) {
      // client-side blob download — silently ignore
    }
  };

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) =>
    setQuery(e.target.value);

  const handleWrapToggle = () => setWrap((w) => !w);

  const Icon = AGENT_TYPE_ICON[agent.type] ?? (() => null);

  const levelFilters: Array<[LevelFilter, string]> = [
    ['all', t('label.all')],
    ['info', t('label.info')],
    ['warn', t('label.warn')],
    ['error', t('label.error')],
  ];

  return (
    <div
      style={{
        backdropFilter: 'blur(3px)',
        background: 'rgba(16,24,40,0.62)',
        display: 'flex',
        inset: 0,
        justifyContent: 'flex-end',
        position: 'fixed',
        zIndex: 110,
      }}
      onClick={onClose}>
      <div
        style={{
          animation: 'rddrawer .22s ease',
          background: '#fff',
          boxShadow: 'var(--shadow-2xl)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxWidth: '94vw',
          width: 760,
        }}
        onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div
          style={{
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 12,
            padding: '16px 20px',
          }}>
          <span
            style={{
              background: 'var(--gray-50)',
              borderRadius: 9,
              color: 'var(--fg-secondary)',
              display: 'grid',
              flexShrink: 0,
              height: 36,
              placeItems: 'center',
              width: 36,
            }}>
            <Icon />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--fg-primary)', font: '700 15px Inter' }}>
              {agent.name} · {t('label.log-plural')}
            </div>
            <div style={{ color: 'var(--fg-muted)', font: '400 12px Inter' }}>
              {t('message.latest-run-lines', { count: all.length })}
            </div>
          </div>
          <button
            style={{
              alignItems: 'center',
              background: '#fff',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-xs)',
              color: 'var(--fg-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              font: '600 12.5px Inter',
              gap: 6,
              padding: '7px 12px',
            }}
            onClick={handleDownload}>
            <svg
              fill="none"
              height="14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.9"
              viewBox="0 0 24 24"
              width="14">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            {t('label.download')}
          </button>
          <button
            style={{
              background: 'none',
              border: 0,
              borderRadius: 8,
              color: 'var(--fg-muted)',
              cursor: 'pointer',
              display: 'grid',
              height: 34,
              placeItems: 'center',
              width: 34,
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

        {/* toolbar */}
        <div
          style={{
            alignItems: 'center',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 10,
            padding: '12px 20px',
          }}>
          <div
            style={{
              alignItems: 'center',
              background: '#fff',
              border: '1px solid var(--gray-300)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-xs)',
              display: 'flex',
              flex: 1,
              gap: 8,
              height: 36,
              padding: '0 12px',
            }}>
            <IcSearch
              height={16}
              style={{ color: 'var(--fg-muted)' }}
              width={16}
            />
            <input
              placeholder={t('label.search-logs')}
              style={{
                background: 'transparent',
                border: 0,
                color: 'var(--fg-primary)',
                flex: 1,
                font: '400 13px Inter',
                outline: 0,
              }}
              value={query}
              onChange={handleQueryChange}
            />
          </div>
          <div
            style={{
              background: 'var(--gray-50)',
              border: '1px solid var(--border-default)',
              borderRadius: 9,
              display: 'flex',
              gap: 4,
              padding: 4,
            }}>
            {levelFilters.map(([id, lbl]) => {
              const isOn = level === id;
              const n = id === 'all' ? all.length : counts[id] ?? 0;

              return (
                <button
                  key={id}
                  style={{
                    alignItems: 'center',
                    background: isOn ? '#fff' : 'transparent',
                    border: isOn
                      ? '1px solid var(--border-default)'
                      : '1px solid transparent',
                    borderRadius: 6,
                    color: isOn ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    font: `${isOn ? 600 : 500} 12px Inter`,
                    gap: 5,
                    padding: '5px 10px',
                  }}
                  onClick={() => setLevel(id)}>
                  {lbl}
                  <span
                    style={{
                      color: 'var(--fg-muted)',
                      font: '600 10.5px Inter',
                    }}>
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            style={{
              background: wrap ? 'var(--blue-50)' : '#fff',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              color: wrap ? 'var(--blue-700)' : 'var(--fg-tertiary)',
              cursor: 'pointer',
              font: '600 12px Inter',
              height: 36,
              padding: '0 11px',
            }}
            title={t('label.toggle-wrap')}
            onClick={handleWrapToggle}>
            {t('label.wrap')}
          </button>
        </div>

        {/* console body */}
        <div
          ref={bodyRef}
          style={{
            background: 'var(--gray-950)',
            flex: 1,
            overflow: 'auto',
            padding: '14px 18px',
          }}>
          {rows.length === 0 ? (
            <div
              style={{
                color: '#5D6B98',
                font: '400 12.5px var(--font-mono)',
              }}>
              {isLoading ? `${t('label.loading')}...` : t('message.no-lines-match')}
            </div>
          ) : (
            rows.map((l, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  font: '400 12px/1.7 var(--font-mono)',
                  gap: 12,
                  whiteSpace: wrap ? 'pre-wrap' : 'pre',
                  wordBreak: wrap ? 'break-word' : 'normal',
                }}>
                <span
                  style={{
                    color: '#5D6B98',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                  {l.time}
                </span>
                <span
                  style={{
                    color: LV_LEVEL[l.level].color,
                    flexShrink: 0,
                    width: 42,
                  }}>
                  {LV_LEVEL[l.level].label}
                </span>
                <span style={{ color: '#CDD5E0', flex: 1 }}>{l.text}</span>
              </div>
            ))
          )}
          {hasMore && rows.length > 0 && (
            <button
              disabled={isLoading}
              style={{
                background: 'transparent',
                border: 0,
                color: '#84CAFF',
                cursor: isLoading ? 'default' : 'pointer',
                font: '600 12px var(--font-mono)',
                marginTop: 12,
                padding: '6px 0',
              }}
              onClick={loadMore}>
              {isLoading ? `${t('label.loading')}...` : t('label.load-more')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogViewerDrawer;
