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

import type { FieldProp } from '@openmetadata/ui-core-components';
import {
  Box,
  FieldTypes,
  FormField,
  getField,
  Slider,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FieldValueBoost } from '../../../../../../../generated/configuration/searchSettings';
import {
  FieldValueBoostFormValues,
  MODIFIER_ITEMS,
  RANGE_KEYS,
} from './SearchSettings.utils';
import { BOOST_STEP, MAX_BOOST } from './TermBoostCard';

const RANGE_LABEL_KEYS: Record<(typeof RANGE_KEYS)[number], string> = {
  gte: 'label.greater-than-or-equal-to',
  lte: 'label.less-than-or-equal-to',
  gt: 'label.greater-than',
  lt: 'label.less-than',
};

interface FieldValueBoostFieldsProps {
  form: UseFormReturn<FieldValueBoostFormValues>;
  /** Present when editing; its field cannot change. */
  boost?: FieldValueBoost;
  fieldOptions: string[];
}

/** The field value boost inputs; the caller supplies the `HookForm` around them. */
const FieldValueBoostFields = ({
  form,
  boost,
  fieldOptions,
}: FieldValueBoostFieldsProps) => {
  const { t } = useTranslation();

  const [fieldField, modifierField, missingField]: FieldProp[] = useMemo(
    () => [
      {
        name: 'field',
        label: t('label.field'),
        type: FieldTypes.SELECT,
        required: true,
        placeholder: t('label.select-field', { field: t('label.field') }),
        props: {
          'data-testid': 'field-select',
          isDisabled: Boolean(boost),
          items: fieldOptions.map((option) => ({ id: option, label: option })),
        },
        rules: { required: t('message.field-required') },
      },
      {
        name: 'modifier',
        label: t('label.modifier'),
        type: FieldTypes.SELECT,
        props: { 'data-testid': 'modifier-select', items: MODIFIER_ITEMS },
      },
      {
        name: 'missing',
        label: t('label.missing-value'),
        type: FieldTypes.NUMBER,
        props: { 'data-testid': 'missing-value-input' },
      },
    ],
    [boost, fieldOptions, t]
  );

  return (
    <Box direction="col" gap={5}>
      {getField(fieldField)}
      <FormField control={form.control} name="factor">
        {({ field }) => (
          <Box direction="col" gap={1}>
            <Box align="center" direction="row" justify="between">
              <Typography className="tw:text-secondary" size="text-sm">
                {t('label.impact')}
              </Typography>
              <Typography
                className="tw:text-brand-secondary"
                data-testid="field-boost-value"
                size="text-sm"
                weight="semibold">
                {field.value}
              </Typography>
            </Box>
            <Slider
              aria-label={t('label.impact')}
              data-testid="field-boost-slider"
              maxValue={MAX_BOOST}
              minValue={0}
              step={BOOST_STEP}
              value={field.value}
              onChange={(value) =>
                field.onChange(Array.isArray(value) ? value[0] : value)
              }
            />
          </Box>
        )}
      </FormField>
      <div className="tw:grid tw:grid-cols-2 tw:gap-4">
        {getField(modifierField)}
        {getField(missingField)}
      </div>
      <Box direction="col" gap={2}>
        <Typography size="text-sm" weight="medium">
          {t('label.range-condition')}
        </Typography>
        <div className="tw:grid tw:grid-cols-2 tw:gap-4">
          {RANGE_KEYS.map((key) => (
            <div key={key}>
              {getField({
                name: key,
                label: t(RANGE_LABEL_KEYS[key]),
                type: FieldTypes.NUMBER,
                props: { 'data-testid': `${key}-input` },
              })}
            </div>
          ))}
        </div>
      </Box>
    </Box>
  );
};

export default FieldValueBoostFields;
