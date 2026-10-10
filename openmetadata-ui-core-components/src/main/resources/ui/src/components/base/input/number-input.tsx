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
import { forwardRef, type ReactNode } from 'react';
import { NumberField, type NumberFieldProps } from 'react-aria-components';
import { Minus, Plus } from '../../../icons';
import { cx } from '@/utils/cx';
import { Box } from '../box/box';
import { Button } from '../buttons/button';
import { HintText } from './hint-text';
import { InputBase, type InputBaseProps } from './input';
import { Label } from './label';

export interface NumberInputProps
  extends Omit<NumberFieldProps, 'children'>,
    Pick<
      InputBaseProps,
      'size' | 'inputDataTestId' | 'inputClassName' | 'placeholder'
    > {
  label?: ReactNode;
  hint?: ReactNode;
  showSteppers?: boolean;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      label,
      hint,
      size = 'sm',
      inputDataTestId,
      inputClassName,
      placeholder,
      showSteppers = true,
      className,
      ...props
    },
    ref
  ) {
    return (
      <NumberField
        {...props}
        className={(state) =>
          cx(
            'tw:group tw:flex tw:w-full tw:flex-col tw:gap-1.5',
            typeof className === 'function' ? className(state) : className
          )
        }>
        {({ isDisabled, isInvalid, state }) => (
          <>
            {label && <Label isRequired={props.isRequired}>{label}</Label>}
            <InputBase
              inputClassName={inputClassName}
              inputDataTestId={inputDataTestId}
              isDisabled={isDisabled}
              isInvalid={isInvalid}
              placeholder={placeholder}
              ref={ref}
              size={size}
              trailingSlot={
                showSteppers ? (
                  <Box gap={0}>
                    <Button
                      color="tertiary"
                      iconLeading={Minus}
                      isDisabled={!state.canDecrement}
                      size="xxs"
                      slot="decrement"
                      type="button"
                    />
                    <Button
                      color="tertiary"
                      iconLeading={Plus}
                      isDisabled={!state.canIncrement}
                      size="xxs"
                      slot="increment"
                      type="button"
                    />
                  </Box>
                ) : undefined
              }
            />
            {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
          </>
        )}
      </NumberField>
    );
  }
);
