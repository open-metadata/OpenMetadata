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
  Badge,
  Box,
  ProgressBar,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NO_DATA } from '../../../constants/constants';
import { OnboardingStageDefinition } from '../../../generated/entity/governance/onboardingPlaybook';
import { OnboardingStepResult } from '../../../generated/governance/onboarding/onboardingProgress';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ONBOARDING_STAGE } from '../../../utils/governance/onboarding/Onboarding.constants';
import {
  formatAge,
  stageLabel,
} from '../../../utils/governance/onboarding/OnboardingField.utils';
import { assigneeInitials } from '../../../utils/governance/onboarding/OnboardingJourney.utils';

/**
 * How far along a stage reads: neutral while the asset is still being worked on, brand once it is
 * with a reviewer, success once it has been accepted.
 */
const STAGE_TONE: Record<string, 'gray' | 'brand' | 'success'> = {
  [ONBOARDING_STAGE.CREATION]: 'gray',
  [ONBOARDING_STAGE.DRAFT]: 'gray',
  [ONBOARDING_STAGE.IN_REVIEW]: 'brand',
  [ONBOARDING_STAGE.APPROVED]: 'success',
  [ONBOARDING_STAGE.PUBLISHED]: 'success',
  [ONBOARDING_STAGE.DEPRECATED]: 'gray',
};

export const OnboardingStageBadge = ({
  stage,
  stages,
}: {
  stage: string;
  stages?: OnboardingStageDefinition[];
}) => {
  const { t } = useTranslation();

  return (
    <Badge color={STAGE_TONE[stage] ?? 'gray'} size="sm" type="pill-color">
      {stageLabel(stage, t, stages)}
    </Badge>
  );
};

/**
 * How long the asset has sat where it is. A late one is stated in red so the board reads as a queue
 * of things to chase rather than a list of dates.
 */
export const OnboardingAgeCell = ({
  timestamp,
  isLate,
  testId,
}: {
  timestamp?: number;
  isLate?: boolean;
  testId?: string;
}) => {
  const { t, i18n } = useTranslation();
  const age = formatAge(timestamp, i18n.language, t('label.just-now'));

  return (
    <Typography
      className={isLate ? 'tw:text-error-primary' : 'tw:text-tertiary'}
      data-testid={testId}
      size="text-sm"
      weight={isLate ? 'semibold' : 'regular'}>
      {age ?? NO_DATA}
    </Typography>
  );
};

/** Blocking checks done out of blocking checks asked for, amber once the asset is running late. */
export const OnboardingProgressCell = ({
  complete,
  total,
  isLate,
}: {
  complete: number;
  total: number;
  isLate?: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:min-w-32 tw:gap-1.5" direction="col">
      <ProgressBar
        aria-label={t('label.playbook-progress')}
        className="tw:h-1.5"
        max={Math.max(total, 1)}
        progressClassName={isLate ? 'tw:bg-fg-warning-primary' : undefined}
        value={total ? complete : 1}
      />
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('message.steps-of-total', { complete, count: total })}
      </Typography>
    </Box>
  );
};

/**
 * Who the asset is waiting on and for what. The check links to its task so the board is one click
 * from the thing that is actually blocked, rather than from the asset that is merely stuck.
 */
export const OnboardingWaitingOnCell = ({
  step,
}: {
  step?: OnboardingStepResult;
}) => {
  const { t } = useTranslation();
  const people = step?.assignees?.map(getEntityName).join(', ');

  if (!step) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {NO_DATA}
      </Typography>
    );
  }

  const title = step.step.title ?? step.step.id;

  return (
    <Box align="center" className="tw:min-w-0 tw:gap-2">
      <Avatar
        alt={people || t('label.unassigned')}
        initials={assigneeInitials(people || t('label.unassigned'))}
        size="xs"
      />
      <Box className="tw:min-w-0" direction="col">
        <Typography size="text-sm">
          {people || t('label.unassigned')}
        </Typography>
        <Typography className="tw:text-quaternary" size="text-xs">
          {step.taskId ? (
            <Link to={`/tasks/${step.taskId}`}>
              {t('label.waiting-for-check', { check: title })}
            </Link>
          ) : (
            t('label.waiting-for-check', { check: title })
          )}
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * What this asset needs next, from the viewer's point of view.
 *
 * <p>The producer sees their own open check as an invitation into the guided setup; anyone else
 * sees whose desk it is on, so a list never asks someone to chase work that is not theirs.
 */
export const OnboardingNextStepCell = ({
  mine,
  waiting,
  to,
}: {
  mine?: OnboardingStepResult;
  waiting?: OnboardingStepResult;
  to: string;
}) => {
  const { t } = useTranslation();

  if (mine) {
    return (
      <Link
        className="tw:text-sm tw:font-semibold tw:text-brand-secondary"
        data-testid="continue-setup"
        to={`${to}?check=${encodeURIComponent(mine.step.id)}`}>
        {t('label.continue-setup')}
      </Link>
    );
  }

  if (waiting) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('label.waiting-for-check', {
          check: waiting.step.title ?? waiting.step.id,
        })}
      </Typography>
    );
  }

  return (
    <Typography className="tw:text-tertiary" size="text-sm">
      {NO_DATA}
    </Typography>
  );
};
