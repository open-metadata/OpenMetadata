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
  Badge,
  Box,
  Button,
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError, isAxiosError } from 'axios';
import { Operation as PatchOperation } from 'fast-json-patch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  OnboardingPlaybook,
  TargetEntityType,
} from '../../../generated/entity/governance/onboardingPlaybook';
import {
  CheckType,
  OnboardingProgress,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getOnboardingAsset,
  getOnboardingProgress,
  nudgeOnboarding,
  OnboardingAsset,
  patchOnboardingAsset,
  transitionOnboarding,
} from '../../../rest/governance/onboarding/Onboarding.api';
import { getOnboardingPlaybookForEntityType } from '../../../rest/governance/onboarding/OnboardingPlaybook.api';
import { getCustomPropertiesByEntityType } from '../../../rest/metadataTypeAPI';
import {
  fieldValue,
  isRecord,
  STAGE_LABELS,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import {
  blockingProgress,
  isCheckComplete,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { OnboardingJourney } from './OnboardingJourney';
import {
  OnboardingFieldSession,
  OnboardingJourneyHandle,
} from './OnboardingJourney.types';

interface Props {
  entityType: TargetEntityType;
  asset: OnboardingAsset;
  permissions: OperationPermission;
  isVersionView?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export const OnboardingChecklist = ({
  entityType,
  asset,
  permissions,
  isVersionView = false,
  onRefresh,
}: Props) => {
  const { t } = useTranslation();
  const currentUser = useApplicationStore((state) => state.currentUser);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [playbook, setPlaybook] = useState<OnboardingPlaybook | null>(null);
  const [busy, setBusy] = useState(false);
  const [submittedStage, setSubmittedStage] = useState<string>();
  const [expanded, setExpanded] = useState(true);
  // Read off the URL rather than through `useSearchParams`: the checklist is embedded in entity
  // pages that are inside a router, but also rendered bare in tests and previews, and a router hook
  // would make it throw there. The link is only read on arrival, so a subscription buys nothing.
  const [requestedStep] = useState(
    () => new URLSearchParams(window.location.search).get('check') ?? undefined
  );
  const refreshEntity = useRef(onRefresh);
  const request = useRef(0);
  const journey = useRef<OnboardingJourneyHandle>(null);
  useEffect(() => {
    refreshEntity.current = onRefresh;
  }, [onRefresh]);
  const awaitingWorkflow = progress?.steps.some(
    (result) =>
      result.step.type === CheckType.Approval &&
      result.taskId &&
      !result.workflowInstanceId &&
      !isCheckComplete(result)
  );
  const refresh = useCallback(async () => {
    const sequence = ++request.current;
    const result = await getOnboardingProgress(entityType, asset.id);
    if (sequence === request.current) {
      setProgress((current) =>
        journey.current?.isDirty() && current?.stage !== result?.stage
          ? current
          : result
      );
    }

    return result;
  }, [entityType, asset.id]);
  const refreshSafely = useCallback(async () => {
    try {
      await refresh();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [refresh]);
  useEffect(() => {
    if (isVersionView) {
      return;
    }
    let cancelled = false;
    // Fetched next to the progress rather than after it: the wizard needs the playbook's names and
    // gate only to describe what the progress already says, so neither has to wait for the other.
    getOnboardingPlaybookForEntityType(entityType)
      .then((result) => {
        if (!cancelled) {
          setPlaybook(result ?? null);
        }
      })
      .catch(() => !cancelled && setPlaybook(null));

    return () => {
      cancelled = true;
    };
  }, [entityType, isVersionView]);
  useEffect(() => {
    if (isVersionView) {
      return;
    }
    refreshSafely();
    const timer = setInterval(refreshSafely, awaitingWorkflow ? 3000 : 15000);

    return () => {
      clearInterval(timer);
      request.current++;
    };
  }, [refreshSafely, asset.version, isVersionView, awaitingWorkflow]);
  const loadField = useCallback(
    async (fieldPath: string): Promise<OnboardingFieldSession> => {
      const [saved, properties] = await Promise.all([
        getOnboardingAsset(entityType, asset.id),
        fieldPath.startsWith('extension.')
          ? getCustomPropertiesByEntityType(entityType)
          : Promise.resolve([]),
      ]);
      let snapshot = saved;

      return {
        get value() {
          return fieldValue(snapshot, fieldPath);
        },
        properties: properties ?? [],
        save: async (value) => {
          const parts = fieldPath.split('.');
          const path = `/${parts
            .map((part) => part.replaceAll('~', '~0').replaceAll('/', '~1'))
            .join('/')}`;
          const patch: PatchOperation[] = [
            { op: 'test', path: '/version', value: snapshot.version },
          ];
          if (parts.length > 1 && !isRecord(fieldValue(snapshot, parts[0]))) {
            patch.push({ op: 'add', path: `/${parts[0]}`, value: {} });
          }
          patch.push({ op: 'add', path, value: value ?? null });
          snapshot = await patchOnboardingAsset(entityType, asset.id, patch);
          const [updated] = await Promise.all([
            refresh(),
            refreshEntity.current?.(),
          ]);

          return updated?.steps.find(
            (result) => result.step.fieldPath === fieldPath
          );
        },
      };
    },
    [entityType, asset.id, refresh]
  );
  const advance = async () => {
    if (!progress?.nextStage || progress.entityVersion === undefined) {
      return;
    }
    setBusy(true);
    try {
      request.current++;
      const updated = await transitionOnboarding(entityType, asset.id, {
        expectedVersion: progress.entityVersion,
        targetStage: progress.nextStage,
        retry: true,
      });
      request.current++;
      setProgress(updated);
      setSubmittedStage(progress.nextStage);
      await refreshEntity.current?.();
    } catch (error) {
      showErrorToast(error as AxiosError);
      await refreshSafely();
    } finally {
      setBusy(false);
    }
  };
  /**
   * A nudge answers with the refreshed progress, so `Reminder sent` survives a reload. A 429 means
   * the server already sent one inside its cooldown - the same outcome from the producer's side, so
   * it refreshes rather than complains.
   */
  const nudge = async (stepId: string) => {
    try {
      setProgress(await nudgeOnboarding(entityType, asset.id, { stepId }));
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        await refreshSafely();
      } else {
        showErrorToast(error as AxiosError);
      }
    }
  };
  if (!progress || isVersionView) {
    return null;
  }

  return (
    <Card className="tw:my-4" data-testid="onboarding-checklist">
      <Card.Header
        className="tw:flex-wrap"
        extra={
          <Box gap={2} wrap="wrap">
            <Button color="link-gray" href="/onboarding">
              {t('label.onboarding-board')}
            </Button>
            <Button
              color="secondary"
              onPress={() => {
                const toggle = () => setExpanded((value) => !value);
                if (expanded) {
                  journey.current?.confirmNavigation(toggle);
                } else {
                  toggle();
                }
              }}>
              {t(expanded ? 'label.collapse' : 'label.view-details')}
            </Button>
          </Box>
        }
        title={
          <Box align="center" gap={3} wrap="wrap">
            <Typography size="text-lg" weight="semibold">
              {t('label.onboarding')}
            </Typography>
            <Badge
              color={progress.completed ? 'success' : 'brand'}
              data-testid="onboarding-current-stage">
              {t(STAGE_LABELS[progress.stage])}
            </Badge>
            <Typography className="tw:text-tertiary" size="text-sm">
              {t('message.onboarding-progress-count', {
                complete: blockingProgress(progress.steps).complete,
                total: blockingProgress(progress.steps).total,
              })}
            </Typography>
          </Box>
        }
      />
      {expanded && (
        <Card.Content>
          <OnboardingJourney
            advance={advance}
            busy={busy}
            entityType={entityType}
            initialStepId={requestedStep}
            justSubmitted={Boolean(submittedStage)}
            key={`${asset.id}-${progress.stage}`}
            loadField={loadField}
            permissions={permissions}
            playbook={playbook}
            progress={progress}
            ref={journey}
            refresh={refreshSafely}
            submittedStage={submittedStage}
            viewer={currentUser}
            onNudge={nudge}
          />
        </Card.Content>
      )}
    </Card>
  );
};
