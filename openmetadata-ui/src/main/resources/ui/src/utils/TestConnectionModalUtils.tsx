/*
 *  Copyright 2023 Collate.
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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronRight,
  Copy01,
  Lightbulb03,
  RefreshCcw01,
} from '@untitledui/icons';
import classNames from 'classnames';
import { isEmpty, startCase } from 'lodash';
import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { ReactComponent as IcCheckCircle } from '../assets/svg/ic-check-circle.svg';
import { ReactComponent as IcTcFail } from '../assets/svg/ic-tc-fail.svg';
import { ReactComponent as IcTcQueued } from '../assets/svg/ic-tc-queued.svg';
import { ReactComponent as IcTcSkip } from '../assets/svg/ic-tc-skip.svg';
import { ReactComponent as IcTcWarn } from '../assets/svg/ic-tc-warn.svg';
import Loader from '../components/common/Loader/Loader';
import {
  ConnectionStepState,
  TranslateFn,
} from '../components/common/TestConnection/TestConnectionModal/TestConnectionModal.interface';
import { TEST_CONNECTION_WARNING_MESSAGE } from '../constants/Services.constant';
import {
  Status,
  TestConnectionStepResult,
} from '../generated/entity/automations/workflow';
import { TestConnectionStep } from '../generated/entity/services/connections/testConnectionDefinition';

const STEP_LABEL_KEYS: Record<string, string> = {
  CheckAccess: 'message.test-connection-step-check-access',
  GetDatabases: 'message.test-connection-step-get-databases',
  GetSchemas: 'message.test-connection-step-get-schemas',
  GetTables: 'message.test-connection-step-get-tables',
  GetViews: 'message.test-connection-step-get-views',
  GetQueries: 'message.test-connection-step-get-queries',
  GetTags: 'message.test-connection-step-get-tags',
  GetSampleData: 'message.test-connection-step-get-sample-data',
  GetStoredProcedures: 'message.test-connection-step-get-stored-procedures',
};

export function getStepLabel(t: TranslateFn, step: TestConnectionStep) {
  const labelKey = STEP_LABEL_KEYS[step.name];

  return labelKey ? t(labelKey) : startCase(step.name);
}

export function getStepState(
  step: TestConnectionStep,
  result: TestConnectionStepResult | undefined,
  connectionFailed: boolean,
  gateStepName?: string
): ConnectionStepState {
  let state: ConnectionStepState = 'queued';

  if (result) {
    if (result.status === Status.Running) {
      state = 'running';
    } else if (result.status === Status.Skipped) {
      state = 'skipped';
    } else if (result.passed) {
      state = 'passed';
    } else if (step.mandatory) {
      state = 'failed';
    } else {
      state = 'warning';
    }
  } else if (connectionFailed && gateStepName !== step.name) {
    state = 'skipped';
  }

  return state;
}

export function getStepStatusLabel(t: TranslateFn, state: ConnectionStepState) {
  let label = t('label.queued');

  if (state === 'running') {
    label = t('label.running-ellipsis');
  } else if (state === 'passed') {
    label = t('label.passed');
  } else if (state === 'failed') {
    label = t('label.failed');
  } else if (state === 'warning') {
    label = t('label.warning');
  } else if (state === 'skipped') {
    label = t('label.did-not-run');
  }

  return label;
}

export function getConnectionStatusIcon(
  isFailed: boolean,
  isSuccessful: boolean
) {
  let icon = null;

  if (isSuccessful) {
    icon = (
      <IcCheckCircle
        className="tw:shrink-0 tw:text-fg-success-secondary"
        height={18}
        width={18}
      />
    );
  } else if (isFailed) {
    icon = (
      <IcTcFail
        className="tw:shrink-0 tw:text-fg-error-primary"
        height={18}
        width={18}
      />
    );
  }

  return icon;
}

export function getConnectionTimeoutMessage(
  t: TranslateFn,
  serviceType?: string,
  hostIp?: string
) {
  const baseMessage = t('message.test-connection-taking-too-long.default', {
    service_type: serviceType,
  });

  let message = baseMessage;

  if (hostIp) {
    message = `${baseMessage}${t(
      'message.test-connection-taking-too-long.withIp',
      {
        ip: hostIp,
      }
    )}`;
  }

  return message;
}

export function getConnectionStatusText({
  isTestingConnection,
  isWarning,
  isSuccessful,
  isFailed,
  gateResult,
  passedCount,
  totalCount,
  t,
}: {
  isTestingConnection: boolean;
  isWarning: boolean;
  isSuccessful: boolean;
  isFailed: boolean;
  gateResult: TestConnectionStepResult | undefined;
  passedCount: number;
  totalCount: number;
  t: TranslateFn;
}) {
  let text = '';

  if (isTestingConnection) {
    if (gateResult?.passed) {
      text = t('message.test-connection-running-checks', {
        passed: passedCount,
        total: totalCount,
      });
    } else {
      text = t('message.establishing-connection-ellipsis');
    }
  } else if (isWarning) {
    text = t(TEST_CONNECTION_WARNING_MESSAGE);
  } else if (isSuccessful) {
    text = t('message.test-connection-verified-count', {
      passed: passedCount,
      total: totalCount,
    });
  } else if (isFailed) {
    if (gateResult?.passed) {
      text = t('message.connection-required-check-failed');
    } else {
      text = t('message.connection-gate-failed');
    }
  }

  return text;
}

export function getGateDescription(
  t: TranslateFn,
  gateResult: TestConnectionStepResult | undefined,
  gateStep: TestConnectionStep
) {
  let description = gateStep.description;

  if (gateResult?.message) {
    description = gateResult.message;
  } else if (gateResult?.passed) {
    description = t('message.test-connection-gate-success');
  }

  return description;
}

export function getGateState(
  gateResult: TestConnectionStepResult | undefined
): ConnectionStepState {
  let state: ConnectionStepState = 'queued';

  if (gateResult?.passed) {
    state = 'passed';
  } else if (gateResult) {
    state = 'failed';
  }

  return state;
}

export function getConnectionStepIcon(state: ConnectionStepState) {
  if (state === 'running') {
    return (
      <span className="tw:flex tw:items-center" data-testid="running-badge">
        <Loader size="small" />
      </span>
    );
  }

  if (state === 'passed') {
    return (
      <span className="tw:flex tw:items-center" data-testid="success-badge">
        <IcCheckCircle
          className="tw:text-fg-success-secondary"
          height={16}
          width={16}
        />
      </span>
    );
  }

  if (state === 'failed') {
    return (
      <span className="tw:flex tw:items-center" data-testid="fail-badge">
        <IcTcFail className="tw:text-fg-error-primary" height={16} width={16} />
      </span>
    );
  }

  if (state === 'warning') {
    return (
      <span className="tw:flex tw:items-center" data-testid="warning-badge">
        <IcTcWarn
          className="tw:text-fg-warning-secondary"
          height={16}
          width={16}
        />
      </span>
    );
  }

  if (state === 'skipped') {
    return (
      <IcTcSkip className="tw:text-utility-gray-300" height={16} width={16} />
    );
  }

  return (
    <IcTcQueued className="tw:text-utility-gray-300" height={16} width={16} />
  );
}

function renderColoredLines(
  text: string,
  colorClass: string,
  keyPrefix = ''
): JSX.Element[] {
  return text.split('\n').map((line, index) => (
    <span className={`tw:block ${colorClass}`} key={`${keyPrefix}${index}`}>
      {line || ' '}
    </span>
  ));
}

export function ConnectionStatusBanner(
  props: Readonly<{
    gateResult: TestConnectionStepResult | undefined;
    isFailed: boolean;
    isSuccessful: boolean;
    isTestingConnection: boolean;
    isWarning: boolean;
    passedCount: number;
    progressPercent: number;
    t: TranslateFn;
    totalCount: number;
  }>
) {
  const {
    gateResult,
    isFailed,
    isSuccessful,
    isTestingConnection,
    isWarning,
    passedCount,
    progressPercent,
    t,
    totalCount,
  } = props;

  const statusText = getConnectionStatusText({
    isTestingConnection,
    isWarning,
    isSuccessful,
    isFailed,
    gateResult,
    passedCount,
    totalCount,
    t,
  });

  if (isSuccessful) {
    return (
      <div className="tw:flex tw:items-center tw:gap-2.5 tw:rounded-xl tw:border tw:border-utility-success-200 tw:bg-utility-success-50 tw:px-3 tw:py-2">
        <IcCheckCircle
          className="tw:shrink-0 tw:text-fg-success-secondary"
          height={18}
          width={18}
        />
        <span className="tw:text-sm tw:font-semibold tw:leading-5 tw:text-utility-success-700">
          {statusText}
        </span>
      </div>
    );
  }

  if (isWarning) {
    return (
      <div className="tw:flex tw:items-center tw:gap-2.5 tw:rounded-xl tw:border tw:border-utility-warning-200 tw:bg-utility-warning-50 tw:px-3 tw:py-2">
        <IcTcWarn
          className="tw:shrink-0 tw:text-fg-warning-secondary"
          height={18}
          width={18}
        />
        <span className="tw:text-sm tw:font-semibold tw:leading-5 tw:text-fg-warning-primary">
          {statusText}
        </span>
      </div>
    );
  }

  const textColorClass = isTestingConnection
    ? 'tw:text-utility-brand-700'
    : 'tw:text-utility-error-700';

  const bannerClass = classNames(
    'tw:flex tw:items-center tw:gap-2.5 tw:rounded-xl tw:border tw:px-3 tw:py-2',
    {
      'tw:border-utility-brand-200 tw:bg-utility-brand-50': isTestingConnection,
      'tw:border-utility-error-200 tw:bg-utility-error-50':
        isFailed && !isTestingConnection,
    }
  );

  return (
    <div className={bannerClass}>
      <div className="tw:flex tw:items-center tw:justify-between tw:flex-1">
        <div className="tw:flex tw:items-center tw:gap-2.5">
          {isTestingConnection ? (
            <Loader size="small" />
          ) : (
            getConnectionStatusIcon(isFailed, isSuccessful)
          )}
          <span
            className={`tw:text-sm tw:font-semibold tw:leading-5 ${textColorClass}`}>
            {statusText}
          </span>
        </div>
        {isTestingConnection && (
          <span
            className="tw:shrink-0 tw:font-medium tw:text-secondary"
            data-testid="progress-bar-value">
            {`${progressPercent}%`}
          </span>
        )}
      </div>
    </div>
  );
}

const GATE_STEPS = [
  'label.resolve-host',
  'label.open-socket',
  'label.authenticate',
  'label.open-session',
] as const;

type GatePillState = 'pass' | 'fail' | 'running' | 'queued';

export function ConnectionGateCard(
  props: Readonly<{
    gateDescription: string;
    gateResult: TestConnectionStepResult | undefined;
    isFailed: boolean;
    isGateExpanded: boolean;
    isTestingConnection: boolean;
    onToggleGate: () => void;
    t: TranslateFn;
  }>
) {
  const {
    gateDescription,
    gateResult,
    isFailed,
    isGateExpanded,
    isTestingConnection,
    onToggleGate,
    t,
  } = props;

  // When the test is done+failed but no step results came back (API error before
  // the workflow ran), treat the gate as failed so it doesn't stay blue/spinning.
  const gateFailed =
    (gateResult && !gateResult.passed) || (!gateResult && isFailed);

  const gateCardClass = classNames(
    'tw:overflow-hidden tw:rounded-xl tw:border',
    {
      'tw:border-utility-brand-200 tw:bg-utility-brand-50':
        !gateResult && !isFailed,
      'tw:border-utility-success-200 tw:bg-utility-success-50':
        gateResult?.passed,
      'tw:border-utility-error-200 tw:bg-utility-error-50': gateFailed,
    }
  );

  const gatePillClass = classNames(
    'tw:inline-flex tw:h-6 tw:items-center tw:rounded-full tw:border tw:px-2',
    'tw:text-xs tw:font-semibold tw:leading-4',
    {
      'tw:border-utility-brand-200 tw:bg-white tw:text-utility-brand-700':
        !gateResult && !isFailed,
      'tw:border-utility-success-200 tw:bg-white tw:text-utility-success-700':
        gateResult?.passed,
      'tw:border-utility-error-200 tw:bg-white tw:text-utility-error-700':
        gateFailed,
    }
  );

  let gateIcon: JSX.Element | undefined;

  if (!gateResult && !isFailed) {
    gateIcon = <Loader size="small" />;
  } else if (gateResult?.passed) {
    gateIcon = (
      <span className="tw:flex tw:items-center" data-testid="success-badge">
        <IcCheckCircle
          className="tw:text-fg-success-secondary"
          height={18}
          width={18}
        />
      </span>
    );
  } else if (gateFailed) {
    gateIcon = (
      <span className="tw:flex tw:items-center" data-testid="fail-badge">
        <IcTcFail className="tw:text-fg-error-primary" height={18} width={18} />
      </span>
    );
  }

  const descriptionClass = classNames('tw:text-tertiary tw:text-xs', {
    'tw:text-utility-error-700': gateFailed,
  });

  let pillState: GatePillState | undefined;

  if (!gateResult && isTestingConnection) {
    pillState = 'running';
  } else if (gateResult?.passed) {
    pillState = 'pass';
  } else if (gateFailed) {
    pillState = 'fail';
  } else {
    pillState = 'queued';
  }

  const pillClass = classNames(
    'tw:inline-flex tw:h-6 tw:items-center tw:gap-1.5 tw:rounded-full tw:border tw:bg-white tw:px-2.5 tw:text-xs tw:font-medium',
    {
      'tw:border-utility-success-200 tw:text-utility-success-700':
        pillState === 'pass',
      'tw:border-utility-error-200 tw:text-utility-error-700':
        pillState === 'fail',
      'tw:border-utility-brand-200 tw:text-utility-brand-700':
        pillState === 'running',
      'tw:border-gray-300 tw:text-secondary': pillState === 'queued',
    }
  );

  let pillIcon: JSX.Element | null;

  if (pillState === 'pass') {
    pillIcon = (
      <IcCheckCircle
        className="tw:shrink-0 tw:text-fg-success-secondary"
        data-testid="pill-icon-pass"
        height={12}
        width={12}
      />
    );
  } else if (pillState === 'fail') {
    pillIcon = (
      <IcTcFail
        className="tw:shrink-0 tw:text-fg-error-primary"
        data-testid="pill-icon-fail"
        height={12}
        width={12}
      />
    );
  } else if (pillState === 'running') {
    pillIcon = <Loader size="x-small" />;
  } else {
    pillIcon = null;
  }

  return (
    <div className={gateCardClass} data-testid="connection-gate-phase">
      <button
        className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-4 tw:border-0 tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-left"
        type="button"
        onClick={onToggleGate}>
        <div className="tw:flex tw:size-[22px] tw:shrink-0 tw:items-center tw:justify-center">
          {gateIcon}
        </div>
        <div className="tw:min-w-0 tw:flex-1">
          <div className="tw:text-sm tw:font-semibold tw:leading-5 tw:text-primary">
            {t('label.establish-connection')}
          </div>
          <div className={descriptionClass}>{gateDescription}</div>
        </div>
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2.5 tw:text-quaternary">
          <span className={gatePillClass}>{t('label.gate')}</span>
          {isGateExpanded ? (
            <ChevronDown size={18} />
          ) : (
            <ChevronRight size={18} />
          )}
        </div>
      </button>
      {isGateExpanded && (
        <div className="tw:flex tw:flex-wrap tw:gap-2 tw:px-4 tw:pb-3.5">
          {GATE_STEPS.map((key) => (
            <span className={pillClass} data-testid="gate-step-pill" key={key}>
              {pillIcon ?? (
                <IcTcQueued
                  className="tw:shrink-0 tw:text-utility-gray-300"
                  data-testid="pill-icon-queued"
                  height={12}
                  width={12}
                />
              )}
              {t(key)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConnectionCapabilitySection(
  props: Readonly<{
    capabilitySteps: TestConnectionStep[];
    connectionFailed: boolean;
    expandedStepNames: string[];
    gateResult: TestConnectionStepResult | undefined;
    gateStepName?: string;
    getConnectionStepResult: (
      step: TestConnectionStep
    ) => TestConnectionStepResult | undefined;
    isTestingConnection: boolean;
    setExpandedStepNames: Dispatch<SetStateAction<string[]>>;
    t: TranslateFn;
  }>
) {
  const {
    capabilitySteps,
    connectionFailed,
    expandedStepNames,
    gateResult,
    gateStepName,
    getConnectionStepResult,
    isTestingConnection,
    setExpandedStepNames,
    t,
  } = props;

  const expandableSteps = useMemo(
    () =>
      new Set(
        capabilitySteps
          .filter((s) => {
            const r = getConnectionStepResult(s);
            const state = getStepState(s, r, connectionFailed, gateStepName);
            const isExpandableState =
              !!r &&
              (state === 'passed' || state === 'failed' || state === 'warning');

            return (
              isExpandableState &&
              (!isEmpty(r?.executedCommand) ||
                !isEmpty(r?.resultSummary) ||
                !isEmpty(r?.message) ||
                !isEmpty(r?.errorLog) ||
                !isEmpty(r?.diagnosis))
            );
          })
          .map((s) => s.name)
      ),
    [capabilitySteps, connectionFailed, gateStepName, getConnectionStepResult]
  );

  if (!capabilitySteps.length) {
    return null;
  }

  const showFraction = !isTestingConnection && gateResult?.passed;

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-2"
      data-testid="capability-checks-phase">
      <Box align="center" justify="between">
        <Box gap={2}>
          <Typography
            className="tw:tracking-[0.04em] tw:text-quaternary tw:uppercase"
            size="text-xs"
            weight="semibold">
            {t('label.capability-check-plural')}
          </Typography>
          {connectionFailed && (
            <Typography className="tw:text-quaternary" size="text-xs">
              {t('message.connection-skipped-gate-failed')}
            </Typography>
          )}
        </Box>
        {showFraction && (
          <Typography
            className="tw:text-tertiary"
            size="text-xs"
            weight="medium">
            {t('message.test-connection-checks-fraction', {
              passed: capabilitySteps.filter(
                (step) => getConnectionStepResult(step)?.passed
              ).length,
              total: capabilitySteps.length,
            })}
          </Typography>
        )}
      </Box>
      <Accordion
        allowsMultipleExpanded
        expandedKeys={expandedStepNames}
        onExpandedChange={(keys) =>
          setExpandedStepNames(
            ([...keys] as string[]).filter((k) => expandableSteps.has(k))
          )
        }>
        {capabilitySteps.map((step) => {
          const result = getConnectionStepResult(step);
          const state = getStepState(
            step,
            result,
            connectionFailed,
            gateStepName
          );
          const label = getStepLabel(t, step);
          const statusLabel = getStepStatusLabel(t, state);
          const requiredLabel = t('label.required');
          const canExpand = expandableSteps.has(step.name);

          const resultTextClass = classNames(
            'tw:min-w-12 tw:text-right tw:text-xs tw:font-medium tw:text-quaternary',
            {
              'tw:text-utility-brand-700': state === 'running',
              'tw:text-utility-success-700': state === 'passed',
              'tw:text-utility-error-700': state === 'failed',
              'tw:min-w-[210px] tw:text-quaternary': state === 'skipped',
            }
          );

          return (
            <AccordionItem
              className={classNames('tw:w-full', {
                'tw:!bg-utility-error-50': state === 'failed',
                'tw:bg-primary': state !== 'failed',
                'tw:opacity-60': state === 'skipped',
              })}
              data-testid={`test-connection-step-${step.name}`}
              id={step.name}
              key={step.name}>
              <AccordionHeader
                className={classNames(
                  'tw:w-full tw:grid-cols-[28px_minmax(0,1fr)_auto] tw:items-center tw:gap-3',
                  'tw:border-0 tw:bg-transparent tw:px-4 tw:py-2.5 tw:text-left tw:outline-hidden',
                  canExpand
                    ? 'tw:cursor-pointer'
                    : 'tw:cursor-default hover:tw:bg-primary'
                )}
                showChevron={false}>
                <Box gap={4}>
                  <Box align="center" justify="center">
                    {getConnectionStepIcon(state)}
                  </Box>
                  <div className="tw:min-w-0">
                    <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
                      <span className="tw:overflow-hidden tw:text-sm tw:font-semibold tw:leading-5 tw:text-primary tw:text-ellipsis tw:whitespace-nowrap">
                        {label}
                      </span>
                      <Badge
                        bordered={false}
                        className="tw:font-medium tw:text-tertiary tw:border-0"
                        size="sm"
                        type="color">
                        {step.name}
                      </Badge>
                      {step.mandatory && (
                        <Badge
                          className="tw:uppercase tw:font-semibold"
                          color="brand"
                          size="xs">
                          {requiredLabel}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Box>
                <div className="tw:flex tw:items-center tw:gap-2">
                  <span className={resultTextClass}>{statusLabel}</span>
                  {canExpand && (
                    <ChevronRight
                      className="tw:text-utility-gray-400 tw:transition-transform tw:duration-200 tw:group-data-expanded/item:rotate-90"
                      size={18}
                    />
                  )}
                </div>
              </AccordionHeader>
              <AccordionPanel className="tw:p-0">
                {result && (
                  <div className="tw:border-t tw:border-border-secondary">
                    <pre className="tw:overflow-auto tw:rounded-lg tw:bg-gray-900 tw:p-3 tw:text-xs tw:text-utility-gray-300 tw:whitespace-pre-wrap tw:m-3.5 tw:ml-[46px] tw:font-semibold">
                      {result.executedCommand &&
                        renderColoredLines(
                          `> ${result.executedCommand}`,
                          'tw:text-brand-300',
                          'cmd-'
                        )}
                      {(result.resultSummary || result.message) &&
                        renderColoredLines(
                          `  ${result.resultSummary || result.message}${
                            result.durationMs
                              ? ` (${result.durationMs} ms)`
                              : ''
                          }`,
                          'tw:text-utility-success-300',
                          'sum-'
                        )}
                      {result.errorLog &&
                        renderColoredLines(
                          result.errorLog,
                          'tw:text-utility-error-300',
                          'err-'
                        )}
                      {result.diagnosis &&
                        renderColoredLines(
                          [
                            result.diagnosis.title,
                            result.diagnosis.remediation,
                            result.diagnosis.docUrl,
                          ]
                            .filter(Boolean)
                            .join('\n'),
                          'tw:text-utility-warning-300',
                          'diag-'
                        )}
                    </pre>
                  </div>
                )}
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

export function ConnectionRawLogSection(
  props: Readonly<{
    rawLog: string;
    rawLogLineCount: number;
    setShowRawLog: Dispatch<SetStateAction<boolean>>;
    showRawLog: boolean;
    t: TranslateFn;
    testConnectionStepResult: TestConnectionStepResult[];
  }>
) {
  const {
    rawLog,
    rawLogLineCount,
    setShowRawLog,
    showRawLog,
    t,
    testConnectionStepResult,
  } = props;

  if (!rawLog) {
    return null;
  }

  const toggleLabel = showRawLog
    ? t('message.hide-raw-connection-log-lines', {
        count: rawLogLineCount,
      })
    : t('message.show-raw-connection-log-lines', {
        count: rawLogLineCount,
      });

  return (
    <div className="tw:flex tw:flex-col tw:items-stretch tw:gap-3">
      <button
        className={classNames(
          'tw:inline-flex tw:max-w-full tw:w-max tw:cursor-pointer tw:items-center tw:gap-1',
          'tw:border-0 tw:bg-transparent tw:p-0 tw:font-semibold tw:text-xs',
          'tw:text-utility-brand-600 tw:text-left tw:whitespace-nowrap'
        )}
        type="button"
        onClick={() => setShowRawLog((current) => !current)}>
        {showRawLog ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {toggleLabel}
      </button>
      {showRawLog && (
        <pre
          className="tw:overflow-auto tw:rounded-lg tw:bg-gray-900 tw:p-3 tw:font-mono tw:text-xs tw:text-utility-gray-300 tw:whitespace-pre-wrap tw:w-full tw:max-h-[360px] tw:m-0 tw:font-semibold"
          data-testid="raw-connection-log">
          {testConnectionStepResult.flatMap((result, stepIdx) => {
            const summary = result.resultSummary || result.message;
            const timing = result.durationMs
              ? ` (${result.durationMs} ms)`
              : '';
            const parts: JSX.Element[] = [];

            if (result.executedCommand) {
              parts.push(
                ...renderColoredLines(
                  `> ${result.executedCommand}`,
                  'tw:text-brand-300',
                  `${stepIdx}-cmd-`
                )
              );
            }
            if (summary) {
              parts.push(
                ...renderColoredLines(
                  `  ${summary}${timing}`,
                  'tw:text-utility-success-300',
                  `${stepIdx}-sum-`
                )
              );
            }
            if (result.errorLog) {
              parts.push(
                ...renderColoredLines(
                  result.errorLog,
                  'tw:text-utility-error-300',
                  `${stepIdx}-err-`
                )
              );
            }
            if (result.diagnosis) {
              parts.push(
                ...renderColoredLines(
                  [
                    result.diagnosis.title,
                    result.diagnosis.remediation,
                    result.diagnosis.docUrl,
                  ]
                    .filter(Boolean)
                    .join('\n'),
                  'tw:text-utility-warning-300',
                  `${stepIdx}-diag-`
                )
              );
            }

            return parts;
          })}
        </pre>
      )}
    </div>
  );
}

export function ConnectionFooterActions(
  props: Readonly<{
    isFailed: boolean;
    isConnectionTimeout: boolean;
    isTestingConnection: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    onCopyToClipBoard: () => void;
    onTestConnection: () => void;
    rawLog: string;
    t: TranslateFn;
  }>
) {
  const {
    isFailed,
    isConnectionTimeout,
    isTestingConnection,
    onCancel,
    onConfirm,
    onCopyToClipBoard,
    onTestConnection,
    rawLog,
    t,
  } = props;

  let button = (
    <Button color="primary" size="sm" onClick={onConfirm}>
      {t('label.done')}
    </Button>
  );

  if (isConnectionTimeout) {
    button = (
      <Button
        className="test-connection-footer-try-again"
        color="primary"
        iconLeading={<RefreshCcw01 size={16} />}
        size="sm"
        onClick={onTestConnection}>
        {t('label.try-again')}
      </Button>
    );
  } else if (isTestingConnection) {
    button = (
      <Button color="secondary" size="sm" onClick={onCancel}>
        {t('label.cancel')}
      </Button>
    );
  } else if (isFailed) {
    button = (
      <Button
        color="primary"
        data-testid="retry-test-button"
        size="sm"
        onClick={onTestConnection}>
        {t('label.retry-test')}
      </Button>
    );
  }

  return (
    <>
      <Button
        className="tw:mr-auto"
        color="secondary"
        data-testid="copy-log-button"
        iconLeading={<Copy01 size={16} />}
        isDisabled={!rawLog}
        size="sm"
        onClick={() => onCopyToClipBoard()}>
        {t('label.copy-log')}
      </Button>
      {!isConnectionTimeout && !isTestingConnection && isFailed && (
        <Button
          color="link-color"
          data-testid="edit-connection-button"
          size="sm"
          onClick={onConfirm}>
          <span data-text>{t('label.edit-connection')}</span>
        </Button>
      )}
      {button}
    </>
  );
}

export function ConnectionRemediationCard(
  props: Readonly<{
    connectionFailed: boolean;
    gateResult: TestConnectionStepResult | undefined;
    capabilitySteps: TestConnectionStep[];
    getConnectionStepResult: (
      step: TestConnectionStep
    ) => TestConnectionStepResult | undefined;
    t: TranslateFn;
  }>
) {
  const {
    connectionFailed,
    gateResult,
    capabilitySteps,
    getConnectionStepResult,
    t,
  } = props;

  const errorContent = connectionFailed
    ? gateResult?.errorLog || gateResult?.message || ''
    : (() => {
        const failed = capabilitySteps.find(
          (s) => s.mandatory && getConnectionStepResult(s)?.passed === false
        );
        const r = failed ? getConnectionStepResult(failed) : undefined;

        return r?.errorLog || r?.message || '';
      })();

  const diagnosis = connectionFailed
    ? gateResult?.diagnosis
    : (() => {
        const failed = capabilitySteps.find(
          (s) => s.mandatory && getConnectionStepResult(s)?.passed === false
        );
        const r = failed ? getConnectionStepResult(failed) : undefined;

        return r?.diagnosis;
      })();

  if (!errorContent) {
    return null;
  }

  const cardClass = classNames(
    'tw:rounded-xl tw:border tw:p-4 tw:flex tw:flex-col tw:gap-1',
    connectionFailed
      ? 'tw:border-utility-error-200 tw:bg-utility-error-50'
      : 'tw:border-utility-warning-200 tw:bg-utility-warning-50'
  );

  let titleText = connectionFailed
    ? t('message.connection-gate-failed')
    : t('message.connection-required-check-failed');

  if (diagnosis?.title) {
    titleText = diagnosis.title;
  }

  return (
    <div className={cardClass} data-testid="connection-remediation-card">
      <div className="tw:flex tw:items-center tw:gap-2">
        <Lightbulb03 className="tw:shrink-0 tw:text-primary" size={17} />
        <span className="tw:text-sm tw:font-bold tw:text-primary">
          {titleText}
        </span>
      </div>
      {diagnosis && (
        <div className="tw:flex tw:flex-col tw:gap-1 tw:text-xs">
          {diagnosis.remediation && (
            <Typography className="tw:text-secondary" size="text-xs">
              {diagnosis.remediation}
            </Typography>
          )}
          {diagnosis.docUrl && (
            <a
              className="tw:mt-1 tw:font-medium tw:text-primary tw:underline"
              href={diagnosis.docUrl}
              rel="noopener noreferrer"
              target="_blank">
              {t('label.learn-more')}
            </a>
          )}
        </div>
      )}
      {!diagnosis && errorContent && (
        <pre className="tw:m-0 tw:w-full tw:overflow-auto tw:rounded-lg tw:bg-gray-900 tw:p-3 tw:text-xs tw:whitespace-pre-wrap tw:font-semibold">
          {renderColoredLines(
            errorContent,
            'tw:text-utility-error-300',
            'rem-'
          )}
        </pre>
      )}
    </div>
  );
}
