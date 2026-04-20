/*
 *  Copyright 2025 Collate.
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

import type { FC, ReactNode } from 'react';
import { Fragment } from 'react';
import type { RegisterOptions } from 'react-hook-form';
import { useFormContext } from 'react-hook-form';
import { Alert } from '@/components/base/alert/alert';
import { Divider } from '@/components/base/divider/divider';
import { FormField } from '@/components/base/form/hook-form';
import { HintText } from '@/components/base/input/hint-text';
import { type FieldProp, HelperTextType } from './form-field.types';
import { FormItemLabel } from './form-item-label';
import { renderFieldElement } from './render-field-element';

export const Field: FC<{ field: FieldProp }> = ({ field }) => {
  const { control } = useFormContext();
  const {
    name,
    label,
    required,
    rules,
    id,
    helperText,
    helperTextType = HelperTextType.ALERT,
    hasSeparator = false,
    isBeta = false,
  } = field;

  const effectiveRules: RegisterOptions = { ...rules };
  if (required && !effectiveRules.required) {
    effectiveRules.required = true;
  }

  return (
    <FormField control={control} name={name} rules={effectiveRules}>
      {(controller) => {
        const { fieldState } = controller;

        return (
          <Fragment key={id}>
            <div className="tw:flex tw:flex-col tw:gap-[6px]">
              <FormItemLabel
                isBeta={isBeta}
                label={label}
                required={required}
                tooltip={
                  helperTextType === HelperTextType.TOOLTIP
                    ? helperText
                    : undefined
                }
              />

              {renderFieldElement(controller, field)}
            </div>

            {fieldState.error && (
              <HintText isInvalid>{fieldState.error.message}</HintText>
            )}

            {helperTextType === HelperTextType.ALERT && helperText && (
              <Alert
                data-testid="form-item-alert"
                title={typeof helperText === 'string' ? helperText : ''}
                variant="warning">
                {typeof helperText !== 'string' ? helperText : undefined}
              </Alert>
            )}

            {hasSeparator && <Divider />}
          </Fragment>
        );
      }}
    </FormField>
  );
};

Field.displayName = 'Field';

export const getField = (fieldProp: FieldProp): ReactNode => (
  <Field field={fieldProp} />
);

export const FormFields: FC<{ fields: FieldProp[] }> = ({ fields }) => (
  <>
    {fields.map((f, i) => (
      <Field field={f} key={f.id ?? f.name ?? i} />
    ))}
  </>
);

FormFields.displayName = 'FormFields';
