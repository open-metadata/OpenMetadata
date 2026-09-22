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
import {
  CheckCircle,
  Circle,
  Time,
} from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { OnboardingPlaybook } from '../../../generated/entity/governance/onboardingPlaybook';
import { OnboardingStepResult } from '../../../generated/governance/onboarding/onboardingProgress';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  checkRequirementLabel,
  isCheckComplete,
  isWithOthers,
  OnboardingViewer,
} from '../../../utils/governance/onboarding/OnboardingJourney.utils';

interface Props {
  steps: OnboardingStepResult[];
  selectedId?: string;
  playbook?: OnboardingPlaybook | null;
  viewer?: OnboardingViewer;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

const checkTitle = (result: OnboardingStepResult) =>
  result.step.title ??
  result.field?.fieldLabel ??
  result.step.fieldPath ??
  result.step.id;

/** Who holds a check, in the words the producer needs: done, someone else's, or theirs. */
const rowSubtitle = (
  result: OnboardingStepResult,
  viewer?: OnboardingViewer
) => {
  if (isCheckComplete(result)) {
    return { key: 'label.complete', values: undefined };
  }
  if (isWithOthers(result, viewer)) {
    return {
      key: 'label.with-person',
      values: { person: result.assignees?.map(getEntityName).join(', ') },
    };
  }

  return { key: 'label.assigned-to-you', values: undefined };
};

const rowIcon = (result: OnboardingStepResult, viewer?: OnboardingViewer) => {
  if (isCheckComplete(result)) {
    return CheckCircle;
  }

  return isWithOthers(result, viewer) ? Time : Circle;
};

/**
 * Everything standing between the asset and review, in the playbook's order. The producer's own
 * work and other people's sit in one list on purpose: the design's point is that nothing is
 * hidden from them, not that they have to do all of it.
 */
export const OnboardingJourneyRail = ({
  steps,
  selectedId,
  playbook,
  viewer,
  onSelect,
  onRefresh,
}: Props) => {
  const { t } = useTranslation();
  const maintainer = playbook?.owners?.map(getEntityName).join(', ');

  return (
    <Card
      className="tw:w-full tw:lg:w-[308px] tw:lg:shrink-0"
      data-testid="onboarding-journey-rail"
      size="sm">
      <Card.Header
        subtitle={
          playbook
            ? t('message.playbook-set-by', {
                owner: maintainer || t('label.your-administrator'),
                playbook: getEntityName(playbook),
              })
            : undefined
        }
        title={t('label.before-this-goes-to-review')}
      />
      <Card.Content>
        <ol className="tw:m-0 tw:list-none tw:space-y-1 tw:p-0">
          {steps.map((result) => {
            const Icon = rowIcon(result, viewer);
            const subtitle = rowSubtitle(result, viewer);
            const selected = selectedId === result.step.id;

            return (
              <li key={result.step.id}>
                <Button
                  aria-current={selected ? 'step' : undefined}
                  aria-label={checkTitle(result)}
                  className={`tw:h-auto tw:w-full tw:justify-start tw:whitespace-normal tw:py-2.5 tw:text-left ${
                    selected ? 'tw:bg-brand-primary' : ''
                  }`}
                  color={selected ? 'secondary' : 'tertiary'}
                  onPress={() => onSelect(result.step.id)}>
                  <Box align="start" className="tw:w-full tw:gap-2.5">
                    <Icon
                      className={
                        isCheckComplete(result)
                          ? 'tw:text-fg-success-primary'
                          : 'tw:text-fg-quaternary'
                      }
                      size={18}
                    />
                    <Box
                      className="tw:min-w-0 tw:flex-1 tw:gap-0.5"
                      direction="col">
                      <Typography
                        className={
                          isCheckComplete(result) ? 'tw:text-tertiary' : ''
                        }
                        size="text-sm"
                        weight={selected ? 'semibold' : 'medium'}>
                        {checkTitle(result)}
                      </Typography>
                      <Typography className="tw:text-quaternary" size="text-xs">
                        {t(subtitle.key, subtitle.values)}
                      </Typography>
                    </Box>
                    <Badge color="gray" size="sm" type="pill-color">
                      {t(checkRequirementLabel(result))}
                    </Badge>
                  </Box>
                </Button>
              </li>
            );
          })}
        </ol>
      </Card.Content>
      <Card.Footer>
        <Box align="center" className="tw:w-full tw:gap-2" wrap="wrap">
          <Typography className="tw:flex-1 tw:text-tertiary" size="text-xs">
            {t('message.steps-come-from-the-playbook', {
              maintainer: maintainer || t('label.your-administrator'),
            })}
          </Typography>
          <Button color="link-gray" size="sm" onPress={onRefresh}>
            {t('label.refresh')}
          </Button>
        </Box>
      </Card.Footer>
    </Card>
  );
};
