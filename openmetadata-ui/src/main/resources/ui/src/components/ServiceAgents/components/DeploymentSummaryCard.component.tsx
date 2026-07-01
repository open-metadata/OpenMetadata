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
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Agent } from '../AgentsPage.interface';
import { fmtEta, fmtNum } from '../utils/agents.utils';

interface DeploymentSummaryCardProps {
  agents: Agent[];
}

interface SummaryStatProps {
  label: string;
  tone?: 'error' | 'ok' | 'neutral';
  value: string;
}

const SummaryStat: FC<SummaryStatProps> = ({
  label,
  tone = 'neutral',
  value,
}) => {
  const valueColor =
    tone === 'error'
      ? 'var(--error-600)'
      : tone === 'ok'
      ? 'var(--success-700)'
      : 'var(--fg-primary)';

  return (
    <div className="tw:text-right">
      <div
        style={{
          color: valueColor,
          fontVariantNumeric: 'tabular-nums',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}>
        {value}
      </div>
      <div
        style={{
          color: 'var(--fg-tertiary)',
          fontSize: 11.5,
          fontWeight: 400,
        }}>
        {label}
      </div>
    </div>
  );
};

const DeploymentSummaryCard: FC<DeploymentSummaryCardProps> = ({ agents }) => {
  const { t } = useTranslation();
  const total = agents.length;
  const running = agents.filter((a) => a.status === 'running').length;
  const done = agents.filter((a) => a.status === 'success').length;
  const failed = agents.filter((a) => a.status === 'failed').length;
  const queued = total - done - running - failed;
  const assets = agents
    .filter((a) => a.unit === 'assets')
    .reduce((sum, a) => sum + a.assets, 0);
  const errors = agents.reduce((sum, a) => sum + a.errors, 0);
  const etas = agents
    .filter((a) => a.status === 'running' && a.eta !== null)
    .map((a) => a.eta as number);
  const maxEta = etas.length ? Math.max(...etas) : 0;
  const overall =
    total > 0
      ? Math.round(agents.reduce((sum, a) => sum + a.pct, 0) / total)
      : 0;
  const allDone = running === 0 && done + failed === total;

  const etaDisplay = maxEta
    ? fmtEta(maxEta).replace('~', '').replace(' left', '')
    : '—';

  const failedSuffix =
    failed > 0 ? ` · ${failed} ${t('label.failed').toLowerCase()}` : '';
  const attentionSuffix =
    failed > 0
      ? ` · ${failed} ${t('label.needs-attention').toLowerCase()}`
      : ` · ${t('message.everything-healthy')}`;

  const subtitle = allDone
    ? t('message.agents-finished-summary', { attentionSuffix, done, total })
    : t('message.agents-deploy-progress', {
        done,
        failedSuffix,
        queued,
        running,
      });

  return (
    <div
      className="tw:mb-5 tw:rounded-2xl tw:border tw:p-5"
      style={{
        background: allDone
          ? 'var(--success-50)'
          : 'linear-gradient(180deg, var(--blue-25), #fff)',
        borderColor: allDone ? 'var(--success-200)' : 'var(--blue-200)',
      }}>
      <Box align="center" className="tw:gap-3.5">
        <span
          className="tw:grid tw:shrink-0 tw:place-items-center tw:rounded-xl"
          style={{
            background: allDone ? 'var(--success-500)' : 'var(--blue-600)',
            color: '#fff',
            height: 44,
            width: 44,
          }}>
          {allDone ? (
            <svg
              fill="none"
              height="22"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.4"
              viewBox="0 0 24 24"
              width="22">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              className="tw:animate-spin"
              height="22"
              viewBox="0 0 24 24"
              width="22">
              <circle
                cx="12"
                cy="12"
                fill="none"
                r="9"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="3"
              />
              <path
                d="M12 3a9 9 0 0 1 9 9"
                fill="none"
                stroke="#fff"
                strokeLinecap="round"
                strokeWidth="3"
              />
            </svg>
          )}
        </span>

        <div className="tw:flex-1">
          <div
            className="tw:font-bold"
            style={{
              color: 'var(--fg-primary)',
              fontSize: 17,
              letterSpacing: '-0.01em',
            }}>
            {allDone
              ? t('message.metadata-agents-up-to-date')
              : t('message.agents-deploying-ingesting')}
          </div>
          <div
            className="tw:mt-0.5"
            style={{
              color: 'var(--fg-tertiary)',
              fontSize: 13,
              fontWeight: 400,
            }}>
            {subtitle}
          </div>
        </div>

        <Box align="center" className="tw:gap-6">
          <SummaryStat
            label={t('label.assets-ingested')}
            value={fmtNum(assets)}
          />
          <SummaryStat
            label={t('label.error-plural').toLowerCase()}
            tone={errors > 0 ? 'error' : 'ok'}
            value={fmtNum(errors)}
          />
          {!allDone && (
            <SummaryStat label={t('label.est-remaining')} value={etaDisplay} />
          )}
        </Box>
      </Box>

      {!allDone && (
        <div className="tw:mt-4">
          <div
            className="tw:h-2 tw:overflow-hidden tw:rounded-full"
            style={{ background: 'var(--gray-100)' }}>
            <div
              className="tw:h-full tw:rounded-full tw:transition-[width] tw:duration-700"
              style={{ background: 'var(--blue-600)', width: `${overall}%` }}
            />
          </div>
          <Box
            className="tw:mt-[7px]"
            justify="between"
            style={{
              color: 'var(--fg-muted)',
              fontSize: 11.5,
              fontWeight: 500,
            }}>
            <span>
              {t('message.percent-complete-all-agents', { percent: overall })}
            </span>
            <span>{t('message.leave-page-ingestion-continues')}</span>
          </Box>
        </div>
      )}
    </div>
  );
};

export default DeploymentSummaryCard;
