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
import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  IntakeForm,
  OnboardingStage,
  OnboardingStep,
  Role,
  Type,
} from '../../../generated/governance/intakeForm';
import { OnboardingProgress } from '../../../generated/governance/onboarding/onboardingProgress';
import { evaluateOnboarding } from '../../../rest/governance/onboarding/Onboarding.api';
import {
  getStepState,
  isRecord,
  ONBOARDING_STAGES,
  STAGE_LABELS,
  stepsAtStage,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import { getIntakeFormFields } from '../../../utils/IntakeFormUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

interface Props {
  form: IntakeForm | null;
  values?: unknown;
  stage?: OnboardingStage;
  preview?: boolean;
}

const UpcomingAssignment = ({ step }: { step: OnboardingStep }) => {
  const { t } = useTranslation();
  if (step.type === Type.Approval) {
    return (
      <>
        {t('label.workflow')}:{' '}
        {step.workflow?.displayName ??
          step.workflow?.name ??
          t('label.unassigned')}
      </>
    );
  }
  if (step.assignment?.role === Role.Explicit) {
    return (
      <>
        {step.assignment.assignees
          ?.map((assignee) => assignee.displayName ?? assignee.name)
          .join(', ') || t('label.unassigned')}
      </>
    );
  }

  return (
    <>
      {t(
        'label.onboarding-role-' +
          (step.assignment?.role ?? Role.Creator).toLowerCase()
      )}
    </>
  );
};

export const OnboardingCreationChecklist = ({
  form,
  values,
  stage = OnboardingStage.Creation,
  preview = false,
}: Props) => {
  const { t } = useTranslation();
  const [evaluation, setEvaluation] = useState<{
    valuesJson: string;
    progress: OnboardingProgress;
  } | null>(null);
  const valuesJson = JSON.stringify(values ?? {});
  useEffect(() => {
    if (preview || !form?.onboarding?.enabled) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const entity: unknown = JSON.parse(valuesJson);
        if (isRecord(entity)) {
          const progress = await evaluateOnboarding(
            { entityType: form.entityType, entity, stage },
            controller.signal
          );
          if (!controller.signal.aborted) {
            setEvaluation({ valuesJson, progress });
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          showErrorToast(error as AxiosError);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form?.entityType, form?.onboarding?.enabled, preview, stage, valuesJson]);
  if (!form?.onboarding?.enabled) {
    return null;
  }
  const fields = getIntakeFormFields(form);

  return (
    <Box
      className="tw:gap-3 tw:rounded-lg tw:border tw:border-secondary tw:bg-secondary tw:p-4"
      data-testid="onboarding-creation-checklist"
      direction="col">
      <Typography size="text-md" weight="semibold">
        {t('label.onboarding')}
      </Typography>
      <Box className="tw:gap-2" wrap="wrap">
        {ONBOARDING_STAGES.map((item) => (
          <Badge color={stage === item ? 'brand' : 'gray'} key={item}>
            {t(STAGE_LABELS[item])}
          </Badge>
        ))}
      </Box>
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('message.onboarding-creation-help')}
      </Typography>
      <ol className="tw:m-0 tw:list-none tw:p-0 tw:space-y-2">
        {stepsAtStage(form, stage).map((step) => {
          const field = fields.find(
            (item) => item.fieldPath === step.fieldPath
          );
          const result =
            evaluation?.valuesJson === valuesJson
              ? evaluation.progress.steps.find(
                  (result) => result.step.id === step.id
                )
              : undefined;
          const state = result?.state ?? getStepState(step, values);

          return (
            <li className="tw:flex tw:justify-between tw:gap-2" key={step.id}>
              <Box className="tw:gap-1" direction="col">
                <Typography size="text-sm">
                  {step.title ?? field?.fieldLabel} {field?.required ? '*' : ''}
                </Typography>
                {step.guidance && (
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {step.guidance}
                  </Typography>
                )}
                {result?.message && (
                  <Typography className="tw:text-tertiary" size="text-xs">
                    {result.message}
                  </Typography>
                )}
              </Box>
              <Badge color={state === 'Complete' ? 'success' : 'gray'}>
                {t(`label.onboarding-state-${state.toLowerCase()}`)}
              </Badge>
            </li>
          );
        })}
      </ol>
      {stage === OnboardingStage.Creation && (
        <Box data-testid="onboarding-upcoming-work" direction="col" gap={2}>
          <Typography size="text-sm" weight="semibold">
            {t('message.onboarding-after-creation')}
          </Typography>
          {form.onboarding.gates
            ?.filter(
              (gate) =>
                gate.stage !== OnboardingStage.Creation && gate.steps.length > 0
            )
            .map((gate) => (
              <Box direction="col" gap={1} key={gate.stage}>
                <Typography size="text-sm" weight="semibold">
                  {t(STAGE_LABELS[gate.stage])}
                </Typography>
                <ul className="tw:m-0 tw:pl-4 tw:text-sm tw:text-tertiary">
                  {gate.steps.map((step) => (
                    <li key={step.id}>
                      {step.title ??
                        fields.find(
                          (field) => field.fieldPath === step.fieldPath
                        )?.fieldLabel ??
                        step.id}
                      {' · '}
                      <UpcomingAssignment step={step} />
                    </li>
                  ))}
                </ul>
              </Box>
            ))}
        </Box>
      )}
    </Box>
  );
};
