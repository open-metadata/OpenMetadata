/*
 *  Copyright 2026 Collate.
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
  Alert,
  Box,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import { OnboardingBackfill } from '../../../generated/governance/onboarding/onboardingBackfill';
import {
  getOnboardingBackfill,
  retryOnboardingBackfill,
} from '../../../rest/governance/onboarding/Onboarding.api';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

/** Which assets the backfill could not enrol, so an admin can correct them and retry. */
const BackfillFailures = ({
  failures,
}: {
  failures: NonNullable<OnboardingBackfill['failures']>;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Alert
        title={t('message.onboarding-backfill-failures')}
        variant="warning"
      />
      {failures.map((failure) => (
        <Typography key={failure.entity?.id} size="text-xs">
          {failure.entity && getEntityName(failure.entity)}: {failure.message}
        </Typography>
      ))}
    </>
  );
};

/** How far the enrolment sweep has got, and whether it has finished. */
const BackfillProgressLine = ({
  progress,
}: {
  progress: OnboardingBackfill;
}) => {
  const { t } = useTranslation();

  return (
    <Typography className="tw:text-tertiary" size="text-xs">
      {t('message.onboarding-backfill-progress', {
        enrolled: progress.enrolled ?? 0,
        scanned: progress.scanned ?? 0,
      })}{' '}
      {progress.complete ? t('label.completed') : ''}
    </Typography>
  );
};

/**
 * The one recovery action a stuck backfill has. It reloads when the status itself could not be
 * read, and re-runs the enrolment when the status says some assets failed.
 */
const BackfillRetryButton = ({
  entityType,
  loadFailed,
  onRefresh,
  onProgress,
}: {
  entityType: TargetEntityType;
  loadFailed: boolean;
  onRefresh: () => Promise<void>;
  onProgress: (progress: OnboardingBackfill) => void;
}) => {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  return (
    <Button
      color="secondary"
      isLoading={pending}
      onPress={async () => {
        setPending(true);
        try {
          if (loadFailed) {
            await onRefresh();
          } else {
            onProgress(await retryOnboardingBackfill(entityType));
          }
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setPending(false);
        }
      }}>
      {t('label.retry')}
    </Button>
  );
};

export const OnboardingBackfillStatus = ({
  entityType,
}: {
  entityType: TargetEntityType;
}) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<OnboardingBackfill | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setProgress(await getOnboardingBackfill(entityType));
      setLoadFailed(false);
    } catch (error) {
      setLoadFailed(true);
      showErrorToast(error as AxiosError);
    }
  }, [entityType]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);

    return () => clearInterval(timer);
  }, [refresh]);
  // Nothing to report is the normal state for a playbook nobody just published, and an empty
  // status line under every row would read as a problem where there is none.
  if (!loadFailed && !progress) {
    return null;
  }
  const hasFailures = Boolean(progress?.failures?.length);

  return (
    <Box
      className="tw:mt-2 tw:gap-2"
      data-testid={`onboarding-backfill-${entityType}`}
      direction="col">
      {loadFailed && (
        <Alert title={t('server.unexpected-error')} variant="error" />
      )}
      {progress && <BackfillProgressLine progress={progress} />}
      {hasFailures && <BackfillFailures failures={progress?.failures ?? []} />}
      {(loadFailed || hasFailures) && (
        <BackfillRetryButton
          entityType={entityType}
          loadFailed={loadFailed}
          onProgress={setProgress}
          onRefresh={refresh}
        />
      )}
    </Box>
  );
};
