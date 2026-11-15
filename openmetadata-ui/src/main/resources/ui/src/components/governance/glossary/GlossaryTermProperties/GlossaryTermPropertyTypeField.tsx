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

import { RadioGroup, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useId } from 'react';
import { Radio } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { GlossaryTermPropertyDatatype } from '../../../../generated/type/glossaryTermProperty';
import { PROPERTY_TYPE_OPTIONS } from '../../../../utils/governance/glossary/GlossaryTermProperties.constants';
import GlossaryTermPropertyTypeTile from './GlossaryTermPropertyTypeTile';

interface GlossaryTermPropertyTypeFieldProps {
  datatype: GlossaryTermPropertyDatatype;
  isLocked: boolean;
  onChange: (datatype: GlossaryTermPropertyDatatype) => void;
}

const GlossaryTermPropertyTypeField = ({
  datatype,
  isLocked,
  onChange,
}: GlossaryTermPropertyTypeFieldProps) => {
  const { t } = useTranslation();
  const labelId = useId();
  // The picker offers one Number card for both stored numeric types.
  const selected =
    datatype === GlossaryTermPropertyDatatype.Integer
      ? GlossaryTermPropertyDatatype.Decimal
      : datatype;

  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      <Typography as="span" id={labelId} size="text-sm" weight="medium">
        {t('label.type')}
      </Typography>
      <RadioGroup
        aria-labelledby={labelId}
        className="tw:grid tw:grid-cols-3 tw:gap-2"
        data-testid={isLocked ? 'property-type-locked' : 'property-type'}
        isDisabled={isLocked}
        value={selected}
        onChange={(value) => onChange(value as GlossaryTermPropertyDatatype)}>
        {PROPERTY_TYPE_OPTIONS.map((option) => (
          <Radio
            className={({ isSelected, isFocusVisible, isDisabled }) =>
              classNames(
                'tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-sm tw:font-medium tw:text-secondary tw:outline-hidden',
                isSelected
                  ? 'tw:border-brand tw:bg-brand-primary'
                  : 'tw:border-primary tw:bg-primary',
                isDisabled && !isSelected
                  ? 'tw:cursor-not-allowed tw:opacity-50'
                  : 'tw:cursor-pointer',
                isFocusVisible &&
                  'tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring'
              )
            }
            data-testid={`property-type-option-${option.datatype}`}
            key={option.datatype}
            value={option.datatype}>
            <GlossaryTermPropertyTypeTile
              datatype={option.datatype}
              size="sm"
            />
            {t(option.labelKey)}
          </Radio>
        ))}
      </RadioGroup>
    </div>
  );
};

export default GlossaryTermPropertyTypeField;
