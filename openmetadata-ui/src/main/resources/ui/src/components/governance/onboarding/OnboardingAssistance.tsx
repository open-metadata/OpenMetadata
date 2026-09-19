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
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { Assistance } from '../../../generated/entity/governance/onboardingPlaybook';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import { OnboardingStep } from '../../../generated/governance/onboarding/onboardingProgress';
import { useSiblingSuggestion } from '../../../hooks/governance/onboarding/useSiblingSuggestion';
import { hasValue } from '../../../utils/governance/onboarding/Onboarding.utils';

interface Props {
  step: OnboardingStep;
  fieldPath: string;
  entityType: TargetEntityType;
  /** The asset's domain, fully qualified - siblings are looked for inside it. */
  domain?: string;
  value: unknown;
  onApply: (value: unknown) => void;
}

const ENTITY_PLURAL_KEYS: Record<TargetEntityType, string> = {
  [TargetEntityType.DataProduct]: 'label.data-product-plural',
  [TargetEntityType.Domain]: 'label.domain-plural',
  [TargetEntityType.GlossaryTerm]: 'label.glossary-term-plural',
  [TargetEntityType.Metric]: 'label.metric-plural',
};

/**
 * The help the playbook author offered for this check.
 *
 * <p>`autofill` reports what the asset's neighbours already do and offers to copy it; `example`
 * repeats the author's guidance as something to imitate. Both only appear while the field is
 * empty - once there is an answer, a suggestion is just noise.
 */
export const OnboardingAssistance = ({
  step,
  fieldPath,
  entityType,
  domain,
  value,
  onApply,
}: Props) => {
  const { t } = useTranslation();
  const isEmpty = !hasValue(value);
  const wantsSiblings = step.assistance === Assistance.Autofill && isEmpty;
  const { suggestion } = useSiblingSuggestion(
    entityType,
    fieldPath,
    domain,
    wantsSiblings
  );

  if (step.assistance === Assistance.Example && isEmpty && step.guidance) {
    return (
      <Card color="brandOutlined" data-testid="onboarding-assistance">
        <Card.Content>
          <Box className="tw:gap-1" direction="col">
            <Typography size="text-xs" weight="semibold">
              {t('label.example')}
            </Typography>
            <Typography className="tw:text-tertiary" size="text-sm">
              {step.guidance}
            </Typography>
          </Box>
        </Card.Content>
      </Card>
    );
  }

  if (!wantsSiblings || !suggestion) {
    return null;
  }

  return (
    <Card color="brandOutlined" data-testid="onboarding-assistance">
      <Card.Content>
        <Box align="center" className="tw:gap-3" wrap="wrap">
          <Typography className="tw:flex-1" size="text-sm">
            {t('message.siblings-use-this-value', {
              count: suggestion.count,
              domain,
              entity: t(ENTITY_PLURAL_KEYS[entityType]).toLowerCase(),
              total: suggestion.total,
              value: suggestion.label,
            })}
          </Typography>
          <Button
            color="secondary"
            data-testid="onboarding-copy-setup"
            size="sm"
            onPress={() => onApply(suggestion.value)}>
            {t('label.copy-that-setup')}
          </Button>
        </Box>
      </Card.Content>
    </Card>
  );
};
