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

import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA } from '../../../constants/constants';
import {
  OnboardingConfiguration,
  OnboardingStageDefinition,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import {
  DaysInEntryStage,
  FollowUPS,
  OnboardingSummary,
  ReachedReviewInTime,
} from '../../../generated/governance/onboarding/onboardingSummary';
import { stageLabel } from '../../../utils/governance/onboarding/OnboardingField.utils';
import {
  getNextStage,
  getStages,
} from '../../../utils/governance/playbooks/Playbook.utils';

/** The noun the sample is counted in, so a caption reads "41 products", not "41 items". */
const SAMPLE_COUNT_KEY: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'message.product-count',
  [TargetEntityType.Domain]: 'message.domain-count',
  [TargetEntityType.GlossaryTerm]: 'message.term-count',
  [TargetEntityType.Metric]: 'message.metric-count',
};

/** The minus sign the design uses, which is not the hyphen a keyboard produces. */
const MINUS = '−';

interface StatTileProps {
  testId: string;
  title: string;
  value?: ReactNode;
  delta?: string;
  /** Improving deltas read as good news; a slower one is stated plainly rather than in red. */
  isImproving?: boolean;
  caption: string;
}

const StatTile = ({
  testId,
  title,
  value,
  delta,
  isImproving,
  caption,
}: StatTileProps) => (
  <Card className="tw:p-4" data-testid={testId}>
    <Typography className="tw:text-tertiary" size="text-xs" weight="semibold">
      {title}
    </Typography>
    <Box align="baseline" className="tw:mt-2 tw:gap-2">
      <Typography
        data-testid={`${testId}-value`}
        size="display-sm"
        weight="bold">
        {value ?? NO_DATA}
      </Typography>
      {delta && (
        <Typography
          className={
            isImproving ? 'tw:text-success-primary' : 'tw:text-quaternary'
          }
          data-testid={`${testId}-delta`}
          size="text-sm"
          weight="semibold">
          {delta}
        </Typography>
      )}
    </Box>
    <Typography className="tw:mt-1 tw:text-quaternary" size="text-xs">
      {caption}
    </Typography>
  </Card>
);

interface TileProps {
  noData: string;
  stages: OnboardingStageDefinition[];
}

/** Share of a cohort that cleared the entry gate inside the threshold the playbook promises. */
const ReachedReviewTile = ({
  cohort,
  noData,
  stages,
}: TileProps & { cohort?: ReachedReviewInTime }) => {
  const { t } = useTranslation();
  const delta = cohort?.deltaPoints;
  const sign = (delta ?? 0) > 0 ? '+' : MINUS;

  return (
    <StatTile
      caption={
        cohort?.share === undefined
          ? noData
          : t('message.since-guided-steps-went-live')
      }
      delta={
        delta === undefined
          ? undefined
          : t('label.delta-points', {
              points: `${sign}${Math.abs(Math.round(delta))}`,
            })
      }
      isImproving={(delta ?? 0) > 0}
      testId="tile-reached-review"
      title={t('message.reached-stage-in-days', {
        count: cohort?.thresholdDays ?? 7,
        stage: stageLabel(
          getNextStage({ stages }, cohort?.stage ?? '')?.key ?? '',
          t,
          stages
        ),
      })}
      value={
        cohort?.share === undefined ? undefined : `${Math.round(cohort.share)}%`
      }
    />
  );
};

/** How long assets sit in the entry stage, against the previous window of the same length. */
const MedianDaysTile = ({
  entryStage,
  entityType,
  noData,
  stages,
}: TileProps & {
  entryStage?: DaysInEntryStage;
  entityType: TargetEntityType;
}) => {
  const { t } = useTranslation();
  const delta = entryStage?.deltaDays;
  // A positive delta is days saved, which the design writes as a negative number.
  const sign = (delta ?? 0) > 0 ? MINUS : '+';

  return (
    <StatTile
      caption={
        entryStage?.sampleSize === undefined
          ? noData
          : t('message.last-days-sample', {
              days: entryStage.windowDays ?? 30,
              sample: t(SAMPLE_COUNT_KEY[entityType], {
                count: entryStage.sampleSize,
              }),
            })
      }
      delta={
        delta === undefined ? undefined : `${sign}${Math.abs(delta).toFixed(1)}`
      }
      isImproving={(delta ?? 0) > 0}
      testId="tile-median-days"
      title={t('message.median-days-in-stage', {
        stage: stageLabel(entryStage?.stage ?? '', t, stages),
      })}
      value={entryStage?.medianDays?.toFixed(1)}
    />
  );
};

/** Reminders a human had to send this week - the work the playbook is meant to remove. */
const FollowUpsTile = ({
  followUps,
  noData,
}: {
  followUps?: FollowUPS;
  noData: string;
}) => {
  const { t } = useTranslation();
  const manual = followUps?.manual;

  return (
    <StatTile
      caption={
        manual === undefined
          ? noData
          : t('message.down-from-sixty-before-automation')
      }
      delta={manual === undefined ? undefined : t('label.this-week')}
      testId="tile-follow-ups"
      title={t('label.manual-follow-ups-sent')}
      value={manual}
    />
  );
};

interface OnboardingSummaryTilesProps {
  summary?: OnboardingSummary;
  entityType: TargetEntityType;
  /** The playbook's own lifecycle, so the first tile names the stage assets are measured against. */
  configuration?: OnboardingConfiguration;
  isLoading: boolean;
}

/**
 * How onboarding is going for one asset type.
 *
 * <p>Every measure is null when its window holds no sample, which is why nothing here falls back to
 * zero: a zero nobody measured reads as a catastrophe rather than as an empty week.
 */
export const OnboardingSummaryTiles = ({
  summary,
  entityType,
  configuration,
  isLoading,
}: OnboardingSummaryTilesProps) => {
  const { t } = useTranslation();
  const noData = isLoading ? t('label.loading') : t('message.no-data-yet');
  const stages = getStages(configuration);

  return (
    <Box
      className="tw:grid tw:grid-cols-1 tw:gap-4 tw:md:grid-cols-3"
      data-testid="onboarding-summary-tiles">
      <ReachedReviewTile
        cohort={summary?.reachedReviewInTime}
        noData={noData}
        stages={stages}
      />
      <MedianDaysTile
        entityType={entityType}
        entryStage={summary?.daysInEntryStage}
        noData={noData}
        stages={stages}
      />
      <FollowUpsTile followUps={summary?.followUps} noData={noData} />
    </Box>
  );
};
