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
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import { XClose } from '@untitledui/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconTimeOut } from '../../../../assets/svg/ic-time-out.svg';
import { ReactComponent as IconTimeOutButton } from '../../../../assets/svg/ic-timeout-button.svg';
import { TEST_CONNECTION_FAILURE_MESSAGE } from '../../../../constants/Services.constant';
import { TestConnectionStep } from '../../../../generated/entity/services/connections/testConnectionDefinition';
import { useClipboard } from '../../../../hooks/useClipBoard';
import { getServiceLogo } from '../../../../utils/EntityDisplayUtils';
import {
  ConnectionCapabilitySection,
  ConnectionFooterActions,
  ConnectionGateCard,
  ConnectionRawLogSection,
  ConnectionStatusBanner,
  getConnectionTimeoutMessage,
  getGateDescription,
} from '../../../../utils/TestConnectionModalUtils';
import { partitionConnectionSteps } from '../../../../utils/TestConnectionUtils';
import InlineAlert from '../../InlineAlert/InlineAlert';
import { TestConnectionModalProps } from './TestConnectionModal.interface';

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
    !isTestingConnection && gateResult !== undefined && !gateResult.passed;

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

  const serviceLogo = useMemo(
    () =>
      connectionType
        ? getServiceLogo(connectionType, 'tw:size-7 tw:object-contain')
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
  const gateDescription = gateStep
    ? getGateDescription(t, gateResult, gateStep)
    : '';

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
    <ModalOverlay
      className="tw:z-1100"
      isOpen={isOpen}
      onOpenChange={(open) => !open && handleModalClose()}>
      <Modal>
        <Dialog
          aria-label={t('label.connection-status')}
          className="test-connection-status-modal"
          width={920}>
          <div className="tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-primary tw:px-6 tw:pt-5 tw:pb-4">
            <div className="tw:flex tw:size-11 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border tw:border-primary tw:bg-primary tw:shadow-xs">
              {serviceLogo}
            </div>
            <div className="tw:min-w-0 tw:flex-1">
              <div className="tw:text-lg tw:font-medium tw:text-primary">
                {t('label.connection-status')}
              </div>
              <div className="tw:overflow-hidden tw:text-sm tw:text-quaternary tw:text-ellipsis tw:whitespace-nowrap">
                {connectionDisplayName}
              </div>
            </div>
            <Button
              className="tw:flex tw:size-9 tw:items-center tw:justify-center tw:text-quaternary"
              color="tertiary"
              data-testid="test-connection-close"
              iconLeading={<XClose size={18} />}
              size="sm"
              onClick={handleModalClose}
            />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-4 tw:bg-primary tw:px-6 tw:py-5">
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
                className="tw:flex tw:w-full tw:flex-col tw:items-center tw:justify-center tw:gap-4 tw:rounded-xl tw:border tw:border-primary tw:bg-primary tw:p-12 tw:text-center"
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
                <ConnectionStatusBanner
                  isFailed={isFailed}
                  isSuccessful={isSuccessful}
                  isTestingConnection={isTestingConnection}
                  isWarning={isWarning}
                  passedCount={passedCount}
                  progressPercent={progressPercent}
                  t={t}
                  totalCount={totalCount}
                />

                {gateStep && (
                  <ConnectionGateCard
                    gateDescription={gateDescription}
                    gateResult={gateResult}
                    isGateExpanded={isGateExpanded}
                    t={t}
                    onToggleGate={() =>
                      setIsGateExpanded((current) => !current)
                    }
                  />
                )}

                <ConnectionCapabilitySection
                  capabilitySteps={capabilitySteps}
                  connectionFailed={connectionFailed}
                  expandedStepName={expandedStepName}
                  gateStepName={gateStep?.name}
                  getConnectionStepResult={getConnectionStepResult}
                  setExpandedStepName={setExpandedStepName}
                  setHasUserCollapsedSteps={setHasUserCollapsedSteps}
                  t={t}
                />

                <ConnectionRawLogSection
                  rawLog={rawLog}
                  rawLogLineCount={rawLogLineCount}
                  setShowRawLog={setShowRawLog}
                  showRawLog={showRawLog}
                  t={t}
                />
              </>
            )}
          </div>
          <div className="test-connection-modal-footer tw:flex tw:items-center tw:justify-end tw:gap-2.5 tw:border-t tw:border-primary tw:bg-primary tw:px-6 tw:pt-4 tw:pb-5">
            <ConnectionFooterActions
              isConnectionTimeout={isConnectionTimeout}
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
