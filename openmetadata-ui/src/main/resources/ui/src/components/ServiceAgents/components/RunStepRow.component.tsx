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

import { Badge, Box } from '@openmetadata/ui-core-components';
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AlertTriangleIcon } from '../../../assets/svg/agents/alert-triangle.svg';
import { ReactComponent as BulbIcon } from '../../../assets/svg/agents/bulb.svg';
import { ReactComponent as ChevronRightIcon } from '../../../assets/svg/agents/chevron-right.svg';
import { ReactComponent as CopyIcon } from '../../../assets/svg/agents/copy.svg';
import { RunAttention, RunStep } from '../AgentsPage.interface';
import { fmtNum } from '../utils/agents.utils';
import RunGlyph from './RunGlyph.component';

interface AttentionCardProps {
  att: RunAttention;
}

const AttentionCard: FC<AttentionCardProps> = ({ att }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const stackLines = att.stackTrace ? att.stackTrace.split('\n') : [];
  const isError = att.severity === 'error';
  const surfaceClass = isError
    ? 'tw:bg-error-primary tw:border-utility-error-200'
    : 'tw:bg-warning-primary tw:border-utility-warning-200';
  const dividerClass = isError
    ? 'tw:border-utility-error-200'
    : 'tw:border-utility-warning-200';
  const accentClass = isError
    ? 'tw:text-utility-error-700'
    : 'tw:text-utility-warning-700';
  const accentIconClass = isError
    ? 'tw:text-fg-error-primary'
    : 'tw:text-fg-warning-primary';

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
      className={`tw:mt-3 tw:overflow-hidden tw:rounded-xl tw:border ${surfaceClass}`}>
      <Box
        align="center"
        className={`tw:gap-2 tw:border-b tw:px-3 tw:py-2.5 ${dividerClass}`}>
        <AlertTriangleIcon className={accentIconClass} height={15} width={15} />
        <span className="tw:text-xs tw:font-semibold tw:text-primary">
          {att.title}
        </span>
        <span
          className={`tw:ml-0.5 tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-wide ${accentClass}`}>
          {isError ? t('label.error') : t('label.warning')}
        </span>
        <span className="tw:flex-1" />
        <button
          className="tw:inline-flex tw:cursor-pointer tw:items-center tw:gap-1 tw:border-0 tw:bg-transparent tw:text-xs tw:font-medium tw:text-tertiary"
          type="button"
          onClick={handleCopy}>
          <CopyIcon height={13} width={13} />
          {copied ? t('label.copied') : t('label.copy')}
        </button>
      </Box>
      <div className="tw:p-3">
        <div className="tw:break-words tw:font-mono tw:text-xs tw:leading-relaxed tw:text-secondary">
          {att.message}
        </div>
        {att.hint && (
          <Box className="tw:mt-2.5 tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-primary tw:px-3 tw:py-2">
            <BulbIcon
              className="tw:mt-px tw:shrink-0 tw:text-fg-brand-primary"
              height={14}
              width={14}
            />
            <span className="tw:text-xs tw:leading-normal tw:text-secondary">
              <strong className="tw:font-semibold tw:text-primary">
                {t('label.how-to-fix')} &middot;{' '}
              </strong>
              {att.hint}
            </span>
          </Box>
        )}
        {stackLines.length > 0 && (
          <>
            <button
              className="tw:mt-2.5 tw:inline-flex tw:cursor-pointer tw:items-center tw:gap-1 tw:border-0 tw:bg-transparent tw:p-0 tw:text-xs tw:font-semibold tw:text-brand-tertiary"
              type="button"
              onClick={toggleLog}>
              <ChevronRightIcon
                className={`tw:transition-transform ${
                  showLog ? 'tw:rotate-90' : ''
                }`}
                height={13}
                width={13}
              />
              {showLog ? t('label.hide-raw-logs') : t('label.show-raw-logs')}
            </button>
            {showLog && (
              <div className="tw:mt-2 tw:max-h-40 tw:overflow-y-auto tw:rounded-lg tw:bg-primary-solid tw:px-3 tw:py-2.5">
                {stackLines.map((line, idx) => (
                  <div
                    className={`tw:whitespace-pre-wrap tw:font-mono tw:text-xs tw:leading-relaxed ${
                      line.includes('ERROR')
                        ? 'tw:text-utility-error-300'
                        : 'tw:text-utility-success-200'
                    }`}
                    key={idx}>
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
      className={`tw:py-3.5 ${
        isLast ? '' : 'tw:border-b tw:border-secondary'
      }`}>
      <Box align="center" className="tw:gap-3">
        <RunGlyph size={18} status={step.status} />
        <div className="tw:min-w-0 tw:flex-1">
          <div className="tw:text-sm tw:font-semibold tw:text-primary tw:leading-none">
            {step.name}
          </div>
          {secondary.length > 0 && (
            <div className="tw:mt-px tw:text-xs tw:text-quaternary">
              {secondary.join(' · ')}
            </div>
          )}
        </div>
        {step.status === 'skipped' ? (
          <span className="tw:text-xs tw:font-medium tw:text-quaternary">
            {t('label.did-not-run')}
          </span>
        ) : (
          <div className="tw:text-right">
            <div className="tw:text-md tw:font-bold tw:tabular-nums tw:text-primary tw:leading-none">
              {fmtNum(step.records)}
            </div>
            <div className="tw:text-xs tw:text-tertiary">
              {t('label.records')}
            </div>
          </div>
        )}
        {step.errors > 0 && (
          <Badge
            className="tw:ml-1 tw:font-semibold"
            color="error"
            size="sm"
            type="pill-color">
            {step.errors} {t('label.error-plural-lowercase')}
          </Badge>
        )}
      </Box>
      {step.attention && <AttentionCard att={step.attention} />}
    </div>
  );
};

export default RunStepRow;
