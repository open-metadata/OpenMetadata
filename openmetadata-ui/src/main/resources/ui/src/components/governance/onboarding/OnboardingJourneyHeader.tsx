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
  Avatar,
  Box,
  Button,
  Card,
  ProgressBarCircle,
  Typography,
} from '@openmetadata/ui-core-components';
import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Operation } from '../../../generated/entity/policies/policy';
import { OnboardingStepResult } from '../../../generated/governance/onboarding/onboardingProgress';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ONBOARDING_STAGE } from '../../../utils/governance/onboarding/Onboarding.constants';
import { stageLabel } from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  assigneeInitials,
  canSubmitForReview,
  isCreatedByViewer,
  isWaitingForApproval,
  openBlockingMine,
  othersOpenBlocking,
  producerProgress,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { OnboardingJourneyProps } from './OnboardingJourney.types';
import { OnboardingStageBadge } from './OnboardingRowCells';

interface Props
  extends Pick<
    OnboardingJourneyProps,
    | 'progress'
    | 'playbook'
    | 'viewer'
    | 'permissions'
    | 'advance'
    | 'busy'
    | 'renderApprovalActions'
  > {
  steps: OnboardingStepResult[];
}

/** The one-line provenance under the asset's name, with any fragment we cannot state left out. */
const headerSubtitle = (
  progress: OnboardingJourneyProps['progress'],
  playbook: OnboardingJourneyProps['playbook'],
  viewer: OnboardingJourneyProps['viewer'],
  t: (key: string, values?: Record<string, unknown>) => string
) => {
  const domain = progress.domains?.[0];
  const fragments = [
    domain ? t('label.domain-named', { domain: getEntityName(domain) }) : '',
    isCreatedByViewer(progress, viewer) ? t('label.created-by-you') : '',
    playbook
      ? t('message.following-the-playbook', {
          playbook: getEntityName(playbook),
          version: progress.configurationVersion ?? playbook.version,
        })
      : '',
  ];

  return fragments.filter(Boolean).join(' · ');
};

/** What is left before review, counted from the producer's side rather than the gate's. */
const remainingLabel = (
  openMine: number,
  withOthers: number,
  t: (key: string, values?: Record<string, unknown>) => string
) => {
  if (openMine > 0) {
    return t('message.left-before-review', { count: openMine });
  }

  return withOthers > 0
    ? t('message.ready-open-with-other-roles', { count: withOthers })
    : t('label.ready-for-review');
};

/**
 * Who this asset is, how far its producer is through their own share of the work, and the one
 * button that hands it on. The ring counts only blocking checks assigned to the viewer, because
 * that is the only number they can do anything about.
 */
/** The one primary action: submit, send on, or - while a workflow decides - nothing yet. */
const advanceLabel = (
  progress: Props['progress'],
  stages: Props['playbook'] extends infer P
    ? P extends { onboarding?: { stages?: infer S } }
      ? S
      : undefined
    : undefined,
  waitingForApproval: boolean,
  t: TFunction
) => {
  if (waitingForApproval) {
    return t('label.waiting-for-approval');
  }

  return progress.nextStage === ONBOARDING_STAGE.IN_REVIEW
    ? t('label.submit-for-review')
    : t('label.send-to-stage', {
        stage: stageLabel(progress.nextStage ?? '', t, stages),
      });
};

export const OnboardingJourneyHeader = ({
  progress,
  playbook,
  viewer,
  permissions,
  advance,
  busy,
  steps,
  renderApprovalActions,
}: Props) => {
  const { t } = useTranslation();
  const stages = playbook?.onboarding?.stages;
  const name = getEntityName(progress.entity);
  const counts = producerProgress(steps, viewer);
  const openMine = openBlockingMine(steps, viewer).length;
  const withOthers = othersOpenBlocking(steps, viewer).length;
  const flags = getDerivedPermissionFlags(permissions);
  const isEditor = flags.can(Operation.All) || flags.canEditAll;
  // The builder's preview simulates decisions locally, so it only ever offers the transition the
  // server would already allow - asking for one would mean asking a server that has no asset.
  const allowed = renderApprovalActions
    ? Boolean(progress.canAdvance)
    : canSubmitForReview(progress);
  const waitingForApproval =
    !renderApprovalActions && isWaitingForApproval(progress);
  const subtitle = headerSubtitle(progress, playbook, viewer, t);

  return (
    <Card data-testid="onboarding-journey-header">
      <Card.Content>
        <Box align="center" className="tw:gap-4" wrap="wrap">
          <Avatar alt={name} initials={assigneeInitials(name)} size="lg" />
          <Box className="tw:min-w-0 tw:flex-1 tw:gap-1" direction="col">
            <Box align="center" className="tw:gap-2.5" wrap="wrap">
              <Typography as="h2" size="text-lg" weight="semibold">
                {name}
              </Typography>
              <OnboardingStageBadge stage={progress.stage} stages={stages} />
            </Box>
            <Typography className="tw:text-tertiary" size="text-sm">
              {subtitle}
            </Typography>
          </Box>
          <Box align="center" className="tw:gap-3.5" wrap="wrap">
            <ProgressBarCircle
              aria-label={t('label.onboarding-your-checks')}
              max={Math.max(counts.total, 1)}
              size="xxs"
              value={counts.total ? counts.complete : 1}
            />
            <Box className="tw:gap-0.5" direction="col">
              <Typography size="text-sm" weight="semibold">
                {t('message.checks-for-you', {
                  complete: counts.complete,
                  total: counts.total,
                })}
              </Typography>
              <Typography className="tw:text-quaternary" size="text-xs">
                {remainingLabel(openMine, withOthers, t)}
              </Typography>
            </Box>
            {!progress.completed && (
              <Button
                data-testid="onboarding-advance"
                isDisabled={waitingForApproval || !allowed || !isEditor}
                isLoading={busy}
                onPress={advance}>
                {advanceLabel(progress, stages, waitingForApproval, t)}
              </Button>
            )}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
};
