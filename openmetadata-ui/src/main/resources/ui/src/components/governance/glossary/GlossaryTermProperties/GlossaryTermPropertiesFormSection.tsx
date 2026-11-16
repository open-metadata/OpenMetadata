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
  BadgeWithIcon,
  Box,
  Button,
  ButtonUtility,
  FormItemLabel,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ClockRewind,
  CornerDownRight,
  Edit01,
  Plus,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import { useMemo, useState } from 'react';
import { useFieldArray, UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import { GlossaryTermPropertyDatatype } from '../../../../generated/type/glossaryTermProperty';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { PROPERTY_TYPE_OPTIONS } from '../../../../utils/governance/glossary/GlossaryTermProperties.constants';
import {
  GlossaryTermPropertyDraftErrors,
  InheritedPropertyEntry,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.types';
import {
  fromPropertyValues,
  getPropertyLabel,
  newPropertyRow,
  parseEnumValues,
  validateInheritedValues,
  validatePropertyRows,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.utils';
import { GlossaryTermFormValues } from '../../../Glossary/AddGlossaryTermForm/AddGlossaryTermForm.interface';
import GlossaryTermPropertyTypeTile from './GlossaryTermPropertyTypeTile';
import GlossaryTermPropertyValueCell from './GlossaryTermPropertyValueCell';
import GlossaryTermPropertyValueInput from './GlossaryTermPropertyValueInput';

interface GlossaryTermPropertiesFormSectionProps {
  form: UseFormReturn<GlossaryTermFormValues>;
  inheritedProperties: InheritedPropertyEntry[];
  /** Name of the term the new one is created under. */
  parentName?: string;
}

const GlossaryTermPropertiesFormSection = ({
  form,
  inheritedProperties,
  parentName,
}: GlossaryTermPropertiesFormSectionProps) => {
  const { t } = useTranslation();
  const [editingName, setEditingName] = useState<string>();
  const inheritedNames = useMemo(
    () => inheritedProperties.map((entry) => entry.property.name),
    [inheritedProperties]
  );
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'propertyRows',
    rules: {
      // Blocks submit; the messages themselves render on each row.
      validate: (value) =>
        (Object.keys(validatePropertyRows(value, inheritedNames)).length ===
          0 &&
          Object.keys(
            validateInheritedValues(
              inheritedProperties,
              form.getValues('inheritedPropertyValues') ?? {}
            )
          ).length === 0) ||
        t('message.glossary-term-property-rows-invalid'),
    },
  });
  const rows = useWatch({ control: form.control, name: 'propertyRows' });
  const watchedOverrides = useWatch({
    control: form.control,
    name: 'inheritedPropertyValues',
  });
  const overrides = useMemo(() => watchedOverrides ?? {}, [watchedOverrides]);
  const errors = useMemo(
    () => validatePropertyRows(rows ?? [], inheritedNames),
    [rows, inheritedNames]
  );
  const overrideErrors = useMemo(
    () => validateInheritedValues(inheritedProperties, overrides),
    [inheritedProperties, overrides]
  );
  const isSubmitted = form.formState.isSubmitted;

  const getErrors = (rowId: string): GlossaryTermPropertyDraftErrors =>
    isSubmitted ? errors[rowId] ?? {} : {};

  // A blank override is the same as none, so clearing the text reverts to the inherited value.
  const setOverride = (name: string, text: string) => {
    const { [name]: _removed, ...rest } = overrides;
    form.setValue(
      'inheritedPropertyValues',
      text === '' ? rest : { ...rest, [name]: text }
    );
  };
  const revertOverride = (name: string) => {
    setOverride(name, '');
    setEditingName((current) => (current === name ? undefined : current));
  };

  return (
    <Box
      className="tw:gap-3"
      data-testid="glossary-term-properties-section"
      direction="col">
      <Box direction="col">
        <FormItemLabel label={t('label.property-plural')} />
        {inheritedProperties.length > 0 && (
          <Typography color="secondary" size="text-sm">
            {t('message.glossary-term-properties-inherited-summary', {
              count: inheritedProperties.length,
              term: parentName,
            })}
          </Typography>
        )}
      </Box>

      {inheritedProperties.length > 0 && (
        <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:divide-y tw:divide-secondary tw:rounded-lg tw:border tw:border-secondary tw:p-0">
          {inheritedProperties.map((entry) => {
            const { property } = entry;
            const override = overrides[property.name];
            const isOverridden = override !== undefined;
            const isEditing = editingName === property.name;
            const shown = {
              property,
              values: isOverridden ? [override] : entry.values,
            };

            return (
              <li
                className="tw:flex tw:flex-col tw:gap-3 tw:p-3"
                data-testid={`inherited-property-${property.name}`}
                key={property.name}>
                <Box align="center" gap={3} justify="between">
                  <Box align="center" className="tw:min-w-0" gap={3}>
                    <GlossaryTermPropertyTypeTile
                      datatype={property.datatype}
                    />
                    <Typography size="text-sm" weight="medium">
                      {getPropertyLabel(property)}
                    </Typography>
                  </Box>
                  <Box align="center" gap={2} justify="end" wrap="wrap">
                    <GlossaryTermPropertyValueCell entry={shown} />
                    <BadgeWithIcon
                      color="blue"
                      iconLeading={CornerDownRight}
                      size="sm"
                      type="color">
                      {getEntityName(entry.declaredBy)}
                    </BadgeWithIcon>
                    {isOverridden && (
                      <Badge color="orange" size="sm" type="color">
                        {t('label.overridden-here')}
                      </Badge>
                    )}
                    <ButtonUtility
                      data-testid={`override-inherited-${property.name}`}
                      icon={Edit01}
                      size="sm"
                      tooltip={t('label.override-value-for-this-term')}
                      onClick={() =>
                        setEditingName(isEditing ? undefined : property.name)
                      }
                    />
                    {isOverridden && (
                      <ButtonUtility
                        data-testid={`revert-inherited-${property.name}`}
                        icon={ClockRewind}
                        size="sm"
                        tooltip={t('label.reset-to-inherited-value')}
                        onClick={() => revertOverride(property.name)}
                      />
                    )}
                  </Box>
                </Box>
                {isEditing && (
                  <GlossaryTermPropertyValueInput
                    error={
                      isSubmitted ? overrideErrors[property.name] : undefined
                    }
                    label={t('label.value-for-this-term')}
                    property={property}
                    testId={`inherited-value-${property.name}`}
                    value={
                      override ?? fromPropertyValues(property, entry.values)
                    }
                    onChange={(text) => setOverride(property.name, text)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {fields.map((field, index) => {
        const row = rows?.[index] ?? field;
        const rowErrors = getErrors(field.rowId);
        const valueProperty = {
          datatype: row.datatype,
          enumValues: parseEnumValues(row.enumValuesText),
        };

        return (
          <Box
            className="tw:rounded-lg tw:border tw:border-secondary tw:p-3"
            data-testid={`property-row-${index}`}
            direction="col"
            gap={3}
            key={field.id}>
            <Box align="start" gap={2}>
              <div className="tw:min-w-0 tw:flex-1">
                <Input
                  hint={
                    rowErrors.displayName
                      ? t(
                          rowErrors.displayName.key,
                          rowErrors.displayName.values
                        )
                      : undefined
                  }
                  inputDataTestId={`property-name-${index}`}
                  isInvalid={Boolean(rowErrors.displayName)}
                  placeholder={t('label.property-name')}
                  value={row.displayName}
                  onChange={(value) =>
                    form.setValue(`propertyRows.${index}.displayName`, value)
                  }
                />
              </div>
              <div className="tw:w-40 tw:shrink-0">
                <Select
                  aria-label={t('label.type')}
                  data-testid={`property-type-${index}`}
                  items={PROPERTY_TYPE_OPTIONS.map((option) => ({
                    id: option.datatype,
                    label: t(option.labelKey),
                  }))}
                  value={row.datatype}
                  onChange={(key) => {
                    form.setValue(
                      `propertyRows.${index}.datatype`,
                      String(key) as GlossaryTermPropertyDatatype
                    );
                    form.setValue(`propertyRows.${index}.value`, '');
                  }}>
                  {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
              </div>
              <ButtonUtility
                data-testid={`remove-property-${index}`}
                icon={XClose}
                size="lg"
                tooltip={t('label.remove')}
                onClick={() => remove(index)}
              />
            </Box>
            {row.datatype === GlossaryTermPropertyDatatype.Enum && (
              <Input
                hint={
                  rowErrors.enumValues
                    ? t(rowErrors.enumValues.key, rowErrors.enumValues.values)
                    : t('message.separate-values-with-commas')
                }
                inputDataTestId={`property-enum-values-${index}`}
                isInvalid={Boolean(rowErrors.enumValues)}
                placeholder={t('label.allowed-values')}
                value={row.enumValuesText}
                onChange={(value) =>
                  form.setValue(`propertyRows.${index}.enumValuesText`, value)
                }
              />
            )}
            <div className="tw:[&_label]:sr-only">
              <GlossaryTermPropertyValueInput
                error={rowErrors.value}
                label={t('label.value')}
                property={valueProperty}
                testId={`property-value-${index}`}
                value={row.value}
                onChange={(value) =>
                  form.setValue(`propertyRows.${index}.value`, value)
                }
              />
            </div>
          </Box>
        );
      })}

      <Box align="start" direction="col" gap={2}>
        <Button
          color="secondary"
          data-testid="add-property-row"
          iconLeading={Plus}
          size="sm"
          onPress={() => append(newPropertyRow(uuid()))}>
          {t('label.add-property')}
        </Button>
        <Typography color="secondary" size="text-xs">
          {t('message.glossary-term-properties-create-note')}
        </Typography>
      </Box>
    </Box>
  );
};

export default GlossaryTermPropertiesFormSection;
