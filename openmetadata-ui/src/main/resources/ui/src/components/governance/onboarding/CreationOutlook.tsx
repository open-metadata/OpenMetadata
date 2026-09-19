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
import { Badge, Box, Card, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { OnboardingPlaybook } from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ONBOARDING_STAGE } from '../../../utils/governance/onboarding/Onboarding.constants';
import {
  applicableSteps,
  stepsAtStage,
} from '../../../utils/governance/onboarding/Onboarding.utils';
import {
  dtypeOf,
  DTYPE_LABEL_KEY,
  requirementLabelKey,
  stageLabel,
} from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  getGateForStage,
  getNextStage,
} from '../../../utils/governance/playbooks/Playbook.utils';
import { Transi18next } from '../../../utils/i18next/LocalUtil';
import { FieldPathChip } from './CreationCheckBlock';

interface Props {
  playbook: OnboardingPlaybook;
  customProperties: CustomProperty[];
  /** The create payload as it currently stands - conditional checks are counted against it. */
  values: unknown;
}

const OutlookStep = ({
  children,
  index,
}: {
  children: ReactNode;
  index: number;
}) => (
  <Box align="start" className="tw:gap-2.5">
    <Box
      align="center"
      className="tw:size-5 tw:shrink-0 tw:rounded-full tw:bg-brand-solid tw:text-white"
      justify="center">
      <Typography size="text-xs" weight="bold">
        {index}
      </Typography>
    </Box>
    <Typography className="tw:flex-1" size="text-sm">
      {children}
    </Typography>
  </Box>
);

/**
 * What the producer is signing up for: the stage the asset lands in, the work that follows it and
 * the review workflow that ends it - all read off the one playbook that governs the asset type, so
 * there is never a question of which rules a given asset got.
 */
export const CreationOutlook = ({
  playbook,
  customProperties,
  values,
}: Props) => {
  const { t } = useTranslation();
  const configuration = playbook.onboarding;
  const stages = configuration?.stages;
  const entryStage =
    getNextStage(configuration, ONBOARDING_STAGE.CREATION)?.key ??
    ONBOARDING_STAGE.DRAFT;
  const entryStageLabel = stageLabel(entryStage, t, stages);
  const queued = applicableSteps(playbook, entryStage, values);
  const workflow = getGateForStage(configuration, entryStage)?.handoffWorkflow;
  const maintainer = playbook.owners?.map(getEntityName).join(', ');

  return (
    <Card color="brandOutlined" data-testid="creation-outlook">
      <Card.Header
        subtitle={t('message.resolved-from-one-playbook')}
        title={t('label.what-happens-when-you-create-it')}
      />
      <Card.Content>
        <Box className="tw:gap-3" direction="col">
          <OutlookStep index={1}>
            <Transi18next
              i18nKey="message.created-in-stage"
              renderElement={<strong className="tw:font-semibold" />}
              values={{ stage: entryStageLabel }}
            />
          </OutlookStep>
          <OutlookStep index={2}>
            <span data-testid="queued-after-creation">
              {t('message.checks-queued-after-creation', {
                count: queued.length,
              })}
            </span>
          </OutlookStep>
          <OutlookStep index={3}>
            {workflow ? (
              <Transi18next
                i18nKey="message.when-gate-passes-workflow-starts"
                renderElement={<strong className="tw:font-semibold" />}
                values={{
                  stage: entryStageLabel,
                  workflow: getEntityName(workflow),
                }}
              />
            ) : (
              t('message.no-review-workflow-on-gate', {
                maintainer: maintainer || t('label.your-administrator'),
                stage: entryStageLabel,
              })
            )}
          </OutlookStep>
          <Box
            className="tw:gap-2 tw:border-t tw:border-secondary tw:pt-3"
            direction="col">
            <Typography
              className="tw:uppercase tw:tracking-wide tw:text-tertiary"
              size="text-xs"
              weight="semibold">
              {t('label.required-now')}
            </Typography>
            {stepsAtStage(playbook, ONBOARDING_STAGE.CREATION).map((step) => (
              <Box align="start" className="tw:gap-2" key={step.id}>
                <Box
                  className="tw:min-w-0 tw:flex-1 tw:gap-0.5"
                  direction="col">
                  <Typography size="text-sm" weight="medium">
                    {step.title ?? step.fieldPath}
                  </Typography>
                  <Box align="center" className="tw:gap-1.5" wrap="wrap">
                    <FieldPathChip fieldPath={step.fieldPath ?? ''} />
                    <Typography className="tw:text-quaternary" size="text-xs">
                      {t(DTYPE_LABEL_KEY[dtypeOf(step, customProperties)])}
                    </Typography>
                  </Box>
                </Box>
                <Badge color="gray" size="sm" type="pill-color">
                  {t(requirementLabelKey(step.requirement))}
                </Badge>
              </Box>
            ))}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );
};
