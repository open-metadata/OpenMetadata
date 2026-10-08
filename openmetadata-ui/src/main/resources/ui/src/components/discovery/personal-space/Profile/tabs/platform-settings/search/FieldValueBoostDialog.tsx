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
  Button,
  Dialog,
  FieldTypes,
  FormField,
  getField,
  HookForm,
  Modal,
  ModalOverlay,
  Slider,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  FieldValueBoost,
  Modifier,
} from '../../../../../../../generated/configuration/searchSettings';
import { BOOST_STEP, MAX_BOOST } from './TermBoostCard';

interface SelectItem {
  id: string;
  label: string;
}

interface FieldValueBoostFormValues {
  field: SelectItem | null;
  factor: number;
  modifier: SelectItem | null;
  missing: string;
  gte: string;
  lte: string;
  gt: string;
  lt: string;
}

const RANGE_KEYS = ['gte', 'lte', 'gt', 'lt'] as const;

const MODIFIER_ITEMS: SelectItem[] = Object.values(Modifier).map((value) => ({
  id: value,
  label: value,
}));

const toItem = (value?: string) => (value ? { id: value, label: value } : null);

export const toFieldValueBoostFormValues = (
  boost?: FieldValueBoost
): FieldValueBoostFormValues => ({
  field: toItem(boost?.field),
  factor: boost?.factor ?? 0,
  modifier: toItem(boost?.modifier ?? Modifier.None),
  missing: boost?.missing?.toString() ?? '0',
  gte: boost?.condition?.range?.gte?.toString() ?? '',
  lte: boost?.condition?.range?.lte?.toString() ?? '',
  gt: boost?.condition?.range?.gt?.toString() ?? '',
  lt: boost?.condition?.range?.lt?.toString() ?? '',
});

/** Empty range bounds are left out rather than sent as 0, as the classic modal did. */
export const toFieldValueBoost = (
  values: FieldValueBoostFormValues
): FieldValueBoost => ({
  field: values.field?.id ?? '',
  factor: values.factor,
  modifier: (values.modifier?.id as Modifier) ?? Modifier.None,
  missing: values.missing ? Number(values.missing) : 0,
  condition: {
    range: Object.fromEntries(
      RANGE_KEYS.filter((key) => values[key] !== '').map((key) => [
        key,
        Number(values[key]),
      ])
    ),
  },
});

interface FieldValueBoostDialogProps {
  /** Present when editing; its field cannot change. */
  boost?: FieldValueBoost;
  fieldOptions: string[];
  onSave: (boost: FieldValueBoost) => void | Promise<void>;
  onClose: () => void;
}

const FieldValueBoostDialog = ({
  boost,
  fieldOptions,
  onSave,
  onClose,
}: FieldValueBoostDialogProps) => {
  const { t } = useTranslation();
  const form = useForm<FieldValueBoostFormValues>({
    defaultValues: toFieldValueBoostFormValues(boost),
  });
  const title = t(boost ? 'label.edit-entity' : 'label.add-entity', {
    entity: t('label.field-value-boost'),
  });

  const fields: FieldProp[] = useMemo(
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

  const rangeFields: FieldProp[] = RANGE_KEYS.map((key) => {
    const labelKey = {
      gte: 'label.greater-than-or-equal-to',
      lte: 'label.less-than-or-equal-to',
      gt: 'label.greater-than',
      lt: 'label.less-than',
    }[key];

    return {
      name: key,
      label: t(labelKey),
      type: FieldTypes.NUMBER,
      props: { 'data-testid': `${key}-input` },
    };
  });

  const [fieldField, modifierField, missingField] = fields;

  return (
    <ModalOverlay isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          data-testid="field-value-boost-dialog"
          dividers="scroll"
          title={title}
          width={600}
          onClose={onClose}>
          <HookForm
            form={form}
            onSubmit={form.handleSubmit((values) =>
              onSave(toFieldValueBoost(values))
            )}>
            <Dialog.Content>
              <Box direction="col" gap={5}>
                {getField(fieldField)}
                <FormField control={form.control} name="factor">
                  {({ field }) => (
                    <Box direction="col" gap={1}>
                      <Box align="center" direction="row" justify="between">
                        <Typography
                          className="tw:text-secondary"
                          size="text-sm">
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
                          field.onChange(
                            Array.isArray(value) ? value[0] : value
                          )
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
                    {rangeFields.map((rangeField) => (
                      <div key={rangeField.name}>{getField(rangeField)}</div>
                    ))}
                  </div>
                </Box>
              </Box>
            </Dialog.Content>
            <Dialog.Footer>
              <div className="tw:col-span-2 tw:flex tw:justify-end tw:gap-3">
                <Button color="tertiary" size="sm" onPress={onClose}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="save-field-value-boost"
                  size="sm"
                  type="submit">
                  {t('label.save')}
                </Button>
              </div>
            </Dialog.Footer>
          </HookForm>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default FieldValueBoostDialog;
