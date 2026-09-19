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
import { CheckCircle } from '@openmetadata/ui-core-components/icons';
import { ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckType } from '../../../generated/governance/onboarding/onboardingProgress';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { stageLabel } from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  journeySteps,
  othersOpenBlocking,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import {
  getGateForStage,
  getNextStage,
} from '../../../utils/governance/playbooks/Playbook.utils';
import { OnboardingJourneyProps } from './OnboardingJourney.types';

type Props = Pick<
  OnboardingJourneyProps,
  'progress' | 'playbook' | 'viewer' | 'entityType' | 'submittedStage'
>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until a due date, never negative - an overdue task is still "due in 0 days". */
const daysUntil = (dueDate: number) =>
  Math.max(0, Math.ceil((dueDate - Date.now()) / DAY_MS));

const SummaryRow = ({
  children,
  badge,
  color,
}: {
  children: ReactNode;
  badge: string;
  color: 'brand' | 'warning' | 'gray';
}) => (
  <Box
    align="center"
    className="tw:gap-3 tw:border-t tw:border-secondary tw:py-3">
    <Typography className="tw:flex-1" size="text-sm">
      {children}
    </Typography>
    <Badge color={color} size="sm" type="pill-color">
      {badge}
    </Badge>
  </Box>
);

/**
 * What the producer handed over and what happens next, so the hand-off ends with an answer rather
 * than a spinner: who has to act, what is still open with other roles, and what the next gate will
 * ask for.
 */
export const OnboardingJourneySubmitted = ({
  progress,
  playbook,
  viewer,
  entityType,
  submittedStage,
}: Props) => {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const configuration = playbook?.onboarding;
  const stages = configuration?.stages;
  const reachedStage = submittedStage ?? progress.stage;
  const steps = journeySteps(progress);
  const approval = steps.find(
    (result) => result.step.type === CheckType.Approval
  );
  const approvers = approval?.assignees?.map(getEntityName).join(', ');
  const others = othersOpenBlocking(steps, viewer).filter(
    (result) => result.step.type !== CheckType.Approval
  );
  const handoff = getGateForStage(configuration, reachedStage)?.handoffWorkflow;
  const nextStage = getNextStage(configuration, reachedStage);
  const nextGateChecks = nextStage
    ? getGateForStage(configuration, reachedStage)?.steps?.length ?? 0
    : 0;

  return (
    <Card
      className="tw:w-full tw:min-w-0 tw:flex-1"
      data-testid="onboarding-submitted"
      variant="elevated">
      <Card.Content>
        <Box className="tw:gap-3" direction="col">
          <Box align="center" className="tw:gap-3">
            <CheckCircle className="tw:text-fg-success-primary" size={24} />
            <h3
              className="tw:m-0 tw:text-xl tw:font-semibold tw:text-primary"
              ref={heading}
              tabIndex={-1}>
              {t('label.sent-to-stage', {
                stage: stageLabel(reachedStage, t, stages),
              })}
            </h3>
          </Box>
          <Typography className="tw:text-tertiary" size="text-sm">
            {t('message.met-every-blocking-check', {
              entity: getEntityName(progress.entity),
              playbook: playbook
                ? getEntityName(playbook)
                : t('label.playbook'),
            })}
          </Typography>
          <Box className="tw:mt-2" direction="col">
            {approvers ? (
              <SummaryRow
                badge={
                  approval?.dueDate
                    ? t('message.due-in-days', {
                        count: daysUntil(approval.dueDate),
                      })
                    : t('label.open')
                }
                color="brand">
                {t('message.approval-task-created-for', {
                  assignees: approvers,
                })}
              </SummaryRow>
            ) : (
              handoff && (
                <SummaryRow badge={t('label.open')} color="brand">
                  {t('message.workflow-started', {
                    workflow: getEntityName(handoff),
                  })}
                </SummaryRow>
              )
            )}
            <SummaryRow badge={t('label.open-task-plural')} color="warning">
              {others.length
                ? t('message.checks-stay-open-with', {
                    count: others.length,
                    people: others
                      .flatMap((result) => result.assignees ?? [])
                      .map(getEntityName)
                      .join(', '),
                  })
                : t('message.nothing-left-with-other-roles')}
            </SummaryRow>
            {nextStage && (
              <SummaryRow badge={t('label.queued')} color="gray">
                {t('message.next-gate-checks-before-stage', {
                  count: nextGateChecks,
                  stage: stageLabel(nextStage.key, t, stages),
                })}
              </SummaryRow>
            )}
          </Box>
          <Box className="tw:mt-3">
            <Button
              data-testid="onboarding-see-board"
              href={`/onboarding?entityType=${entityType}`}>
              {t('label.see-the-onboarding-board')}
            </Button>
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
};
