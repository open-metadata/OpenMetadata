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
  Box,
  Button,
  Input,
  Select,
  TextArea,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IntakeFormField,
  OnboardingCondition,
  OnboardingStage,
  OnboardingStep,
  Operator,
  Role,
  Type,
} from '../../../generated/governance/intakeForm';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import {
  ONBOARDING_STAGES,
  STAGE_LABELS,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import { getWorkflowDefinitionDetailPath } from '../../../utils/WorkflowRouterUtils';
import { OnboardingAssignees } from './OnboardingAssignees';

interface Props {
  fields?: IntakeFormField[];
  valueKind?: 'text' | 'list' | 'other';
  step: OnboardingStep;
  stage: OnboardingStage;
  field?: IntakeFormField;
  workflows: WorkflowDefinition[];
  fixed: boolean;
  onChange: (step: OnboardingStep) => void;
  onFieldChange: (field: IntakeFormField) => void;
  onMove: (stage: OnboardingStage) => void;
}
const requirement = (field: IntakeFormField) => {
  if (field.required) {
    return 'required';
  }

  return field.recommended ? 'recommended' : 'optional';
};
const conditionValue = (value: string): unknown => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
};
const ConditionInput = ({
  condition,
  onChange,
  onRemove,
  fields,
}: {
  fields: IntakeFormField[];
  condition: OnboardingCondition;
  onChange: (value: OnboardingCondition) => void;
  onRemove: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box className="tw:gap-2" direction="col">
      <Select
        label={t('label.field')}
        selectedKey={condition.fieldPath}
        onSelectionChange={(key) =>
          onChange({ ...condition, fieldPath: String(key) })
        }>
        {fields.map((field) => (
          <Select.Item
            id={field.fieldPath}
            key={field.fieldPath}
            label={field.fieldLabel}
          />
        ))}
        {!fields.some((field) => field.fieldPath === condition.fieldPath) && (
          <Select.Item id={condition.fieldPath} label={condition.fieldPath} />
        )}
      </Select>
      <Select
        label={t('label.operator')}
        selectedKey={condition.operator}
        onSelectionChange={(key) => {
          const operator = Object.values(Operator).find(
            (value) => value === key
          );
          if (operator) {
            onChange({ ...condition, operator });
          }
        }}>
        {Object.values(Operator).map((operator) => (
          <Select.Item
            id={operator}
            key={operator}
            label={t(`label.onboarding-operator-${operator}`)}
          />
        ))}
      </Select>
      {condition.operator !== Operator.Present && (
        <Input
          label={t('label.value')}
          value={
            typeof condition.value === 'string'
              ? condition.value
              : JSON.stringify(condition.value) ?? ''
          }
          onChange={(value) =>
            onChange({ ...condition, value: conditionValue(value) })
          }
        />
      )}
      <Button color="tertiary-destructive" onPress={onRemove}>
        {t('label.remove')}
      </Button>
    </Box>
  );
};
const Conditions = ({
  step,
  onChange,
  fields = [],
}: Pick<Props, 'step' | 'onChange' | 'fields'>) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState(() =>
    (step.conditions ?? []).map((condition) => ({
      id: crypto.randomUUID(),
      condition,
    }))
  );
  const change = (next: typeof rows) => {
    setRows(next);
    onChange({ ...step, conditions: next.map((row) => row.condition) });
  };
  const edit = (id: string, condition: OnboardingCondition) =>
    change(rows.map((row) => (row.id === id ? { ...row, condition } : row)));
  const remove = (id: string) => change(rows.filter((row) => row.id !== id));
  const add = () =>
    change([
      ...rows,
      {
        id: crypto.randomUUID(),
        condition: {
          fieldPath: 'tags',
          operator: Operator.Contains,
          value: '',
        },
      },
    ]);

  return (
    <Box className="tw:gap-3" direction="col">
      <Typography size="text-sm" weight="semibold">
        {t('label.condition')}
      </Typography>
      {rows.map((row) => (
        <ConditionInput
          condition={row.condition}
          fields={fields}
          key={row.id}
          onChange={(condition) => edit(row.id, condition)}
          onRemove={() => remove(row.id)}
        />
      ))}
      <Button color="secondary" onPress={add}>
        {t('label.add-condition')}
      </Button>
    </Box>
  );
};
const ApprovalSettings = ({
  step,
  workflows,
  onChange,
}: Pick<Props, 'step' | 'workflows' | 'onChange'>) => {
  const { t } = useTranslation();
  const workflow = workflows.find((item) => item.id === step.workflow?.id);
  const select = (key: unknown) => {
    const selected = workflows.find((item) => item.id === key);
    if (selected?.id) {
      onChange({
        ...step,
        workflow: {
          id: selected.id,
          type: 'workflowDefinition',
          name: selected.name,
          fullyQualifiedName: selected.fullyQualifiedName,
        },
      });
    }
  };

  return (
    <>
      <Select
        label={t('label.workflow')}
        selectedKey={step.workflow?.id}
        onSelectionChange={select}>
        {workflows.map((item) =>
          item.id ? (
            <Select.Item
              id={item.id}
              key={item.id}
              label={item.displayName ?? item.name ?? item.id}
            />
          ) : null
        )}
      </Select>
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('message.onboarding-workflow-assignment')}
      </Typography>
      {workflow?.fullyQualifiedName && (
        <Button
          color="link-color"
          href={getWorkflowDefinitionDetailPath(workflow.fullyQualifiedName)}>
          {t('label.workflow')}
        </Button>
      )}
      {workflow?.description && (
        <Typography size="text-sm">{workflow.description}</Typography>
      )}
    </>
  );
};
const FieldRules = ({
  step,
  valueKind,
  onChange,
}: Pick<Props, 'step' | 'valueKind' | 'onChange'>) => {
  const { t } = useTranslation();

  return (
    <>
      {(valueKind === 'text' || step.rules?.minLength !== undefined) && (
        <Input
          label={t('label.minimum-length')}
          type="number"
          value={step.rules?.minLength?.toString() ?? ''}
          onChange={(value) =>
            onChange({
              ...step,
              rules: {
                ...step.rules,
                minLength: value ? Number(value) : undefined,
              },
            })
          }
        />
      )}
      {(valueKind === 'list' || step.rules?.minItems !== undefined) && (
        <Input
          label={t('label.minimum-count')}
          type="number"
          value={step.rules?.minItems?.toString() ?? ''}
          onChange={(value) =>
            onChange({
              ...step,
              rules: {
                ...step.rules,
                minItems: value ? Number(value) : undefined,
              },
            })
          }
        />
      )}
    </>
  );
};

const FieldSettings = ({
  step,
  field,
  fixed,
  onChange,
  onFieldChange,
  valueKind,
}: Pick<
  Props,
  'step' | 'field' | 'fixed' | 'onChange' | 'onFieldChange' | 'valueKind'
>) => {
  const { t } = useTranslation();
  const role = step.assignment?.role ?? Role.Creator;

  return (
    <>
      {field && (
        <Select
          isDisabled={fixed}
          label={t('label.requirement')}
          selectedKey={requirement(field)}
          onSelectionChange={(key) =>
            onFieldChange({
              ...field,
              required: key === 'required',
              recommended: key === 'recommended',
            })
          }>
          {['required', 'recommended', 'optional'].map((item) => (
            <Select.Item id={item} key={item} label={t(`label.${item}`)} />
          ))}
        </Select>
      )}
      <Select
        label={t('label.assign-to')}
        selectedKey={role}
        onSelectionChange={(key) => {
          const selected = Object.values(Role).find((value) => value === key);
          if (selected) {
            onChange({ ...step, assignment: { role: selected } });
          }
        }}>
        {Object.values(Role).map((value) => (
          <Select.Item
            id={value}
            key={value}
            label={t(`label.onboarding-role-${value.toLowerCase()}`)}
          />
        ))}
      </Select>
      {role === Role.Explicit && (
        <OnboardingAssignees
          value={step.assignment?.assignees ?? []}
          onChange={(assignees) =>
            onChange({ ...step, assignment: { role, assignees } })
          }
        />
      )}
      <FieldRules step={step} valueKind={valueKind} onChange={onChange} />
      <Input
        label={t('label.validation-message')}
        value={field?.errorMessage ?? ''}
        onChange={(errorMessage) =>
          field && onFieldChange({ ...field, errorMessage })
        }
      />
    </>
  );
};

export const OnboardingCheckSettings = ({
  step,
  stage,
  field,
  workflows,
  fixed,
  onChange,
  onFieldChange,
  onMove,
  fields,
  valueKind,
}: Props) => {
  const { t } = useTranslation();
  const stages = ONBOARDING_STAGES.filter(
    (item) =>
      item !== OnboardingStage.Approved &&
      item !== OnboardingStage.Deprecated &&
      (step.type !== Type.Approval || item !== OnboardingStage.Creation)
  );

  return (
    <Box
      className="tw:gap-4 tw:min-w-0"
      data-testid="onboarding-check-settings"
      direction="col">
      <Typography size="text-md" weight="semibold">
        {t('label.check-settings')}
      </Typography>
      <Input
        label={t('label.name')}
        value={step.title ?? ''}
        onChange={(title) => onChange({ ...step, title })}
      />
      <Select
        isDisabled={fixed}
        label={t('label.stage')}
        selectedKey={stage}
        onSelectionChange={(key) => {
          const target = ONBOARDING_STAGES.find(
            (candidate) => candidate === key
          );
          if (target) {
            onMove(target);
          }
        }}>
        {stages.map((item) => (
          <Select.Item id={item} key={item} label={t(STAGE_LABELS[item])} />
        ))}
      </Select>
      <TextArea
        label={t('label.guidance')}
        value={step.guidance ?? ''}
        onChange={(guidance) => onChange({ ...step, guidance })}
      />
      {step.type === Type.Approval ? (
        <ApprovalSettings
          step={step}
          workflows={workflows}
          onChange={onChange}
        />
      ) : (
        <FieldSettings
          field={field}
          fixed={fixed}
          step={step}
          valueKind={valueKind}
          onChange={onChange}
          onFieldChange={onFieldChange}
        />
      )}
      {!fixed && (
        <Conditions
          fields={fields}
          key={step.id}
          step={step}
          onChange={onChange}
        />
      )}
    </Box>
  );
};
