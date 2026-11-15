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
import { Box, Input, Typography } from '@openmetadata/ui-core-components';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTermPropertyDatatype } from '../../../../generated/type/glossaryTermProperty';
import {
  GlossaryTermPropertyDraft,
  GlossaryTermPropertyDraftErrors,
  GlossaryTermPropertyMode,
  GlossaryTermPropertyValueInputProps,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.types';
import GlossaryTermPropertyEnumField from './GlossaryTermPropertyEnumField';
import GlossaryTermPropertyTypeField from './GlossaryTermPropertyTypeField';
import GlossaryTermPropertyValueInput from './GlossaryTermPropertyValueInput';

interface GlossaryTermPropertyFieldsProps {
  mode: GlossaryTermPropertyMode;
  draft: GlossaryTermPropertyDraft;
  errors: GlossaryTermPropertyDraftErrors;
  /** What the value input validates and renders against; the stored definition wins over the draft. */
  valueProperty: GlossaryTermPropertyValueInputProps['property'];
  valueLabel: string;
  nameValue: string;
  /** Names the term the modal edits; the subtitle changes with the mode. */
  subtitle: string;
  note?: string;
  onChange: (changes: Partial<GlossaryTermPropertyDraft>) => void;
}

const GlossaryTermPropertyFields = ({
  mode,
  draft,
  errors,
  valueProperty,
  valueLabel,
  nameValue,
  subtitle,
  note,
  onChange,
}: GlossaryTermPropertyFieldsProps) => {
  const { t } = useTranslation();
  const descriptionLabelId = useId();
  const isNew = mode === 'new';
  const isOverride = mode === 'override';
  const nameError = errors.displayName;

  return (
    <Box direction="col" gap={4}>
      <Typography color="secondary" size="text-sm">
        {subtitle}
      </Typography>
      <Input
        hint={nameError ? t(nameError.key, nameError.values) : undefined}
        inputDataTestId="property-name-input"
        isDisabled={isOverride}
        isInvalid={Boolean(nameError)}
        label={t('label.name')}
        placeholder={t('label.property-name-example')}
        value={nameValue}
        onChange={(displayName) => onChange({ displayName })}
      />

      <GlossaryTermPropertyTypeField
        datatype={valueProperty.datatype}
        isLocked={!isNew}
        onChange={(datatype) => onChange({ datatype, value: '' })}
      />

      {note && (
        <Typography
          className="tw:-mt-2 tw:text-warning-primary"
          data-testid="property-type-note"
          size="text-xs">
          {note}
        </Typography>
      )}

      {!isOverride &&
        valueProperty.datatype === GlossaryTermPropertyDatatype.Enum && (
          <GlossaryTermPropertyEnumField
            error={errors.enumValues}
            value={draft.enumValuesText}
            onChange={(enumValuesText) => onChange({ enumValuesText })}
          />
        )}

      <GlossaryTermPropertyValueInput
        error={errors.value}
        label={valueLabel}
        property={valueProperty}
        testId="property-value-input"
        value={draft.value}
        onChange={(value) => onChange({ value })}
      />

      {!isOverride && (
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <div className="tw:flex tw:flex-col">
            <Typography
              as="span"
              id={descriptionLabelId}
              size="text-sm"
              weight="medium">
              {t('label.description')}
            </Typography>
            <Typography as="span" color="secondary" size="text-sm">
              {t('label.optional')}
            </Typography>
          </div>
          <Input
            aria-labelledby={descriptionLabelId}
            inputDataTestId="property-description-input"
            placeholder={t('label.what-this-property-captures')}
            value={draft.description}
            onChange={(description) => onChange({ description })}
          />
        </div>
      )}
    </Box>
  );
};

export default GlossaryTermPropertyFields;
