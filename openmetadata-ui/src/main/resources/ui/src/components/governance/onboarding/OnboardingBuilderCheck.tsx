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
import { ArrowDown, ArrowUp, Trash01 } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import {
  IntakeFormField,
  OnboardingStep,
  Role,
  Type,
} from '../../../generated/governance/intakeForm';

interface Props {
  step: OnboardingStep;
  field?: IntakeFormField;
  fixed: boolean;
  selected: boolean;
  index: number;
  total: number;
  onSelect: () => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
}
const fieldRequirement = (field?: IntakeFormField) => {
  if (field?.required) {
    return 'required';
  }

  return field?.recommended ? 'recommended' : 'optional';
};
const CheckSummary = ({ step, field }: Pick<Props, 'step' | 'field'>) => {
  const { t } = useTranslation();
  const requirement =
    step.type === Type.Approval ? 'approval' : fieldRequirement(field);
  const assignment =
    step.type === Type.Approval
      ? 'label.workflow'
      : `label.onboarding-role-${(
          step.assignment?.role ?? Role.Creator
        ).toLowerCase()}`;

  return (
    <Box direction="col" gap={2}>
      <Box gap={2} wrap="wrap">
        <Badge color={requirement === 'optional' ? 'gray' : 'brand'}>
          {t(`label.${requirement}`)}
        </Badge>
        <Badge color="gray">{t(assignment)}</Badge>
        {Boolean(step.conditions?.length) && (
          <Badge color="warning">
            {t('label.condition')} · {step.conditions?.length}
          </Badge>
        )}
      </Box>
      {step.guidance && (
        <Typography className="tw:line-clamp-2 tw:text-tertiary" size="text-sm">
          {step.guidance}
        </Typography>
      )}
      <Typography className="tw:break-all tw:text-tertiary" size="text-xs">
        {step.fieldPath ?? step.workflow?.name}
      </Typography>
    </Box>
  );
};

export const OnboardingBuilderCheck = ({
  step,
  field,
  fixed,
  selected,
  index,
  total,
  onSelect,
  onMove,
  onRemove,
}: Props) => {
  const { t } = useTranslation();

  return (
    <Card
      data-testid={`onboarding-field-${step.fieldPath ?? step.id}`}
      isSelected={selected}
      size="sm">
      <Card.Header
        extra={
          <Box gap={1}>
            <Button
              aria-label={t('label.move-up')}
              color="tertiary"
              iconLeading={ArrowUp}
              isDisabled={index === 0}
              onPress={() => onMove(-1)}
            />
            <Button
              aria-label={t('label.move-down')}
              color="tertiary"
              iconLeading={ArrowDown}
              isDisabled={index === total - 1}
              onPress={() => onMove(1)}
            />
            <Button
              aria-label={t('label.remove')}
              color="tertiary-destructive"
              iconLeading={Trash01}
              isDisabled={fixed}
              onPress={onRemove}
            />
          </Box>
        }
        title={
          <Button
            className="tw:h-auto tw:justify-start tw:whitespace-normal tw:text-left"
            color="link-gray"
            onPress={onSelect}>
            {index + 1}. {step.title ?? step.fieldPath}
          </Button>
        }
      />
      <Card.Content>
        <CheckSummary field={field} step={step} />
      </Card.Content>
    </Card>
  );
};
