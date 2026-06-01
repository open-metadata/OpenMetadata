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
    icon = (
      <AlertTriangle
        className="test-connection-status-icon warning"
        size={18}
      />
    );
  } else if (isSuccessful) {
    icon = <CheckCircle className="test-connection-status-icon" size={18} />;
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
        className="test-connection-state-icon"
        data-testid="success-badge"
        size={18}
      />
    );
  }

  if (state === 'failed') {
    return (
      <XCircle
        className="test-connection-state-icon"
        data-testid="fail-badge"
        size={18}
      />
    );
  }

  if (state === 'warning') {
    return (
      <AlertTriangle
        className="test-connection-state-icon"
        data-testid="warning-badge"
        size={18}
      />
    );
  }

  return <span className="test-connection-state-icon queued" />;
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

  return (
    <div
      className={classNames('test-connection-check-row', {
        [`test-connection-check-row-${state}`]: state,
        'test-connection-check-row-expanded': isExpanded,
      })}
      data-testid={`test-connection-step-${step.name}`}
      key={step.name}>
      <button
        className="test-connection-check-row-button"
        type="button"
        onClick={onToggleExpand}>
        <div className="test-connection-check-status">
          {getConnectionStepIcon(state)}
        </div>
        <div className="test-connection-check-copy">
          <div className="test-connection-check-title-row">
            <span className="test-connection-check-title">{label}</span>
            <span className="test-connection-method-chip">{step.name}</span>
            {step.mandatory && (
              <span className="test-connection-required-chip">
                {requiredLabel}
              </span>
            )}
          </div>
        </div>
        <div className="test-connection-check-meta">
          <span className="test-connection-result-text">{statusLabel}</span>
          {isExpanded ? (
            <ChevronDown className="test-connection-chevron" size={18} />
          ) : (
            <ChevronRight className="test-connection-chevron" size={18} />
          )}
        </div>
      </button>
      {isExpanded && <pre className="test-connection-step-log">{details}</pre>}
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

  return (
    <div
      className={classNames('test-connection-status-banner', {
        'test-connection-status-banner-success': isSuccessful,
        'test-connection-status-banner-warning': isWarning,
        'test-connection-status-banner-failed': isFailed,
        'test-connection-status-banner-running': isTestingConnection,
      })}>
      <div>
        <div className="test-connection-status-title-row">
          {getConnectionStatusIcon(isWarning, isSuccessful)}
          <span className="test-connection-status-title">
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
          <div className="test-connection-status-subtitle">
            {t('message.test-connection-checks-passed-count', {
              passed: passedCount,
              total: totalCount,
            })}
          </div>
        )}
      </div>
      {!isSuccessful && (
        <div className="test-connection-progress-bar tw:flex tw:items-center tw:gap-2">
          <ProgressBarBase className="tw:flex-1" value={progressPercent} />
          <span data-testid="progress-bar-value">{`${progressPercent}%`}</span>
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

  return (
    <div
      className={classNames('test-connection-gate-card', {
        'test-connection-gate-card-passed': gateResult?.passed,
        'test-connection-gate-card-failed': gateResult && !gateResult.passed,
      })}
      data-testid="connection-gate-phase">
      <button
        className="test-connection-gate-main"
        type="button"
        onClick={onToggleGate}>
        <div className="test-connection-gate-copy">
          <div className="test-connection-gate-title">
            {t('label.establish-connection')}
          </div>
          <div className="test-connection-gate-description">
            {gateDescription}
          </div>
        </div>
        <div className="test-connection-gate-meta">
          <span className="test-connection-gate-chip">{t('label.gate')}</span>
          {getConnectionStepIcon(getGateState(gateResult))}
          {isGateExpanded ? (
            <ChevronDown size={18} />
          ) : (
            <ChevronRight size={18} />
          )}
        </div>
      </button>
      {isGateExpanded && (
        <div className="test-connection-gate-pills">
          <span>{t('label.resolve-host')}</span>
          <span>{t('label.open-socket')}</span>
          <span>{t('label.authenticate')}</span>
          <span>{t('label.open-session')}</span>
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
      className="test-connection-capability-section"
      data-testid="capability-checks-phase">
      <div className="test-connection-section-header">
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
      <div className="test-connection-check-list">
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
    <div className="raw-connection-log">
      <button
        className="raw-connection-log-toggle"
        type="button"
        onClick={() => setShowRawLog((current) => !current)}>
        {showRawLog ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {toggleLabel}
      </button>
      {showRawLog && (
        <pre
          className="raw-connection-log-content"
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
        className="test-connection-modal-copy-button"
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
