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
import { Button, ProgressBarBase } from '@openmetadata/ui-core-components';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy01,
  RefreshCcw01,
  XCircle,
} from '@untitledui/icons';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { Fragment, type Dispatch, type SetStateAction } from 'react';
import {
  ConnectionStepRowProps,
  ConnectionStepState,
  TranslateFn,
} from '../components/common/TestConnection/TestConnectionModal/TestConnectionModal.interface';
import {
  TEST_CONNECTION_FAILURE_MESSAGE,
  TEST_CONNECTION_WARNING_MESSAGE,
} from '../constants/Services.constant';
import { TestConnectionStepResult } from '../generated/entity/automations/workflow';
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
    if (result.passed) {
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

  if (state === 'passed') {
    label = t('label.passed');
  } else if (state === 'failed') {
    label = t('label.failed');
  } else if (state === 'warning') {
    label = t('label.warning');
  } else if (state === 'skipped') {
    label = t('message.connection-not-established');
  }

  return label;
}

export function getStepDetails(
  t: TranslateFn,
  step: TestConnectionStep,
  result?: TestConnectionStepResult
) {
  const resultDetails = [result?.message, result?.errorLog]
    .filter(Boolean)
    .join('\n');

  return (
    resultDetails ||
    step.description ||
    t('message.test-connection-step-queued')
  );
}

export function getConnectionStatusIcon(
  isWarning: boolean,
  isSuccessful: boolean
) {
  let icon = null;

  if (isWarning) {
    icon = <AlertTriangle className="tw:text-utility-warning-600" size={18} />;
  } else if (isSuccessful) {
    icon = <CheckCircle className="tw:text-utility-success-600" size={18} />;
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
  passedCount,
  totalCount,
  t,
}: {
  isTestingConnection: boolean;
  isWarning: boolean;
  isSuccessful: boolean;
  passedCount: number;
  totalCount: number;
  t: TranslateFn;
}) {
  let text = t(TEST_CONNECTION_FAILURE_MESSAGE);

  if (isTestingConnection) {
    text = t('message.test-connection-running-checks', {
      passed: passedCount,
      total: totalCount,
    });
  } else if (isWarning) {
    text = t(TEST_CONNECTION_WARNING_MESSAGE);
  } else if (isSuccessful) {
    text = t('message.test-connection-verified-count', {
      passed: passedCount,
      total: totalCount,
    });
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
  if (state === 'passed') {
    return (
      <CheckCircle
        className="tw:text-utility-success-600"
        data-testid="success-badge"
        size={18}
      />
    );
  }

  if (state === 'failed') {
    return (
      <XCircle
        className="tw:text-utility-error-600"
        data-testid="fail-badge"
        size={18}
      />
    );
  }

  if (state === 'warning') {
    return (
      <AlertTriangle
        className="tw:text-utility-warning-600"
        data-testid="warning-badge"
        size={18}
      />
    );
  }

  return (
    <span className="tw:size-2.5 tw:rounded-full tw:border-2 tw:border-gray-300" />
  );
}

export function ConnectionStepRow(props: Readonly<ConnectionStepRowProps>) {
  const {
    details,
    isExpanded,
    label,
    onToggleExpand,
    requiredLabel,
    state,
    step,
    statusLabel,
  } = props;

  const resultTextClass = classNames(
    'tw:min-w-12 tw:text-right tw:text-xs tw:font-medium  tw:text-quaternary',
    {
      'tw:text-utility-success-700': state === 'passed',
      'tw:text-utility-error-700': state === 'failed',
      'tw:min-w-[210px] tw:text-quaternary': state === 'skipped',
    }
  );

  return (
    <div
      className={classNames(
        'test-connection-check-row [&:not(:first-child)]:tw:border-t [&:not(:first-child)]:tw:border-gray-200',
        {
          [`test-connection-check-row-${state}`]: state,
          'test-connection-check-row-expanded': isExpanded,
        }
      )}
      data-testid={`test-connection-step-${step.name}`}
      key={step.name}>
      <button
        className="tw:grid tw:w-full tw:grid-cols-[28px_minmax(0,1fr)_auto] tw:items-center tw:gap-3 tw:border-0 tw:bg-transparent tw:px-[18px] tw:py-3.5 tw:text-left tw:cursor-pointer"
        type="button"
        onClick={onToggleExpand}>
        <div className="tw:flex tw:items-center tw:justify-center">
          {getConnectionStepIcon(state)}
        </div>
        <div className="tw:min-w-0">
          <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-2.5">
            <span className="tw:overflow-hidden tw:text-sm tw:font-medium tw:leading-5 tw:text-primary tw:text-ellipsis tw:whitespace-nowrap">
              {label}
            </span>
            <span className="tw:inline-flex tw:h-6 tw:shrink-0 tw:items-center tw:rounded-full tw:bg-gray-100 tw:px-2 tw:text-xs tw:font-medium tw:leading-4 tw:text-quaternary">
              {step.name}
            </span>
            {step.mandatory && (
              <span
                className={classNames(
                  'tw:inline-flex tw:h-[22px] tw:items-center tw:rounded-full tw:border',
                  'tw:border-utility-brand-200 tw:bg-utility-brand-50 tw:px-[7px]',
                  'tw:text-xs tw:font-medium tw:uppercase tw:leading-4 tw:text-utility-brand-700'
                )}>
                {requiredLabel}
              </span>
            )}
          </div>
        </div>
        <div className="tw:flex tw:items-center tw:gap-2">
          <span className={resultTextClass}>{statusLabel}</span>
          {isExpanded ? (
            <ChevronDown className="tw:text-gray-400" size={18} />
          ) : (
            <ChevronRight className="tw:text-gray-400" size={18} />
          )}
        </div>
      </button>
      {isExpanded && (
        <pre className="tw:overflow-auto tw:rounded-lg tw:bg-gray-900 tw:p-3 tw:font-mono tw:text-xs  tw:text-gray-300 tw:whitespace-pre-wrap tw:mx-3.5 tw:mb-3.5 tw:ml-[54px]">
          {details}
        </pre>
      )}
    </div>
  );
}

export function ConnectionStatusBanner(
  props: Readonly<{
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
    isFailed,
    isSuccessful,
    isTestingConnection,
    isWarning,
    passedCount,
    progressPercent,
    t,
    totalCount,
  } = props;

  const bannerClass = classNames(
    'tw:grid tw:grid-cols-[minmax(0,1fr)_180px] tw:items-center tw:gap-[18px] tw:rounded-xl tw:border tw:px-4 tw:py-3.5',
    {
      'tw:border-utility-brand-200 tw:bg-utility-brand-50':
        !isSuccessful && !isWarning && !isFailed,
      'tw:flex tw:border-utility-success-200 tw:bg-utility-success-50':
        isSuccessful,
      'tw:border-utility-warning-200 tw:bg-utility-warning-50': isWarning,
      'tw:border-utility-error-200 tw:bg-utility-error-50': isFailed,
    }
  );

  return (
    <div className={bannerClass}>
      <div>
        <div className="tw:flex tw:items-center tw:gap-2.5">
          {getConnectionStatusIcon(isWarning, isSuccessful)}
          <span className="tw:text-sm tw:font-medium tw:leading-5 tw:text-primary">
            {getConnectionStatusText({
              isTestingConnection,
              isWarning,
              isSuccessful,
              passedCount,
              totalCount,
              t,
            })}
          </span>
        </div>
        {!isSuccessful && (
          <div className="tw:mt-0.5  tw:text-secondary">
            {t('message.test-connection-checks-passed-count', {
              passed: passedCount,
              total: totalCount,
            })}
          </div>
        )}
      </div>
      {!isSuccessful && (
        <div className="tw:flex tw:items-center tw:gap-2">
          <ProgressBarBase className="tw:flex-1" value={progressPercent} />
          <span
            className="tw:min-w-[40px] tw:font-medium tw:text-secondary"
            data-testid="progress-bar-value">{`${progressPercent}%`}</span>
        </div>
      )}
    </div>
  );
}

export function ConnectionGateCard(
  props: Readonly<{
    gateDescription: string;
    gateResult: TestConnectionStepResult | undefined;
    isGateExpanded: boolean;
    onToggleGate: () => void;
    t: TranslateFn;
  }>
) {
  const { gateDescription, gateResult, isGateExpanded, onToggleGate, t } =
    props;

  const gateCardClass = classNames(
    'tw:overflow-hidden tw:rounded-xl tw:border',
    {
      'tw:border-gray-300':
        !gateResult?.passed && !(gateResult && !gateResult.passed),
      'tw:border-utility-success-200 tw:bg-utility-success-50':
        gateResult?.passed,
      'tw:border-utility-error-200 tw:bg-utility-error-50':
        gateResult && !gateResult.passed,
    }
  );

  return (
    <div className={gateCardClass} data-testid="connection-gate-phase">
      <button
        className="tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:justify-between tw:gap-4 tw:border-0 tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-left"
        type="button"
        onClick={onToggleGate}>
        <div className="tw:min-w-0">
          <div className="tw:text-sm tw:font-medium tw:leading-5 tw:text-primary">
            {t('label.establish-connection')}
          </div>
          <div className="tw:mt-0.5  tw:text-secondary">{gateDescription}</div>
        </div>
        <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2.5 tw:text-quaternary">
          <span
            className={classNames(
              'tw:inline-flex tw:h-[22px] tw:items-center tw:rounded-full tw:border',
              'tw:border-utility-success-200 tw:bg-[#dcfae6] tw:px-2',
              'tw:text-xs tw:font-medium tw:uppercase tw:leading-4 tw:text-utility-success-700'
            )}>
            {t('label.gate')}
          </span>
          {getConnectionStepIcon(getGateState(gateResult))}
          {isGateExpanded ? (
            <ChevronDown size={18} />
          ) : (
            <ChevronRight size={18} />
          )}
        </div>
      </button>
      {isGateExpanded && (
        <div className="tw:flex tw:flex-wrap tw:gap-2 tw:px-4 tw:pb-3.5">
          <span className="tw:inline-flex tw:h-6 tw:items-center tw:rounded-full tw:border tw:border-gray-300 tw:bg-white tw:px-2.5 tw:text-xs tw:font-medium  tw:text-secondary">
            {t('label.resolve-host')}
          </span>
          <span className="tw:inline-flex tw:h-6 tw:items-center tw:rounded-full tw:border tw:border-gray-300 tw:bg-white tw:px-2.5 tw:text-xs tw:font-medium  tw:text-secondary">
            {t('label.open-socket')}
          </span>
          <span className="tw:inline-flex tw:h-6 tw:items-center tw:rounded-full tw:border tw:border-gray-300 tw:bg-white tw:px-2.5 tw:text-xs tw:font-medium  tw:text-secondary">
            {t('label.authenticate')}
          </span>
          <span className="tw:inline-flex tw:h-6 tw:items-center tw:rounded-full tw:border tw:border-gray-300 tw:bg-white tw:px-2.5 tw:text-xs tw:font-medium  tw:text-secondary">
            {t('label.open-session')}
          </span>
        </div>
      )}
    </div>
  );
}

export function ConnectionCapabilitySection(
  props: Readonly<{
    capabilitySteps: TestConnectionStep[];
    connectionFailed: boolean;
    expandedStepName: string | undefined;
    gateStepName?: string;
    getConnectionStepResult: (
      step: TestConnectionStep
    ) => TestConnectionStepResult | undefined;
    setExpandedStepName: Dispatch<SetStateAction<string | undefined>>;
    setHasUserCollapsedSteps: Dispatch<SetStateAction<boolean>>;
    t: TranslateFn;
  }>
) {
  const {
    capabilitySteps,
    connectionFailed,
    expandedStepName,
    gateStepName,
    getConnectionStepResult,
    setExpandedStepName,
    setHasUserCollapsedSteps,
    t,
  } = props;

  if (!capabilitySteps.length) {
    return null;
  }

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-2"
      data-testid="capability-checks-phase">
      <div className="tw:flex tw:items-center tw:justify-between tw:text-xs tw:font-bold tw:uppercase tw:leading-4 tw:tracking-[0.04em] tw:text-quaternary">
        <span>{t('label.capability-check-plural')}</span>
        <span>
          {t('message.test-connection-checks-passed-count', {
            passed: capabilitySteps.filter(
              (step) => getConnectionStepResult(step)?.passed
            ).length,
            total: capabilitySteps.length,
          })}
        </span>
      </div>
      <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-gray-200 tw:bg-white">
        {capabilitySteps.map((step) => {
          const result = getConnectionStepResult(step);
          const state = getStepState(
            step,
            result,
            connectionFailed,
            gateStepName
          );
          const isExpanded = expandedStepName === step.name;
          const label = getStepLabel(t, step);
          const statusLabel = getStepStatusLabel(t, state);
          const details = getStepDetails(t, step, result);
          const requiredLabel = t('label.required');

          return (
            <Fragment key={step.name}>
              <ConnectionStepRow
                details={details}
                isExpanded={isExpanded}
                label={label}
                requiredLabel={requiredLabel}
                state={state}
                statusLabel={statusLabel}
                step={step}
                onToggleExpand={() => {
                  const isCollapsingStep = expandedStepName === step.name;

                  setHasUserCollapsedSteps(isCollapsingStep);
                  setExpandedStepName(isCollapsingStep ? undefined : step.name);
                }}
              />
            </Fragment>
          );
        })}
      </div>
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
  }>
) {
  const { rawLog, rawLogLineCount, setShowRawLog, showRawLog, t } = props;

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
          'tw:border-0 tw:bg-transparent tw:p-0 tw:font-medium ',
          'tw:text-utility-brand-600 tw:text-left tw:whitespace-nowrap'
        )}
        type="button"
        onClick={() => setShowRawLog((current) => !current)}>
        {showRawLog ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {toggleLabel}
      </button>
      {showRawLog && (
        <pre
          className="tw:overflow-auto tw:rounded-lg tw:bg-gray-900 tw:p-3 tw:font-mono tw:text-xs  tw:text-gray-300 tw:whitespace-pre-wrap tw:w-full tw:max-h-[360px] tw:m-0"
          data-testid="raw-connection-log">
          {rawLog}
        </pre>
      )}
    </div>
  );
}

export function ConnectionFooterActions(
  props: Readonly<{
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
      {button}
    </>
  );
}
