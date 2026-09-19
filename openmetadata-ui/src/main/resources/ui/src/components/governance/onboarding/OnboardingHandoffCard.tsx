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
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Role } from '../../../generated/entity/governance/onboardingPlaybook';
import {
  CheckType,
  OnboardingStepResult,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { describeRule } from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  isCheckComplete,
  wasRemindedRecently,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { getWorkflowDefinitionDetailPath } from '../../../utils/WorkflowRouterUtils';

interface Props {
  result: OnboardingStepResult;
  /** Undefined when the wizard cannot nudge - a preview, or a check with no task behind it. */
  onNudge?: (stepId: string) => Promise<void>;
  children?: ReactNode;
}

const DetailRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <Box
    align="center"
    className="tw:gap-2.5 tw:border-t tw:border-secondary tw:py-2.5">
    <Typography className="tw:flex-1 tw:text-tertiary" size="text-sm">
      {label}
    </Typography>
    {children}
  </Box>
);

/** The one action the producer has on someone else's check, and only while it can still land. */
const NudgeButton = ({
  result,
  onNudge,
}: {
  result: OnboardingStepResult;
  onNudge: (stepId: string) => Promise<void>;
}) => {
  const { t } = useTranslation();
  const [isNudging, setNudging] = useState(false);
  const reminded = wasRemindedRecently(result);

  return (
    <Button
      color="secondary"
      data-testid="onboarding-nudge"
      isDisabled={reminded || isNudging}
      isLoading={isNudging}
      size="sm"
      onPress={async () => {
        setNudging(true);
        try {
          await onNudge(result.step.id);
        } finally {
          setNudging(false);
        }
      }}>
      {t(reminded ? 'label.reminder-sent' : 'label.send-a-reminder')}
    </Button>
  );
};

const belongsToKey = (required: boolean, isExplicit: boolean) => {
  if (isExplicit) {
    return required
      ? 'message.check-belongs-to-blocking-explicit'
      : 'message.check-belongs-to-explicit';
  }

  return required
    ? 'message.check-belongs-to-blocking'
    : 'message.check-belongs-to';
};

/** Where the check stands, in the three facts the producer asks for. */
const HandoffFacts = ({
  result,
  person,
  roleLabel,
}: {
  result: OnboardingStepResult;
  person: string;
  roleLabel: string;
}) => {
  const { t } = useTranslation();
  const rule = describeRule(result.step);
  const complete = isCheckComplete(result);

  return (
    <Box direction="col">
      <DetailRow label={t('label.assigned-to')}>
        <Box align="center" className="tw:gap-1" wrap="wrap">
          <Typography size="text-sm" weight="semibold">
            {person || t('label.unassigned')}
          </Typography>
          {roleLabel && (
            <Typography className="tw:text-tertiary" size="text-sm">
              {`· ${roleLabel}`}
            </Typography>
          )}
        </Box>
      </DetailRow>
      <DetailRow label={t('label.they-are-asked-for')}>
        <Typography size="text-sm" weight="semibold">
          {t(rule.key, { count: rule.count })}
        </Typography>
      </DetailRow>
      <DetailRow label={t('label.status')}>
        <Badge
          color={complete ? 'success' : 'warning'}
          size="sm"
          type="pill-color">
          {t(complete ? 'label.complete' : 'label.open-task')}
        </Badge>
      </DetailRow>
    </Box>
  );
};

/** The task and the workflow behind the check, for anyone who wants the detail. */
const HandoffLinks = ({ result }: { result: OnboardingStepResult }) => {
  const { t } = useTranslation();
  const workflow = result.step.workflow;

  return (
    <Box className="tw:gap-2" wrap="wrap">
      {result.taskId && (
        <Button color="secondary" href={`/tasks/${result.taskId}`}>
          {t('label.view-task')}
        </Button>
      )}
      {workflow?.fullyQualifiedName && (
        <Button
          color="link-color"
          href={getWorkflowDefinitionDetailPath(workflow.fullyQualifiedName)}>
          {getEntityName(workflow)}
        </Button>
      )}
      {result.step.type === CheckType.Approval && (
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.onboarding-workflow-assignment')}
        </Typography>
      )}
      {result.workflowInstanceId && (
        <Typography className="tw:break-all tw:text-tertiary" size="text-xs">
          {t('message.onboarding-workflow-evidence', {
            id: result.workflowInstanceId,
          })}
        </Typography>
      )}
    </Box>
  );
};

/**
 * A check that belongs to someone else. The producer cannot do it and does not have to wait for it
 * unless it blocks the gate, so the card says which of the two it is and offers the one action they
 * do have: a reminder.
 */
export const OnboardingHandoffCard = ({ result, onNudge, children }: Props) => {
  const { t } = useTranslation();
  const assignees = result.assignees ?? [];
  const person = assignees.map(getEntityName).join(', ');
  const role = result.step.assignment?.role ?? Role.Creator;
  // A named team or person is its own label; "as Selected users or teams" would name the mechanism.
  const isExplicit = role === Role.Explicit;
  const roleLabel = isExplicit
    ? ''
    : t(`label.onboarding-role-${role.toLowerCase()}`);
  const canNudge = Boolean(onNudge && result.taskId && assignees.length);

  return (
    <Card
      color={isCheckComplete(result) ? 'success' : 'warning'}
      data-testid="onboarding-handoff">
      <Card.Content>
        <Box className="tw:gap-3" direction="col">
          <Box align="center" className="tw:gap-3" wrap="wrap">
            <Typography className="tw:flex-1" size="text-sm">
              {person ? (
                <Transi18next
                  i18nKey={belongsToKey(result.required, isExplicit)}
                  renderElement={<strong className="tw:font-semibold" />}
                  values={{ person, role: roleLabel }}
                />
              ) : (
                t('message.onboarding-unassigned-help')
              )}
            </Typography>
            {canNudge && onNudge && (
              <NudgeButton result={result} onNudge={onNudge} />
            )}
          </Box>
          <HandoffFacts person={person} result={result} roleLabel={roleLabel} />
          <HandoffLinks result={result} />
          {children}
        </Box>
      </Card.Content>
    </Card>
  );
};
