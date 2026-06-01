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
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy01,
  RefreshCcw01,
  XCircle,
  XClose,
} from '@untitledui/icons';
import { Button, Modal, Progress, ProgressProps } from 'antd';
import classNames from 'classnames';
import { isUndefined, startCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTimeOut } from '../../../../assets/svg/ic-time-out.svg';
import { ReactComponent as IconTimeOutButton } from '../../../../assets/svg/ic-timeout-button.svg';
import {
  TEST_CONNECTION_FAILURE_MESSAGE,
  TEST_CONNECTION_WARNING_MESSAGE,
} from '../../../../constants/Services.constant';
import { TestConnectionStepResult } from '../../../../generated/entity/automations/workflow';
import { TestConnectionStep } from '../../../../generated/entity/services/connections/testConnectionDefinition';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { getServiceLogo } from '../../../../utils/EntityDisplayUtils';
import { partitionConnectionSteps } from '../../../../utils/TestConnectionUtils';
import InlineAlert from '../../InlineAlert/InlineAlert';
import './test-connection-modal.less';

interface TestConnectionModalProps {
  isOpen: boolean;
  isTestingConnection: boolean;
  testConnectionStep: TestConnectionStep[];
  testConnectionStepResult: TestConnectionStepResult[];
  progress: number;
  isConnectionTimeout: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onTestConnection: () => void;
  errorMessage?: {
    description?: string;
    subDescription?: string;
  };
  handleCloseErrorMessage: () => void;
  serviceType?: string;
  hostIp?: string;
  connectionType?: string;
  connectionDisplayName?: string;
}

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

type ConnectionStepState =
  | 'failed'
  | 'passed'
  | 'queued'
  | 'skipped'
  | 'warning';

const TestConnectionModal: FC<TestConnectionModalProps> = ({
  isOpen,
  progress,
  isTestingConnection,
  testConnectionStep,
  testConnectionStepResult,
  onConfirm,
  onCancel,
  isConnectionTimeout,
  onTestConnection,
  errorMessage,
  handleCloseErrorMessage,
  serviceType,
  hostIp,
  connectionType,
  connectionDisplayName,
}) => {
  const { t } = useTranslation();

  const [message, setMessage] = useState<string>();
  const [showRawLog, setShowRawLog] = useState(false);
  const [expandedStepName, setExpandedStepName] = useState<string>();
  const [hasUserCollapsedSteps, setHasUserCollapsedSteps] = useState(false);
  const [isGateExpanded, setIsGateExpanded] = useState(false);

  const resultByName = useMemo(
    () =>
      new Map(testConnectionStepResult.map((result) => [result.name, result])),
    [testConnectionStepResult]
  );

  const getConnectionStepResult = useCallback(
    (step: TestConnectionStep) => resultByName.get(step.name),
    [resultByName]
  );

  // The connection "gate" establishes connectivity; capability checks only run
  // once it passes. Splitting them lets us show a real "Didn't run" state for the
  // capability checks when the handshake fails, instead of a stuck "Awaiting".
  const { gateStep, capabilitySteps } = useMemo(
    () => partitionConnectionSteps(testConnectionStep),
    [testConnectionStep]
  );

  const gateResult = gateStep ? getConnectionStepResult(gateStep) : undefined;
  const connectionFailed =
    !isTestingConnection && !isUndefined(gateResult) && !gateResult.passed;

  const passedCount = useMemo(
    () => testConnectionStepResult.filter((result) => result.passed).length,
    [testConnectionStepResult]
  );

  const totalCount = testConnectionStep.length;
  const requiredSteps = useMemo(
    () => testConnectionStep.filter((step) => step.mandatory),
    [testConnectionStep]
  );
  const optionalSteps = useMemo(
    () => testConnectionStep.filter((step) => !step.mandatory),
    [testConnectionStep]
  );
  const areRequiredStepsPassing =
    requiredSteps.length > 0 &&
    requiredSteps.every((step) => getConnectionStepResult(step)?.passed);
  const hasOptionalFailures = optionalSteps.some(
    (step) => getConnectionStepResult(step)?.passed === false
  );

  const progressPercent = totalCount
    ? Math.min(
        100,
        Math.max(progress, Math.round((passedCount / totalCount) * 100))
      )
    : progress;

  const isComplete = !isTestingConnection && progress >= 100;
  const canProceed = isComplete && areRequiredStepsPassing;
  const isSuccessful = canProceed && !hasOptionalFailures;
  const isWarning = canProceed && hasOptionalFailures;
  const isFailed = isComplete && !areRequiredStepsPassing;

  const rawLog = useMemo(
    () =>
      testConnectionStepResult
        .map((result) =>
          [`> ${result.name}`, result.message, result.errorLog]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n\n')
        .trim(),
    [testConnectionStepResult]
  );

  const { onCopyToClipBoard } = useClipboard(rawLog);
  const rawLogLineCount = rawLog
    ? rawLog.split('\n').filter((line) => line.trim()).length
    : 0;

  const getProgressFormat: ProgressProps['format'] = (progress) => (
    <span data-testid="progress-bar-value">{`${progress}%`}</span>
  );

  const serviceLogo = useMemo(
    () =>
      connectionType
        ? getServiceLogo(connectionType, 'test-connection-service-logo-img')
        : null,
    [connectionType]
  );

  const getStepLabel = (step: TestConnectionStep) => {
    const labelKey = STEP_LABEL_KEYS[step.name];

    return labelKey ? t(labelKey) : startCase(step.name);
  };

  const getStepState = (
    step: TestConnectionStep,
    result?: TestConnectionStepResult
  ): ConnectionStepState => {
    if (result) {
      return result.passed ? 'passed' : step.mandatory ? 'failed' : 'warning';
    }

    if (connectionFailed && gateStep?.name !== step.name) {
      return 'skipped';
    }

    return 'queued';
  };

  const getStepStatusLabel = (state: ConnectionStepState) => {
    switch (state) {
      case 'passed':
        return t('label.passed');
      case 'failed':
        return t('label.failed');
      case 'warning':
        return t('label.warning');
      case 'skipped':
        return t('message.connection-not-established');
      case 'queued':
      default:
        return t('label.queued');
    }
  };

  const getStepDetails = (
    step: TestConnectionStep,
    result?: TestConnectionStepResult
  ) => {
    const resultDetails = [result?.message, result?.errorLog]
      .filter(Boolean)
      .join('\n');

    return (
      resultDetails ||
      step.description ||
      t('message.test-connection-step-queued')
    );
  };

  const renderStateIcon = (state: ConnectionStepState) => {
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
  };

  const renderStepRow = (step: TestConnectionStep) => {
    const result = getConnectionStepResult(step);
    const state = getStepState(step, result);
    const isExpanded = expandedStepName === step.name;

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
          onClick={() => {
            const isCollapsingStep = expandedStepName === step.name;

            setHasUserCollapsedSteps(isCollapsingStep);
            setExpandedStepName(isCollapsingStep ? undefined : step.name);
          }}>
          <div className="test-connection-check-status">
            {renderStateIcon(state)}
          </div>
          <div className="test-connection-check-copy">
            <div className="test-connection-check-title-row">
              <span className="test-connection-check-title">
                {getStepLabel(step)}
              </span>
              <span className="test-connection-method-chip">{step.name}</span>
              {step.mandatory && (
                <span className="test-connection-required-chip">
                  {t('label.required')}
                </span>
              )}
            </div>
          </div>
          <div className="test-connection-check-meta">
            <span className="test-connection-result-text">
              {getStepStatusLabel(state)}
            </span>
            {isExpanded ? (
              <ChevronDown className="test-connection-chevron" size={18} />
            ) : (
              <ChevronRight className="test-connection-chevron" size={18} />
            )}
          </div>
        </button>
        {isExpanded && (
          <pre className="test-connection-step-log">
            {getStepDetails(step, result)}
          </pre>
        )}
      </div>
    );
  };

  const handleModalClose = () => {
    if (isTestingConnection) {
      onCancel();
    } else {
      onConfirm();
    }
  };

  useEffect(() => {
    const msg = t('message.test-connection-taking-too-long.default', {
      service_type: serviceType,
    });
    if (hostIp) {
      const hostIpMessage =
        msg +
        t('message.test-connection-taking-too-long.withIp', { ip: hostIp });
      setMessage(hostIpMessage);
    } else {
      setMessage(msg);
    }
  }, [hostIp]);

  useEffect(() => {
    if (isTestingConnection) {
      setHasUserCollapsedSteps(false);

      return;
    }

    if (expandedStepName || hasUserCollapsedSteps) {
      return;
    }

    const firstStepWithResult = capabilitySteps.find((step) =>
      getConnectionStepResult(step)
    );

    if (firstStepWithResult) {
      setExpandedStepName(firstStepWithResult.name);
    }
  }, [
    capabilitySteps,
    expandedStepName,
    getConnectionStepResult,
    hasUserCollapsedSteps,
    isTestingConnection,
  ]);

  return (
    <Modal
      centered
      className="test-connection-status-modal"
      closable={false}
      data-testid="test-connection-modal"
      footer={null}
      maskClosable={false}
      open={isOpen}
      width={920}
      onCancel={handleModalClose}>
      <div className="test-connection-modal-header">
        <div className="test-connection-modal-service-icon">{serviceLogo}</div>
        <div className="test-connection-modal-title-group">
          <div className="test-connection-modal-title">
            {t('label.connection-status')}
          </div>
          <div className="test-connection-modal-subtitle">
            {connectionDisplayName}
          </div>
        </div>
        <Button
          className="test-connection-modal-close"
          data-testid="test-connection-close"
          icon={<XClose size={18} />}
          type="text"
          onClick={handleModalClose}
        />
      </div>
      <div className="test-connection-modal-body">
        {errorMessage && (
          <InlineAlert
            description={errorMessage.description}
            heading={t(TEST_CONNECTION_FAILURE_MESSAGE)}
            type="error"
            onClose={handleCloseErrorMessage}
          />
        )}

        {isConnectionTimeout ? (
          <div
            className="timeout-widget"
            data-testid="test-connection-timeout-widget">
            <IconTimeOut height={100} width={100} />
            <div className="test-connection-timeout-title">
              {t('label.connection-timeout')}
            </div>
            <div className="test-connection-timeout-message">{message}</div>
            <Button
              ghost
              className="try-again-button"
              data-testid="try-again-button"
              icon={<IconTimeOutButton height={14} width={14} />}
              type="primary"
              onClick={onTestConnection}>
              {t('label.try-again')}
            </Button>
          </div>
        ) : (
          <>
            <div
              className={classNames('test-connection-status-banner', {
                'test-connection-status-banner-success': isSuccessful,
                'test-connection-status-banner-warning': isWarning,
                'test-connection-status-banner-failed': isFailed,
                'test-connection-status-banner-running': isTestingConnection,
              })}>
              <div>
                <div className="test-connection-status-title-row">
                  {isWarning ? (
                    <AlertTriangle
                      className="test-connection-status-icon warning"
                      size={18}
                    />
                  ) : isSuccessful ? (
                    <CheckCircle
                      className="test-connection-status-icon"
                      size={18}
                    />
                  ) : null}
                  <span className="test-connection-status-title">
                    {isTestingConnection
                      ? t('message.test-connection-running-checks', {
                          passed: passedCount,
                          total: totalCount,
                        })
                      : isWarning
                      ? t(TEST_CONNECTION_WARNING_MESSAGE)
                      : isSuccessful
                      ? t('message.test-connection-verified-count', {
                          passed: passedCount,
                          total: totalCount,
                        })
                      : t(TEST_CONNECTION_FAILURE_MESSAGE)}
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
                <Progress
                  className="test-connection-progress-bar"
                  format={getProgressFormat}
                  percent={progressPercent}
                  strokeColor="#1570EF"
                />
              )}
            </div>

            {gateStep && (
              <div
                className={classNames('test-connection-gate-card', {
                  'test-connection-gate-card-passed': gateResult?.passed,
                  'test-connection-gate-card-failed':
                    gateResult && !gateResult.passed,
                })}
                data-testid="connection-gate-phase">
                <button
                  className="test-connection-gate-main"
                  type="button"
                  onClick={() => setIsGateExpanded((current) => !current)}>
                  <div className="test-connection-gate-copy">
                    <div className="test-connection-gate-title">
                      {t('label.establish-connection')}
                    </div>
                    <div className="test-connection-gate-description">
                      {gateResult?.message ||
                        (gateResult?.passed
                          ? t('message.test-connection-gate-success')
                          : gateStep.description)}
                    </div>
                  </div>
                  <div className="test-connection-gate-meta">
                    <span className="test-connection-gate-chip">
                      {t('label.gate')}
                    </span>
                    {renderStateIcon(getStepState(gateStep, gateResult))}
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
            )}

            {capabilitySteps.length > 0 && (
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
                  {capabilitySteps.map(renderStepRow)}
                </div>
              </div>
            )}

            {rawLog && (
              <div className="raw-connection-log">
                <button
                  className="raw-connection-log-toggle"
                  type="button"
                  onClick={() => setShowRawLog((current) => !current)}>
                  {showRawLog ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                  {showRawLog
                    ? t('message.hide-raw-connection-log-lines', {
                        count: rawLogLineCount,
                      })
                    : t('message.show-raw-connection-log-lines', {
                        count: rawLogLineCount,
                      })}
                </button>
                {showRawLog && (
                  <pre
                    className="raw-connection-log-content"
                    data-testid="raw-connection-log">
                    {rawLog}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div className="test-connection-modal-footer">
        <Button
          className="test-connection-modal-copy-button"
          data-testid="copy-log-button"
          disabled={!rawLog}
          icon={<Copy01 size={16} />}
          onClick={onCopyToClipBoard}>
          {t('label.copy-log')}
        </Button>
        {isConnectionTimeout ? (
          <Button
            className="test-connection-footer-try-again"
            icon={<RefreshCcw01 size={16} />}
            type="primary"
            onClick={onTestConnection}>
            {t('label.try-again')}
          </Button>
        ) : isTestingConnection ? (
          <Button onClick={onCancel}>{t('label.cancel')}</Button>
        ) : (
          <Button type="primary" onClick={onConfirm}>
            {t('label.done')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default TestConnectionModal;
