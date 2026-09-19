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

import { Input, Select, Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import {
  OnboardingCondition,
  Operator,
} from '../../../generated/entity/governance/onboardingPlaybook';

/** Fields a condition can test. `tags` drives the design's "PII tags present" style conditions. */
export const CONDITION_FIELDS = [
  'tags',
  'domains',
  'owners',
  'experts',
  'glossaryTerms',
  'certification',
];

export const ALL_ASSETS = 'all';

const OPERATORS = [
  Operator.Present,
  Operator.Equals,
  Operator.Contains,
  Operator.StartsWith,
];

const OPERATOR_LABEL_KEY: Record<Operator, string> = {
  [Operator.Contains]: 'label.contains',
  [Operator.Equals]: 'label.operator-equals',
  [Operator.Present]: 'label.operator-present',
  [Operator.StartsWith]: 'label.starts-with',
};

interface PlaybookConditionEditorProps {
  condition?: OnboardingCondition;
  onChange: (condition?: OnboardingCondition) => void;
}

/**
 * When a check applies.
 *
 * <p>Conditions are how one playbook covers a whole asset type instead of several competing ones,
 * so a check that does not apply to an asset is not merely skipped - it was never asked of it.
 * `startsWith` exists for exactly the classification case: `PII.` matches every tag under it.
 */
export const PlaybookConditionEditor = ({
  condition,
  onChange,
}: PlaybookConditionEditorProps) => {
  const { t } = useTranslation();
  const operator = condition?.operator ?? Operator.Present;
  const needsValue = operator !== Operator.Present;

  return (
    <section className="tw:flex tw:flex-col tw:gap-2">
      <Select
        data-testid="check-condition-field"
        hint={t('message.conditions-cover-a-whole-asset-type')}
        label={t('label.applies-when')}
        selectedKey={condition?.fieldPath ?? ALL_ASSETS}
        onSelectionChange={(key) =>
          onChange(
            key === ALL_ASSETS
              ? undefined
              : {
                  fieldPath: String(key),
                  operator,
                  value: condition?.value,
                }
          )
        }>
        <Select.Item id={ALL_ASSETS} label={t('label.all-assets')}>
          {t('label.all-assets')}
        </Select.Item>
        {CONDITION_FIELDS.map((field) => (
          <Select.Item id={field} key={field} label={field}>
            {field}
          </Select.Item>
        ))}
      </Select>

      {condition && (
        <div className="tw:flex tw:flex-col tw:gap-2">
          <Select
            aria-label={t('label.operator')}
            data-testid="check-condition-operator"
            selectedKey={operator}
            onSelectionChange={(key) =>
              onChange({
                ...condition,
                operator: key as Operator,
                value: key === Operator.Present ? undefined : condition.value,
              })
            }>
            {OPERATORS.map((item) => (
              <Select.Item
                id={item}
                key={item}
                label={t(OPERATOR_LABEL_KEY[item])}>
                {t(OPERATOR_LABEL_KEY[item])}
              </Select.Item>
            ))}
          </Select>

          {needsValue && (
            <Input
              aria-label={t('label.value')}
              inputDataTestId="check-condition-value"
              placeholder={t('message.condition-value-placeholder')}
              value={typeof condition.value === 'string' ? condition.value : ''}
              onChange={(value) => onChange({ ...condition, value })}
            />
          )}

          {operator === Operator.StartsWith && (
            <Typography className="tw:text-xs tw:text-tertiary">
              {t('message.starts-with-matches-a-classification')}
            </Typography>
          )}
        </div>
      )}
    </section>
  );
};
