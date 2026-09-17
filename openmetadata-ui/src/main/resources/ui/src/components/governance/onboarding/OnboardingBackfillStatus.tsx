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

export const OnboardingBackfillStatus = ({
  entityType,
}: {
  entityType: TargetEntityType;
}) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<OnboardingBackfill | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const refresh = useCallback(async () => {
    setPending(true);
    try {
      setProgress(await getOnboardingBackfill(entityType));
      setLoadFailed(false);
    } catch (error) {
      setLoadFailed(true);
      showErrorToast(error as AxiosError);
    } finally {
      setPending(false);
    }
  }, [entityType]);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);

    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <Box
      className="tw:mt-2 tw:gap-2"
      data-testid={`onboarding-backfill-${entityType}`}
      direction="col">
      {loadFailed && (
        <Alert title={t('server.unexpected-error')} variant="error" />
      )}
      {progress && (
        <Typography className="tw:text-tertiary" size="text-xs">
          {t('message.onboarding-backfill-progress', {
            enrolled: progress?.enrolled ?? 0,
            scanned: progress?.scanned ?? 0,
          })}{' '}
          {progress?.complete && t('label.completed')}
        </Typography>
      )}
      {Boolean(progress?.failures?.length) && (
        <>
          <Alert
            title={t('message.onboarding-backfill-failures')}
            variant="warning"
          />
          {progress?.failures?.map((failure) => (
            <Typography key={failure.entity?.id} size="text-xs">
              {failure.entity && getEntityName(failure.entity)}:{' '}
              {failure.message}
            </Typography>
          ))}
        </>
      )}
      {(loadFailed || Boolean(progress?.failures?.length)) && (
        <Button
          color="secondary"
          isLoading={pending}
          onPress={async () => {
            if (loadFailed) {
              await refresh();

              return;
            }
            setPending(true);
            try {
              setProgress(await retryOnboardingBackfill(entityType));
            } catch (error) {
              showErrorToast(error as AxiosError);
            } finally {
              setPending(false);
            }
          }}>
          {t('label.retry')}
        </Button>
      )}
    </Box>
  );
};
