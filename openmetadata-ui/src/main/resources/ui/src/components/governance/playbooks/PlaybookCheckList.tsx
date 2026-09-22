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

import { Badge, Button, Typography } from '@openmetadata/ui-core-components';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import {
  Assistance,
  OnboardingStep,
  Requirement,
  Role,
} from '../../../generated/entity/governance/onboardingPlaybook';
import {
  describeCondition,
  estimateMinutes,
} from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  ASSISTANCE_LABEL_KEY,
  CHECK_TYPE_LABEL_KEY,
  REQUIREMENT_BADGE_COLOR,
  REQUIREMENT_LABEL_KEY,
  ROLE_LABEL_KEY,
} from './Playbook.constants';
import { PlaybookFieldOption } from './Playbook.types';
import { PlaybookAddCheck } from './PlaybookAddCheck';

interface PlaybookCheckListProps {
  stageLabel: string;
  isCreationGate: boolean;
  steps: OnboardingStep[];
  selectedStepId?: string;
  options: PlaybookFieldOption[];
  capturedFieldPaths: Set<string>;
  onSelectStep: (stepId: string) => void;
  onMoveStep: (stepId: string, direction: -1 | 1) => void;
  onAddCheck: (step: OnboardingStep) => void;
  onNewCustomProperty: () => void;
}

interface CheckRowProps {
  step: OnboardingStep;
  index: number;
  isCreationGate: boolean;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelectStep: (stepId: string) => void;
  onMoveStep: (stepId: string, direction: -1 | 1) => void;
}

/** Who the check's task lands on: a named team reads as itself, a role as the role. */
const assigneeLabel = (
  step: OnboardingStep,
  translate: (key: string) => string
) => {
  const role = step.assignment?.role ?? Role.Creator;
  const named = step.assignment?.assignees
    ?.map((assignee) => assignee.displayName ?? assignee.name)
    .join(', ');

  return role === Role.Explicit && named
    ? named
    : translate(ROLE_LABEL_KEY[role]);
};

/** The `Only when: …` chip. A conditional check is skipped outright on assets it does not match. */
const CheckConditionChip = ({ step }: { step: OnboardingStep }) => {
  const { t } = useTranslation();
  const [condition] = step.conditions ?? [];
  if (!condition) {
    return null;
  }
  const sentence = describeCondition(condition);

  return (
    <Badge
      color="warning"
      data-testid={`check-condition-${step.id}`}
      size="sm"
      type="pill-color">
      {t('label.only-when', { condition: t(sentence.key, sentence) })}
    </Badge>
  );
};

/** `Attribute · Assigned to Producer · No assistance` - the check in one line. */
const CheckMetaLine = ({ step }: { step: OnboardingStep }) => {
  const { t } = useTranslation();

  return (
    <span className="tw:text-xs tw:text-tertiary">
      {t(CHECK_TYPE_LABEL_KEY[step.type])}
      {' · '}
      {t('label.assigned-to-role', { role: assigneeLabel(step, t) })}
      {' · '}
      {t(ASSISTANCE_LABEL_KEY[step.assistance ?? Assistance.None])}
    </span>
  );
};

/** One check: what it asks for, who is asked, and whether it holds the gate. */
const CheckRow = ({
  step,
  index,
  isCreationGate,
  isSelected,
  isFirst,
  isLast,
  onSelectStep,
  onMoveStep,
}: CheckRowProps) => {
  const { t } = useTranslation();
  const requirement = step.requirement ?? Requirement.Blocking;

  return (
    <div
      className={`tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-l-2 tw:border-secondary tw:px-4 tw:py-3 tw:last:border-b-0 ${
        isSelected
          ? 'tw:border-l-brand tw:bg-secondary'
          : 'tw:border-l-transparent'
      }`}>
      <div className="tw:flex tw:flex-col">
        <Button
          aria-label={t('label.move-up')}
          color="link-gray"
          isDisabled={isFirst}
          size="sm"
          onPress={() => onMoveStep(step.id, -1)}>
          <ArrowUp aria-hidden className="tw:h-3 tw:w-3" />
        </Button>
        <Button
          aria-label={t('label.move-down')}
          color="link-gray"
          isDisabled={isLast}
          size="sm"
          onPress={() => onMoveStep(step.id, 1)}>
          <ArrowDown aria-hidden className="tw:h-3 tw:w-3" />
        </Button>
      </div>

      <button
        aria-current={isSelected ? 'true' : undefined}
        className="tw:flex tw:flex-1 tw:flex-col tw:gap-1 tw:text-left"
        data-testid={`check-row-${step.id}`}
        type="button"
        onClick={() => onSelectStep(step.id)}>
        <span className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <span
            className={`tw:flex tw:h-6 tw:w-6 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:font-semibold ${
              isSelected
                ? 'tw:bg-brand-solid tw:text-primary_on-brand'
                : 'tw:bg-secondary tw:text-tertiary'
            }`}>
            {index + 1}
          </span>
          <span className="tw:text-sm tw:font-semibold tw:text-primary">
            {step.title ?? step.fieldPath}
          </span>
          {step.fieldPath && (
            <code className="tw:rounded tw:bg-secondary tw:px-1.5 tw:py-0.5 tw:text-xs tw:text-tertiary">
              {step.fieldPath}
            </code>
          )}
          {isCreationGate && (
            <Badge color="brand" size="sm" type="pill-color">
              {t('label.enforced-at-api-and-ui')}
            </Badge>
          )}
          <CheckConditionChip step={step} />
        </span>
        <CheckMetaLine step={step} />
      </button>

      <Badge
        color={REQUIREMENT_BADGE_COLOR[requirement]}
        size="sm"
        type="pill-color">
        {t(REQUIREMENT_LABEL_KEY[requirement])}
      </Badge>
      <ChevronRight
        aria-hidden
        className="tw:h-4 tw:w-4 tw:flex-none tw:text-tertiary"
      />
    </div>
  );
};

export const PlaybookCheckList = ({
  stageLabel,
  isCreationGate,
  steps,
  selectedStepId,
  options,
  capturedFieldPaths,
  onSelectStep,
  onMoveStep,
  onAddCheck,
  onNewCustomProperty,
}: PlaybookCheckListProps) => {
  const { t } = useTranslation();
  const blocking = steps.filter(
    (step) => step.requirement === Requirement.Blocking
  ).length;
  const assisted = steps.filter(
    (step) => step.assistance && step.assistance !== Assistance.None
  ).length;

  return (
    <section
      aria-label={t('label.checks-required-to-leave', { stage: stageLabel })}
      className="tw:rounded-xl tw:border tw:border-secondary tw:bg-primary">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-4 tw:border-b tw:border-secondary tw:p-5">
        <div className="tw:flex tw:flex-col tw:gap-1">
          <Typography className="tw:text-sm tw:font-semibold tw:text-primary">
            {t('label.checks-required-to-leave', { stage: stageLabel })}
          </Typography>
          <Typography
            className="tw:text-xs tw:text-tertiary"
            data-testid="check-summary">
            {t('message.check-summary', {
              assisted,
              blocking,
              count: steps.length,
              minutes: estimateMinutes(steps),
            })}
          </Typography>
        </div>
        <PlaybookAddCheck
          capturedFieldPaths={capturedFieldPaths}
          options={options}
          onAdd={onAddCheck}
          onNewCustomProperty={onNewCustomProperty}
        />
      </div>

      {steps.length === 0 ? (
        <div className="tw:flex tw:flex-col tw:gap-1 tw:p-8 tw:text-center">
          <Typography className="tw:text-sm tw:font-medium tw:text-primary">
            {t('message.no-checks-in-this-gate-yet')}
          </Typography>
          <Typography className="tw:text-xs tw:text-tertiary">
            {isCreationGate
              ? t('message.add-fields-asset-cannot-be-created-without')
              : t('message.add-what-is-due-at-this-gate')}
          </Typography>
        </div>
      ) : (
        <ul>
          {steps.map((step, index) => (
            <li key={step.id}>
              <CheckRow
                index={index}
                isCreationGate={isCreationGate}
                isFirst={index === 0}
                isLast={index === steps.length - 1}
                isSelected={step.id === selectedStepId}
                step={step}
                onMoveStep={onMoveStep}
                onSelectStep={onSelectStep}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
