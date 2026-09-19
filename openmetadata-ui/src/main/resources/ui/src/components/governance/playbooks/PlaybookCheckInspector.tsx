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
  Button,
  Input,
  RadioButton,
  RadioGroup,
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle, Delete } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Assistance,
  CheckType,
  OnboardingCondition,
  OnboardingStep,
  Requirement,
  Role,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import {
  describeRule,
  dtypeOf,
  DTYPE_LABEL_KEY,
  FieldDtype,
} from '../../../utils/governance/onboarding/OnboardingField.utils';
import { OnboardingAssignees } from '../onboarding/OnboardingAssignees';
import {
  ASSISTANCE_HINT_KEY,
  ASSISTANCE_LABEL_KEY,
  CHECK_TYPE_HINT_KEY,
  CHECK_TYPE_LABEL_KEY,
  REQUIREMENT_LABEL_KEY,
  ROLE_LABEL_KEY,
  ROLE_ORDER,
} from './Playbook.constants';
import { PlaybookConditionEditor } from './PlaybookConditionEditor';

interface PlaybookCheckInspectorProps {
  step: OnboardingStep;
  position: number;
  isCreationGate: boolean;
  customProperties: CustomProperty[];
  /** Workflows that may record an approval decision; empty until one is deployed. */
  approvalWorkflows: WorkflowDefinition[];
  onChange: (step: OnboardingStep) => void;
  onRemove: (stepId: string) => void;
}

const REQUIREMENTS = [
  Requirement.Blocking,
  Requirement.Recommended,
  Requirement.Optional,
];

/** Blank clears the rule - the value then only has to be non-empty. */
const withRule = (
  step: OnboardingStep,
  rule: 'minLength' | 'minItems',
  raw: string
): OnboardingStep => {
  const parsed = Number.parseInt(raw, 10);
  const rules = {
    ...step.rules,
    [rule]: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
  };

  return {
    ...step,
    rules:
      rules.minLength === undefined && rules.minItems === undefined
        ? undefined
        : rules,
  };
};

const ASSISTANCE_ORDER = [
  Assistance.AI,
  Assistance.Autofill,
  Assistance.Example,
  Assistance.None,
];

/** The three requirement levels as one segmented control, the way the design groups them. */
const RequirementPicker = ({
  selected,
  onSelect,
}: {
  selected: Requirement;
  onSelect: (requirement: Requirement) => void;
}) => {
  const { t } = useTranslation();

  return (
    <section className="tw:flex tw:flex-col tw:gap-2">
      <Typography className="tw:text-sm tw:font-medium tw:text-primary">
        {t('label.requirement')}
      </Typography>
      <div
        aria-label={t('label.requirement')}
        className="tw:flex tw:gap-1 tw:rounded-lg tw:bg-secondary tw:p-1"
        data-testid="check-requirement"
        role="radiogroup">
        {REQUIREMENTS.map((requirement) => (
          <button
            aria-checked={selected === requirement}
            className={`tw:flex-1 tw:rounded-md tw:px-3 tw:py-1.5 tw:text-sm tw:font-medium ${
              selected === requirement
                ? 'tw:bg-primary tw:text-brand-secondary tw:shadow-xs'
                : 'tw:text-tertiary tw:hover:text-primary'
            }`}
            key={requirement}
            role="radio"
            type="button"
            onClick={() => onSelect(requirement)}>
            {t(REQUIREMENT_LABEL_KEY[requirement])}
          </button>
        ))}
      </div>
    </section>
  );
};

/**
 * What counts as a filled-in value, as the sentence the wizard repeats back to the producer. The
 * numbers behind it stay editable but stay out of the way: most checks never change them.
 */
const AcceptedWhen = ({
  step,
  onChange,
}: {
  step: OnboardingStep;
  onChange: (step: OnboardingStep) => void;
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const rule = describeRule(step);

  return (
    <section className="tw:flex tw:flex-col tw:gap-2">
      <Typography className="tw:text-sm tw:font-medium tw:text-primary">
        {t('label.accepted-when')}
      </Typography>
      <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-3">
        <CheckCircle
          aria-hidden
          className="tw:h-4 tw:w-4 tw:flex-none tw:text-fg-success-primary"
        />
        <Typography
          className="tw:flex-1 tw:text-sm tw:text-secondary"
          data-testid="accepted-when-rule">
          {t(rule.key, { count: rule.count })}
        </Typography>
        {step.type !== CheckType.Approval && (
          <Button
            color="link-color"
            data-testid="edit-accepted-when"
            size="sm"
            onPress={() => setIsEditing((current) => !current)}>
            {t('label.edit')}
          </Button>
        )}
      </div>

      {isEditing && step.type !== CheckType.Approval && (
        <div className="tw:flex tw:flex-col tw:gap-2">
          <div className="tw:flex tw:items-center tw:gap-2">
            <Input
              aria-label={t('label.minimum-length')}
              inputDataTestId="check-min-length"
              placeholder={t('label.minimum-length')}
              type="number"
              value={String(step.rules?.minLength ?? '')}
              onChange={(value) => onChange(withRule(step, 'minLength', value))}
            />
            <Input
              aria-label={t('label.minimum-count')}
              inputDataTestId="check-min-items"
              placeholder={t('label.minimum-count')}
              type="number"
              value={String(step.rules?.minItems ?? '')}
              onChange={(value) => onChange(withRule(step, 'minItems', value))}
            />
          </div>
          <Typography className="tw:text-xs tw:text-tertiary">
            {t('message.leave-blank-for-not-empty')}
          </Typography>
        </div>
      )}
    </section>
  );
};

/** Where the answer lives. An approval is a decision, so it has no field to point at. */
const kindLabelKey = (step: OnboardingStep): string => {
  if (step.type === CheckType.Approval) {
    return 'label.approval';
  }

  return step.fieldPath?.startsWith('extension.')
    ? 'label.custom-property'
    : 'label.native-field';
};

/** The field the check reads, its kind and the shape of the value it expects. */
const WhatItCaptures = ({
  step,
  dtype,
  isCreationGate,
}: {
  step: OnboardingStep;
  dtype: FieldDtype;
  isCreationGate: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <section className="tw:flex tw:flex-col tw:gap-2">
      <Typography className="tw:text-sm tw:font-medium tw:text-primary">
        {t('label.what-it-captures')}
      </Typography>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-secondary tw:p-3">
        {step.fieldPath && (
          <code className="tw:text-xs tw:text-tertiary">{step.fieldPath}</code>
        )}
        <Badge color="gray" size="sm" type="pill-color">
          {t(kindLabelKey(step))}
        </Badge>
        <Badge
          color="gray"
          data-testid="check-dtype"
          size="sm"
          type="pill-color">
          {t(DTYPE_LABEL_KEY[dtype])}
        </Badge>
        {isCreationGate && (
          <Badge color="brand" size="sm" type="pill-color">
            {t('label.enforced-at-api-and-ui')}
          </Badge>
        )}
      </div>
    </section>
  );
};

/**
 * Which workflow records an approval's decision. Only workflows that record a decision without
 * touching the asset's status qualify - moving the asset is the gate's handoff workflow's job.
 */
const ApprovalWorkflowSelect = ({
  step,
  workflows,
  onChange,
}: {
  step: OnboardingStep;
  workflows: WorkflowDefinition[];
  onChange: (step: OnboardingStep) => void;
}) => {
  const { t } = useTranslation();

  return (
    <Select
      data-testid="check-workflow"
      hint={t('message.approval-workflow-records-the-decision')}
      label={t('label.workflow')}
      placeholder={t('label.select-a-workflow')}
      selectedKey={step.workflow?.id}
      onSelectionChange={(key) => {
        const workflow = workflows.find((candidate) => candidate.id === key);
        onChange({
          ...step,
          workflow: workflow
            ? {
                fullyQualifiedName: workflow.fullyQualifiedName,
                id: workflow.id ?? '',
                name: workflow.name,
                type: 'workflowDefinition',
              }
            : undefined,
        });
      }}>
      {workflows
        .filter((workflow) => Boolean(workflow.id))
        .map((workflow) => (
          <Select.Item
            id={workflow.id as string}
            key={workflow.id}
            label={workflow.displayName ?? workflow.name}>
            {workflow.displayName ?? workflow.name}
          </Select.Item>
        ))}
    </Select>
  );
};

/**
 * Who the check's task lands on. Roles resolve per asset from its ownership fields; naming users or
 * teams outright is the escape hatch for standing groups such as Data Management.
 */
const CheckAssignment = ({
  step,
  onChange,
}: {
  step: OnboardingStep;
  onChange: (step: OnboardingStep) => void;
}) => {
  const { t } = useTranslation();
  const role = step.assignment?.role ?? Role.Creator;

  return (
    <section className="tw:flex tw:flex-col tw:gap-2">
      <Select
        data-testid="check-assignee"
        hint={t('message.assignee-resolved-per-asset')}
        label={t('label.who-gets-the-task')}
        selectedKey={role}
        onSelectionChange={(key) =>
          onChange({
            ...step,
            assignment: { ...step.assignment, role: key as Role },
          })
        }>
        {ROLE_ORDER.map((item) => (
          <Select.Item id={item} key={item} label={t(ROLE_LABEL_KEY[item])}>
            {t(ROLE_LABEL_KEY[item])}
          </Select.Item>
        ))}
      </Select>

      {role === Role.Explicit && (
        <OnboardingAssignees
          label={t('label.named-users-or-teams')}
          value={step.assignment?.assignees ?? []}
          onChange={(assignees) =>
            onChange({
              ...step,
              assignment: { ...step.assignment, assignees, role },
            })
          }
        />
      )}
    </section>
  );
};

/** The help offered before the person is left with a blank field. */
const AssistancePicker = ({
  selected,
  onSelect,
}: {
  selected: Assistance;
  onSelect: (assistance: Assistance) => void;
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Typography className="tw:text-sm tw:font-medium tw:text-primary">
        {t('label.assistance-offered')}
      </Typography>
      <RadioGroup
        aria-label={t('label.assistance-offered')}
        className="tw:gap-2"
        data-testid="check-assistance"
        value={selected}
        onChange={(value) => onSelect(value as Assistance)}>
        {ASSISTANCE_ORDER.map((assistance) => (
          <div
            className={`tw:rounded-lg tw:border tw:p-3 ${
              selected === assistance
                ? 'tw:border-brand tw:bg-brand-primary'
                : 'tw:border-secondary'
            }`}
            key={assistance}>
            <RadioButton
              hint={t(ASSISTANCE_HINT_KEY[assistance])}
              label={t(ASSISTANCE_LABEL_KEY[assistance])}
              value={assistance}
            />
          </div>
        ))}
      </RadioGroup>
    </>
  );
};

/**
 * Edit one check: what it captures, who is asked, whether it holds the gate, and what help the
 * person completing it is given.
 */
export const PlaybookCheckInspector = ({
  step,
  position,
  isCreationGate,
  customProperties,
  approvalWorkflows,
  onChange,
  onRemove,
}: PlaybookCheckInspectorProps) => {
  const { t } = useTranslation();
  const [condition] = step.conditions ?? [];
  const dtype = dtypeOf(step, customProperties);

  const handleCondition = (next?: OnboardingCondition) =>
    onChange({ ...step, conditions: next ? [next] : [] });

  return (
    <aside
      aria-label={t('label.check-number', { number: position })}
      className="tw:flex tw:flex-col tw:gap-5 tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-5 tw:xl:sticky tw:xl:top-0">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
          <Typography className="tw:text-xs tw:font-semibold tw:uppercase tw:tracking-wide tw:text-tertiary">
            {t('label.check-number', { number: position })}
          </Typography>
          <Input
            aria-label={t('label.title')}
            inputDataTestId="check-title"
            value={step.title ?? ''}
            onChange={(value) => onChange({ ...step, title: value })}
          />
        </div>
        <Button
          aria-label={t('label.remove-check')}
          color="link-gray"
          data-testid="remove-check"
          size="sm"
          onPress={() => onRemove(step.id)}>
          <Delete aria-hidden className="tw:h-4 tw:w-4" />
        </Button>
      </div>

      <WhatItCaptures
        dtype={dtype}
        isCreationGate={isCreationGate}
        step={step}
      />

      <Select
        data-testid="check-type"
        hint={t(CHECK_TYPE_HINT_KEY[step.type])}
        label={t('label.what-kind-of-check')}
        selectedKey={step.type}
        onSelectionChange={(key) =>
          onChange({ ...step, type: key as CheckType })
        }>
        {Object.values(CheckType).map((type) => (
          <Select.Item
            id={type}
            key={type}
            label={t(CHECK_TYPE_LABEL_KEY[type])}>
            {t(CHECK_TYPE_LABEL_KEY[type])}
          </Select.Item>
        ))}
      </Select>

      {step.type === CheckType.Approval && (
        <ApprovalWorkflowSelect
          step={step}
          workflows={approvalWorkflows}
          onChange={onChange}
        />
      )}

      <PlaybookConditionEditor
        condition={condition}
        onChange={handleCondition}
      />

      <CheckAssignment step={step} onChange={onChange} />

      <RequirementPicker
        selected={step.requirement ?? Requirement.Blocking}
        onSelect={(requirement) => onChange({ ...step, requirement })}
      />

      <AssistancePicker
        selected={step.assistance ?? Assistance.None}
        onSelect={(assistance) => onChange({ ...step, assistance })}
      />

      <TextArea
        data-testid="check-guidance"
        label={t('label.guidance-shown-in-the-wizard')}
        value={step.guidance ?? ''}
        onChange={(value) => onChange({ ...step, guidance: value })}
      />

      <AcceptedWhen step={step} onChange={onChange} />
    </aside>
  );
};
