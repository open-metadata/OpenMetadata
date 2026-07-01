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

import { Box } from '@openmetadata/ui-core-components';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RunGlyph } from '../AgentIcons';
import { RunAttention, RunStep } from '../AgentsPage.interface';
import { fmtNum } from '../utils/agents.utils';

interface AttentionCardProps {
  att: RunAttention;
}

const AttentionCard: FC<AttentionCardProps> = ({ att }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const stackLines = att.stackTrace ? att.stackTrace.split('\n') : [];
  const isError = att.severity === 'error';
  const bg = isError ? 'var(--error-50)' : 'var(--warning-50)';
  const bd = isError ? 'var(--error-200)' : 'var(--warning-200)';
  const fg = isError ? 'var(--error-700)' : 'var(--warning-700)';

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(att.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (_e) {
      // clipboard unavailable in non-secure contexts
    }
  };

  const toggleLog = () => setShowLog((s) => !s);

  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 10,
        background: bg,
        border: `1px solid ${bd}`,
        overflow: 'hidden',
      }}>
      <Box
        align="center"
        style={{
          gap: 8,
          padding: '10px 12px',
          borderBottom: `1px solid ${bd}`,
        }}>
        <svg
          fill="none"
          height="15"
          stroke={fg}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.9"
          viewBox="0 0 24 24"
          width="15">
          <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17h.01" />
        </svg>
        <span style={{ font: '600 12.5px Inter', color: 'var(--fg-primary)' }}>
          {att.title}
        </span>
        <span
          style={{
            font: '600 10.5px Inter',
            color: fg,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginLeft: 2,
          }}>
          {isError ? t('label.error') : t('label.warning')}
        </span>
        <span style={{ flex: 1 }} />
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            border: 0,
            background: 'none',
            cursor: 'pointer',
            color: 'var(--fg-tertiary)',
            font: '500 11.5px Inter',
          }}
          onClick={handleCopy}>
          <svg
            fill="none"
            height="13"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
            width="13">
            <rect height="11" rx="2" width="11" x="9" y="9" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
          {copied ? t('label.copied') : t('label.copy')}
        </button>
      </Box>
      <div style={{ padding: '12px' }}>
        <div
          style={{
            font: '400 12.5px/1.6 var(--font-mono)',
            color: 'var(--fg-secondary)',
            wordBreak: 'break-word',
          }}>
          {att.message}
        </div>
        {att.hint && (
          <Box
            style={{
              gap: 7,
              marginTop: 10,
              padding: '9px 11px',
              background: '#fff',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
            }}>
            <svg
              fill="none"
              height="14"
              stroke="var(--blue-600)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.9"
              style={{ flexShrink: 0, marginTop: 1 }}
              viewBox="0 0 24 24"
              width="14">
              <path d="M9.7 17h4.6M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .9 1.6h5.4c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z" />
            </svg>
            <span
              style={{
                font: '400 12px/1.5 Inter',
                color: 'var(--fg-secondary)',
              }}>
              <strong style={{ color: 'var(--fg-primary)', fontWeight: 600 }}>
                {t('label.how-to-fix')} &middot;{' '}
              </strong>
              {att.hint}
            </span>
          </Box>
        )}
        {stackLines.length > 0 && (
          <>
            <button
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                marginTop: 10,
                border: 0,
                background: 'none',
                cursor: 'pointer',
                color: 'var(--fg-link)',
                font: '600 12px Inter',
                padding: 0,
              }}
              onClick={toggleLog}>
              <svg
                fill="none"
                height="13"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                style={{
                  transform: showLog ? 'rotate(90deg)' : 'none',
                  transition: 'transform .15s',
                }}
                viewBox="0 0 24 24"
                width="13">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              {showLog ? t('label.hide-raw-logs') : t('label.show-raw-logs')}
            </button>
            {showLog && (
              <div
                style={{
                  marginTop: 8,
                  background: 'var(--gray-950)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  maxHeight: 160,
                  overflowY: 'auto',
                }}>
                {stackLines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{
                      font: '400 11.5px/1.7 var(--font-mono)',
                      color: line.includes('ERROR') ? '#FDA29B' : '#A6F4C5',
                      whiteSpace: 'pre-wrap',
                    }}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

interface RunStepRowProps {
  step: RunStep;
  isLast: boolean;
}

const RunStepRow: FC<RunStepRowProps> = ({ step, isLast }) => {
  const { t } = useTranslation();
  const secondary: string[] = [];

  if (step.filtered) {
    secondary.push(
      `${fmtNum(step.filtered)} ${t('label.filtered').toLowerCase()}`
    );
  }

  if (step.updated) {
    secondary.push(
      `${fmtNum(step.updated)} ${t('label.updated').toLowerCase()}`
    );
  }

  if (step.warnings) {
    secondary.push(`${step.warnings} ${t('label.warning-plural-lowercase')}`);
  }

  return (
    <div
      style={{
        padding: '14px 0',
        borderBottom: isLast ? 0 : '1px solid var(--border-subtle)',
      }}>
      <Box align="center" style={{ gap: 12 }}>
        <RunGlyph size={18} status={step.status} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '600 13.5px Inter', color: 'var(--fg-primary)' }}>
            {step.name}
          </div>
          {secondary.length > 0 && (
            <div
              style={{
                font: '400 11.5px Inter',
                color: 'var(--fg-muted)',
                marginTop: 1,
              }}>
              {secondary.join(' · ')}
            </div>
          )}
        </div>
        {step.status === 'skipped' ? (
          <span style={{ font: '500 12px Inter', color: 'var(--fg-muted)' }}>
            {t('label.did-not-run')}
          </span>
        ) : (
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                font: '700 15px Inter',
                color: 'var(--fg-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}>
              {fmtNum(step.records)}
            </div>
            <div
              style={{ font: '400 10.5px Inter', color: 'var(--fg-tertiary)' }}>
              {t('label.records')}
            </div>
          </div>
        )}
        {step.errors > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              font: '600 11.5px Inter',
              color: 'var(--error-700)',
              background: 'var(--error-50)',
              border: '1px solid var(--error-200)',
              borderRadius: 9999,
              padding: '3px 9px',
              marginLeft: 4,
            }}>
            {step.errors} {t('label.error-plural-lowercase')}
          </span>
        )}
      </Box>
      {step.attention && <AttentionCard att={step.attention} />}
    </div>
  );
};

export default RunStepRow;
