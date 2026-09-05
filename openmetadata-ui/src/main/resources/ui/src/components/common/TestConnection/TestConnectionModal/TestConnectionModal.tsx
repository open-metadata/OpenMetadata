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
  Button,
  Dialog,
  Divider,
  Modal,
  ModalOverlay,
  ProgressBarBase,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { TFunction } from 'i18next';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTimeOut } from '../../../../assets/svg/ic-time-out.svg';
import { ReactComponent as IconTimeOutButton } from '../../../../assets/svg/ic-timeout-button.svg';
import { TEST_CONNECTION_FAILURE_MESSAGE } from '../../../../constants/Services.constant';
import {
  Status,
  TestConnectionStepResult,
} from '../../../../generated/entity/automations/workflow';
import { TestConnectionStep } from '../../../../generated/entity/services/connections/testConnectionDefinition';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { getServiceLogo } from '../../../../utils/EntityDisplayUtils';
import {
  ConnectionCapabilitySection,
  ConnectionFooterActions,
  ConnectionGateCard,
  ConnectionRawLogSection,
  ConnectionRemediationCard,
  ConnectionStatusBanner,
  getConnectionTimeoutMessage,
  getGateDescription,
} from '../../../../utils/TestConnectionModalUtils';
import { partitionConnectionSteps } from '../../../../utils/TestConnectionUtils';
import InlineAlert from '../../InlineAlert/InlineAlert';
import { TestConnectionModalProps } from './TestConnectionModal.interface';

const resolveGateResult = (
  gateStep: TestConnectionStep | undefined,
  getConnectionStepResult: (
    step: TestConnectionStep
  ) => TestConnectionStepResult | undefined
) => (gateStep ? getConnectionStepResult(gateStep) : undefined);

const resolveProgressPercent = (
  totalCount: number,
  completedCount: number,
  progress: number
): number =>
  totalCount
    ? Math.min(
        100,
        Math.max(progress, Math.round((completedCount / totalCount) * 100))
      )
    : progress;

/**
 * Gate failed either because the gate step itself failed, or because the API
 * errored before the workflow ran (no step results at all but test is done).
 */
const resolveConnectionFailed = (
  isTestingConnection: boolean,
  isFailed: boolean,
  gateResult: TestConnectionStepResult | undefined
): boolean => {
  const gateStepFailed = gateResult !== undefined && !gateResult.passed;
  const failedWithoutGate = isFailed && gateResult === undefined;

  return !isTestingConnection && (gateStepFailed || failedWithoutGate);
};

interface ConnectionCompletionState {
  canProceed: boolean;
  connectionFailed: boolean;
  isComplete: boolean;
  isFailed: boolean;
  isSuccessful: boolean;
  isWarning: boolean;
}

const resolveConnectionCompletionState = (
  isTestingConnection: boolean,
  progress: number,
  areRequiredStepsPassing: boolean,
  hasOptionalFailures: boolean,
  gateResult: TestConnectionStepResult | undefined
): ConnectionCompletionState => {
  const isComplete = !isTestingConnection && progress >= 100;
  const canProceed = isComplete && areRequiredStepsPassing;
  const isSuccessful = canProceed && !hasOptionalFailures;
  const isWarning = canProceed && hasOptionalFailures;
  const isFailed = isComplete && !areRequiredStepsPassing;
  const connectionFailed = resolveConnectionFailed(
    isTestingConnection,
    isFailed,
    gateResult
  );

  return {
    isComplete,
    canProceed,
    isSuccessful,
    isWarning,
    isFailed,
    connectionFailed,
  };
};

const getRawLogLineCount = (rawLog: string): number =>
  rawLog ? rawLog.split('\n').filter((line) => line.trim()).length : 0;

const resolveShowGateCard = (
  gateStep: TestConnectionStep | undefined,
  isFailed: boolean
): boolean => Boolean(gateStep) && !isFailed;

const resolveShowRemediationCard = (
  isComplete: boolean,
  isFailed: boolean
): boolean => isComplete && isFailed;

const resolveGateDescription = (
  t: TFunction,
  gateStep: TestConnectionStep | undefined,
  gateResult: TestConnectionStepResult | undefined
): string => (gateStep ? getGateDescription(t, gateResult, gateStep) : '');

const TestConnectionModal = ({
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
}: Readonly<TestConnectionModalProps>) => {
  const { t } = useTranslation();

  const [showRawLog, setShowRawLog] = useState(false);
  const [expandedStepNames, setExpandedStepNames] = useState<string[]>([]);
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

  const gateResult = resolveGateResult(gateStep, getConnectionStepResult);

  const completedCount = useMemo(
    () =>
      testConnectionStepResult.filter(
        (result) =>
          result.status !== Status.Running && result.status !== Status.Queued
      ).length,
    [testConnectionStepResult]
  );

  const totalCount = testConnectionStep.length;

  const capabilityPassedCount = useMemo(
    () =>
      capabilitySteps.filter((step) => getConnectionStepResult(step)?.passed)
        .length,
    [capabilitySteps, getConnectionStepResult]
  );

  const capabilityTotalCount = capabilitySteps.length;
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

  const progressPercent = resolveProgressPercent(
    totalCount,
    completedCount,
    progress
  );

  const { isComplete, isSuccessful, isWarning, isFailed, connectionFailed } =
    resolveConnectionCompletionState(
      isTestingConnection,
      progress,
      areRequiredStepsPassing,
      hasOptionalFailures,
      gateResult
    );

  const rawLog = useMemo(
    () =>
      testConnectionStepResult
        .map((result) => {
          const parts: string[] = [];
          if (result.executedCommand) {
            parts.push(`> ${result.executedCommand}`);
          }
          const summary = result.resultSummary || result.message;
          if (summary) {
            const timing = result.durationMs
              ? ` (${result.durationMs} ms)`
              : '';
            parts.push(`  ${summary}${timing}`);
          }
          if (result.errorLog) {
            parts.push(result.errorLog);
          }
          if (result.diagnosis) {
            parts.push(
              [
                result.diagnosis.title,
                result.diagnosis.remediation,
                result.diagnosis.docUrl,
              ]
                .filter(Boolean)
                .join('\n')
            );
          }

          return parts.join('\n');
        })
        .filter(Boolean)
        .join('\n\n')
        .trim(),
    [testConnectionStepResult]
  );

  const { onCopyToClipBoard } = useClipboard(rawLog);
  const rawLogLineCount = getRawLogLineCount(rawLog);

  const serviceLogo = useMemo(
    () =>
      connectionType
        ? getServiceLogo(connectionType, 'tw:size-5 tw:object-contain')
        : null,
    [connectionType]
  );

  const handleModalClose = () => {
    if (isTestingConnection) {
      onCancel();
    } else {
      onConfirm();
    }
  };

  const message = getConnectionTimeoutMessage(t, serviceType, hostIp);
  const gateDescription = resolveGateDescription(t, gateStep, gateResult);
  const showGateCard = resolveShowGateCard(gateStep, isFailed);
  const showRemediationCard = resolveShowRemediationCard(isComplete, isFailed);

  useEffect(() => {
    if (isTestingConnection) {
      setIsGateExpanded(true);

      return;
    }

    if (gateResult?.passed) {
      setIsGateExpanded(false);
    }
  }, [gateResult?.passed, isTestingConnection]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleModalClose()}>
      <Modal>
        <Dialog
          aria-label={t('label.connection-status')}
          data-testid="test-connection-status-modal"
          width={680}>
          <div className="tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-primary tw:px-5 tw:py-4">
            <div className="tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-primary tw:bg-primary tw:shadow-xs">
              {serviceLogo}
            </div>
            <div className="tw:min-w-0 tw:flex-1">
              <div className="tw:text-md tw:font-bold tw:text-primary tw:leading-5">
                {t('label.connection-status')}
              </div>
              <div className="tw:overflow-hidden tw:text-xs tw:text-quaternary tw:text-ellipsis tw:whitespace-nowrap tw:leading-4">
                {connectionDisplayName}
              </div>
            </div>
            <Button
              className="tw:flex tw:size-9 tw:items-center tw:justify-center tw:text-fg-quaternary"
              color="tertiary"
              data-testid="test-connection-close"
              iconLeading={<XClose size={20} />}
              size="xs"
              onClick={handleModalClose}
            />
          </div>
          <div className="tw:flex tw:flex-col tw:bg-primary">
            {errorMessage && (
              <div className="tw:px-5 tw:pt-4">
                <InlineAlert
                  description={errorMessage.description}
                  heading={t(TEST_CONNECTION_FAILURE_MESSAGE)}
                  type="error"
                  onClose={handleCloseErrorMessage}
                />
              </div>
            )}

            {isConnectionTimeout ? (
              <div
                className="tw:flex tw:w-full tw:flex-col tw:items-center tw:justify-center tw:gap-4 tw:rounded-xl tw:bg-primary tw:p-5 tw:text-center"
                data-testid="test-connection-timeout-widget">
                <IconTimeOut height={100} width={100} />
                <div className="tw:text-base tw:font-medium tw:leading-6 tw:text-primary">
                  {t('label.connection-timeout')}
                </div>
                <div className="tw:max-w-[520px] tw:text-sm tw:leading-5 tw:text-quaternary">
                  {message}
                </div>
                <Button
                  className="tw:flex tw:items-center tw:gap-1.5"
                  color="primary"
                  data-testid="try-again-button"
                  iconLeading={<IconTimeOutButton height={14} width={14} />}
                  size="sm"
                  onClick={onTestConnection}>
                  {t('label.try-again')}
                </Button>
              </div>
            ) : (
              <>
                <div className="tw:flex tw:flex-col tw:gap-4 tw:bg-primary tw:px-5 tw:py-4">
                  <ConnectionStatusBanner
                    gateResult={gateResult}
                    isFailed={isFailed}
                    isSuccessful={isSuccessful}
                    isTestingConnection={isTestingConnection}
                    isWarning={isWarning}
                    passedCount={capabilityPassedCount}
                    progressPercent={progressPercent}
                    t={t}
                    totalCount={capabilityTotalCount}
                  />

                  {isTestingConnection && (
                    <ProgressBarBase value={progressPercent} />
                  )}
                </div>

                <Divider />
                <div className="tw:flex tw:flex-col tw:gap-4 tw:bg-primary tw:px-5 tw:py-4">
                  {showGateCard && (
                    <ConnectionGateCard
                      gateDescription={gateDescription}
                      gateResult={gateResult}
                      isFailed={isFailed}
                      isGateExpanded={isGateExpanded}
                      isTestingConnection={isTestingConnection}
                      t={t}
                      onToggleGate={() =>
                        setIsGateExpanded((current) => !current)
                      }
                    />
                  )}

                  {showRemediationCard && (
                    <ConnectionRemediationCard
                      capabilitySteps={capabilitySteps}
                      connectionFailed={connectionFailed}
                      gateResult={gateResult}
                      getConnectionStepResult={getConnectionStepResult}
                      t={t}
                    />
                  )}

                  <ConnectionCapabilitySection
                    capabilitySteps={capabilitySteps}
                    connectionFailed={connectionFailed}
                    expandedStepNames={expandedStepNames}
                    gateResult={gateResult}
                    gateStepName={gateStep?.name}
                    getConnectionStepResult={getConnectionStepResult}
                    isTestingConnection={isTestingConnection}
                    setExpandedStepNames={setExpandedStepNames}
                    t={t}
                  />

                  <ConnectionRawLogSection
                    rawLog={rawLog}
                    rawLogLineCount={rawLogLineCount}
                    setShowRawLog={setShowRawLog}
                    showRawLog={showRawLog}
                    t={t}
                    testConnectionStepResult={testConnectionStepResult}
                  />
                </div>
              </>
            )}
          </div>
          <div className="test-connection-modal-footer tw:flex tw:items-center tw:justify-end tw:gap-2.5 tw:border-t tw:border-primary tw:bg-primary tw:px-6 tw:pt-4 tw:pb-5">
            <ConnectionFooterActions
              isConnectionTimeout={isConnectionTimeout}
              isFailed={isFailed}
              isTestingConnection={isTestingConnection}
              rawLog={rawLog}
              t={t}
              onCancel={onCancel}
              onConfirm={onConfirm}
              onCopyToClipBoard={() => onCopyToClipBoard()}
              onTestConnection={onTestConnection}
            />
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default TestConnectionModal;
