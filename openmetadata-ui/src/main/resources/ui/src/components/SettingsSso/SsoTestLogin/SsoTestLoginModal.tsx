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
import {
  Button,
  Dialog,
  Divider,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StageStatus,
  Status,
  TestLoginResult,
} from '../../../generated/system/testLoginResult';
import {
  getConnectionStepIcon,
  getStepStatusLabel,
} from '../../../utils/TestConnectionModalUtils';
import InlineAlert from '../../common/InlineAlert/InlineAlert';
import Loader from '../../common/Loader/Loader';
import {
  ConfigurationCheckState,
  SsoTestLoginModalProps,
} from './SsoTestLogin.interface';
import {
  isTestLoginSettled,
  STAGE_LABEL_KEYS,
  toConnectionStepState,
} from './SsoTestLogin.utils';
import SsoTestLoginCredentialsForm from './SsoTestLoginCredentialsForm';

const TimelineRow = ({
  label,
  messages,
  state,
  testId,
}: {
  label: string;
  messages: string[];
  state: ReturnType<typeof toConnectionStepState>;
  testId: string;
}) => {
  const { t } = useTranslation();

  return (
    <li className="tw:flex tw:items-start tw:gap-3" data-testid={testId}>
      {getConnectionStepIcon(state)}
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
        <Typography as="span" size="text-sm" weight="medium">
          {label}
        </Typography>
        {messages.map((message) => (
          <Typography
            as="span"
            className="tw:break-words tw:text-tertiary"
            key={message}
            size="text-xs">
            {message}
          </Typography>
        ))}
      </div>
      <Typography
        as="span"
        className="tw:shrink-0 tw:text-quaternary"
        size="text-xs">
        {getStepStatusLabel(t, state)}
      </Typography>
    </li>
  );
};

const StageTimeline = ({
  configurationCheck,
  result,
}: {
  configurationCheck?: ConfigurationCheckState;
  result?: TestLoginResult;
}) => {
  const { t } = useTranslation();
  const isSettled = isTestLoginSettled(result);
  // A skipped stage does not apply to this protocol at all, so it is not shown.
  const stages = (result?.stages ?? []).filter(
    (stage) => stage.status !== StageStatus.Skipped
  );

  return (
    <ol
      aria-label={t('label.test-login')}
      className="tw:flex tw:flex-col tw:gap-3"
      data-testid="sso-test-login-stages">
      {configurationCheck && (
        <TimelineRow
          label={t('label.sso-test-stage-configuration-checked')}
          messages={configurationCheck.problems}
          state={toConnectionStepState(configurationCheck.status, true)}
          testId="sso-test-login-stage-configuration"
        />
      )}
      {stages.map((stage) => (
        <TimelineRow
          key={stage.stage}
          label={t(STAGE_LABEL_KEYS[stage.stage])}
          messages={stage.message ? [stage.message] : []}
          state={toConnectionStepState(stage.status, isSettled)}
          testId={`sso-test-login-stage-${stage.stage}`}
        />
      ))}
    </ol>
  );
};

const ResolvedIdentity = ({ result }: { result: TestLoginResult }) => {
  const { t } = useTranslation();
  const domainCheck = result.domainCheck;
  // The domain line matters whenever the rules are on, or whenever they rejected the identity.
  const showDomain =
    !!domainCheck && (domainCheck.enforced || domainCheck.passed === false);

  return (
    <dl
      className="tw:grid tw:grid-cols-[max-content_1fr] tw:gap-x-4 tw:gap-y-1 tw:text-sm"
      data-testid="sso-test-login-details">
      {result.resolvedPrincipal && (
        <>
          <dt className="tw:font-medium">{t('label.user')}</dt>
          <dd>{result.resolvedPrincipal}</dd>
        </>
      )}
      {result.resolvedEmail && (
        <>
          <dt className="tw:font-medium">{t('label.email')}</dt>
          <dd>{result.resolvedEmail}</dd>
        </>
      )}
      {!isEmpty(result.mappedRoles) && (
        <>
          <dt className="tw:font-medium">{t('label.role-plural')}</dt>
          <dd>{result.mappedRoles?.join(', ')}</dd>
        </>
      )}
      {!isEmpty(result.mappedTeams) && (
        <>
          <dt className="tw:font-medium">{t('label.team-plural')}</dt>
          <dd>{result.mappedTeams?.join(', ')}</dd>
        </>
      )}
      {showDomain && (
        <>
          <dt className="tw:font-medium">{t('label.domain')}</dt>
          <dd>
            {domainCheck?.resolvedDomain ?? '-'}{' '}
            {domainCheck?.passed
              ? `(${t('label.success')})`
              : `(${t('label.failed')})`}
          </dd>
        </>
      )}
    </dl>
  );
};

const SsoTestLoginModal = ({
  open,
  isTesting,
  isAwaitingCredentials,
  configurationCheck,
  result,
  error,
  onSubmitCredentials,
  onClose,
}: Readonly<SsoTestLoginModalProps>) => {
  const { t } = useTranslation();

  const outcome = useMemo(() => {
    if (!isTestLoginSettled(result)) {
      return null;
    }
    const isSuccess = result?.status === Status.Success;
    let description = t('message.sso-test-login-failed');
    if (isSuccess) {
      description = t('message.sso-test-login-success', {
        email: result?.resolvedEmail ?? '',
      });
    } else if (!isEmpty(result?.errors)) {
      description = (result?.errors ?? []).join(' ');
    }

    return (
      <InlineAlert
        alertClassName={
          isSuccess ? 'sso-test-login-success' : 'sso-test-login-failed'
        }
        description={description}
        heading={isSuccess ? t('label.success') : t('label.failed')}
        type={isSuccess ? 'success' : 'error'}
      />
    );
  }, [result, t]);

  const isWaiting = isTesting && !isAwaitingCredentials;
  const isCheckingConfiguration =
    configurationCheck?.status === StageStatus.Running;

  return (
    <ModalOverlay isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal>
        <Dialog
          aria-label={t('label.test-login')}
          data-testid="sso-test-login-modal"
          width={560}>
          <div className="tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-4">
            <Typography as="h2" size="text-md" weight="semibold">
              {t('label.test-login')}
            </Typography>
            <Typography as="p" className="tw:text-tertiary" size="text-sm">
              {t('message.sso-test-login-description')}
            </Typography>
            <div aria-live="polite" className="tw:flex tw:flex-col tw:gap-4">
              {error && (
                <InlineAlert
                  alertClassName="sso-test-login-error"
                  description={error}
                  heading={t('label.failed')}
                  type="error"
                />
              )}
              {outcome}
              {isWaiting && (
                <div
                  className="tw:flex tw:items-center tw:gap-3"
                  data-testid="sso-test-login-loading">
                  <Loader size="small" />
                  <Typography as="span" size="text-sm">
                    {isCheckingConfiguration
                      ? t('message.sso-test-login-checking-configuration')
                      : t('message.sso-test-login-waiting')}
                  </Typography>
                </div>
              )}
              {isAwaitingCredentials && (
                <SsoTestLoginCredentialsForm
                  isSubmitting={isTesting}
                  onSubmit={onSubmitCredentials}
                />
              )}
              {(result || configurationCheck) && (
                <StageTimeline
                  configurationCheck={configurationCheck}
                  result={result}
                />
              )}
              {isTestLoginSettled(result) && result && (
                <ResolvedIdentity result={result} />
              )}
            </div>
          </div>
          <Divider />
          <div className="tw:flex tw:justify-end tw:px-5 tw:py-3">
            <Button
              color="secondary"
              data-testid="sso-test-login-close"
              onClick={onClose}>
              {t('label.close')}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default SsoTestLoginModal;
