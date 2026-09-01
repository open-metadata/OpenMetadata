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
  CheckboxBase,
  Typography,
} from '@openmetadata/ui-core-components';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getPasswordStrength,
  getSatisfiedPasswordRuleIds,
  PASSWORD_RULES,
  StrengthLevel,
} from './PasswordStrength.utils';

interface PasswordStrengthMeterProps {
  password: string;
}

const STRENGTH_LABEL: Record<StrengthLevel, string> = {
  [StrengthLevel.Weak]: 'label.weak',
  [StrengthLevel.Medium]: 'label.medium',
  [StrengthLevel.Strong]: 'label.strong',
};

const STRENGTH_BAR_CLASS: Record<StrengthLevel, string> = {
  [StrengthLevel.Weak]: 'tw:bg-error-solid',
  [StrengthLevel.Medium]: 'tw:bg-warning-solid',
  [StrengthLevel.Strong]: 'tw:bg-brand-solid',
};

const STRENGTH_TEXT_CLASS: Record<StrengthLevel, string> = {
  [StrengthLevel.Weak]: 'tw:text-error-primary',
  [StrengthLevel.Medium]: 'tw:text-warning-primary',
  [StrengthLevel.Strong]: 'tw:text-brand-secondary',
};

/**
 * The filled bar + strength word + per-rule checklist shown under the new
 * password field. Purely presentational: it derives everything from
 * `password`, so the form only has to own the value.
 */
const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
}) => {
  const { t } = useTranslation();
  const { strength, satisfiedIds } = useMemo(
    () => ({
      strength: getPasswordStrength(password),
      satisfiedIds: new Set(getSatisfiedPasswordRuleIds(password)),
    }),
    [password]
  );
  const filledPercent = (satisfiedIds.size / PASSWORD_RULES.length) * 100;

  return (
    <Box
      aria-live="polite"
      data-testid="password-strength-meter"
      direction="col"
      gap={2}>
      <Box align="center" gap={3}>
        <div
          aria-hidden
          className="tw:h-[5px] tw:flex-1 tw:overflow-hidden tw:rounded-[10px] tw:bg-quaternary">
          <div
            className={`tw:h-full tw:rounded-[10px] tw:transition-[width] ${STRENGTH_BAR_CLASS[strength]}`}
            style={{ width: `${filledPercent}%` }}
          />
        </div>
        <Typography
          className={STRENGTH_TEXT_CLASS[strength]}
          data-testid="password-strength-label"
          size="text-sm"
          weight="medium">
          {t(STRENGTH_LABEL[strength])}
        </Typography>
      </Box>
      <ul
        className="tw:m-0 tw:flex tw:list-none tw:flex-wrap tw:gap-4 tw:p-0"
        data-testid="password-rule-list">
        {PASSWORD_RULES.map((rule) => {
          const isSatisfied = satisfiedIds.has(rule.id);

          return (
            <li className="tw:flex tw:items-center tw:gap-2" key={rule.id}>
              <CheckboxBase isSelected={isSatisfied} size="sm" />
              <Typography
                className="tw:text-tertiary"
                data-testid={`password-rule-${rule.id}`}
                size="text-xs"
                weight="regular">
                {t(rule.labelKey)}
              </Typography>
              <span className="tw:sr-only">
                {isSatisfied
                  ? t('label.requirement-met')
                  : t('label.requirement-not-met')}
              </span>
            </li>
          );
        })}
      </ul>
    </Box>
  );
};

export default PasswordStrengthMeter;
