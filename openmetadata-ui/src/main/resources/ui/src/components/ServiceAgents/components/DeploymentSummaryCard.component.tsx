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

import { Box, ProgressBarBase } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CheckIcon } from '../../../assets/svg/agents/check.svg';
import { ReactComponent as RunRunningIcon } from '../../../assets/svg/agents/run-running.svg';
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

const STAT_VALUE_CLASS: Record<string, string> = {
  error: 'tw:text-error-primary',
  ok: 'tw:text-success-primary',
  neutral: 'tw:text-primary',
};

const SummaryStat: FC<SummaryStatProps> = ({
  label,
  tone = 'neutral',
  value,
}) => (
  <div className="tw:text-right">
    <div
      className={`tw:text-[22px] tw:font-bold tw:tracking-tight tw:tabular-nums ${STAT_VALUE_CLASS[tone]}`}>
      {value}
    </div>
    <div className="tw:text-xs tw:text-tertiary">{label}</div>
  </div>
);

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

  if (total === 0) {
    return null;
  }

  const etaDisplay = maxEta
    ? fmtEta(maxEta).replace('~', '').replace(' left', '')
    : '—';

  const failedSuffix =
    failed > 0 ? ` · ${failed} ${t('label.failed').toLowerCase()}` : '';
  const attentionSuffix =
    failed > 0
      ? ` · ${failed} ${t('label.need-attention')}`
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
      className={`tw:mb-5 tw:rounded-2xl tw:border tw:p-5 ${
        allDone
          ? 'tw:border-utility-success-200 tw:bg-success-primary'
          : 'tw:border-utility-brand-200 tw:bg-linear-to-b tw:from-brand-25 tw:to-bg-primary tw:dark:from-bg-brand-primary_alt'
      }`}>
      <Box align="center" className="tw:gap-3.5">
        <span
          className={`tw:grid tw:size-11 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:text-fg-white ${
            allDone ? 'tw:bg-utility-success-500' : 'tw:bg-brand-solid'
          }`}>
          {allDone ? (
            <CheckIcon height={22} width={22} />
          ) : (
            <RunRunningIcon
              className="tw:animate-spin tw:text-fg-white"
              height={22}
              width={22}
            />
          )}
        </span>

        <div className="tw:flex-1">
          <div className="tw:text-lg tw:font-bold tw:tracking-tight tw:text-primary">
            {allDone
              ? t('label.deployment-complete')
              : t('message.agents-deploying-ingesting')}
          </div>
          <div className="tw:mt-0.5 tw:text-sm tw:text-tertiary">
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
          <ProgressBarBase
            className="tw:h-2 tw:rounded-full tw:bg-tertiary"
            progressClassName="tw:rounded-full tw:bg-brand-solid tw:duration-700"
            value={overall}
          />
          <Box
            className="tw:mt-2 tw:text-xs tw:font-medium tw:text-quaternary"
            justify="between">
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
