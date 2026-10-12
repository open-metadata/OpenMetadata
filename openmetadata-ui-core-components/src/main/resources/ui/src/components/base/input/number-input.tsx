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
import { mergeRefs } from '@react-aria/utils';
import { cx } from '../../../utils/cx';
import {
  type ComponentProps,
  forwardRef,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Input } from './input';

export interface NumberInputProps
  extends Omit<
    ComponentProps<typeof Input>,
    'value' | 'defaultValue' | 'onChange' | 'step'
  > {
  value?: number | null;
  defaultValue?: number | null;
  onChange?: (value: number | null) => void;
  minValue?: number;
  maxValue?: number;
  step?: number;
  precision?: number;
  suffix?: ReactNode;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      value,
      defaultValue,
      onChange,
      minValue,
      maxValue,
      step = 1,
      precision,
      suffix,
      onBlur,
      onKeyDown,
      ...props
    },
    ref
  ) {
    const initial = value !== undefined ? value : defaultValue;
    const [draft, setDraft] = useState(initial == null ? '' : String(initial));
    const lastValid = useRef<number | null>(initial ?? null);
    const lastNotified = useRef<number | null | undefined>(value);
    const previousValue = useRef(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (value !== undefined || previousValue.current !== undefined) {
        // Our own callback must not replace a still-edited string such as "1e2".
        if (!Object.is(value, lastNotified.current)) {
          setDraft(value == null ? '' : String(value));
        }
        lastValid.current = value ?? null;
        lastNotified.current = value;
      }
      previousValue.current = value;
    }, [value]);

    const rounded = (number: number) =>
      precision === undefined
        ? number
        : Number(number.toFixed(Math.min(20, Math.max(0, precision))));
    const clamp = (number: number) =>
      Math.max(minValue ?? -Infinity, Math.min(maxValue ?? Infinity, number));
    const notify = (next: number | null) => {
      if (Object.is(next, lastValid.current)) {
        return;
      }
      lastValid.current = next;
      lastNotified.current = next;
      onChange?.(next);
    };
    const updateDraft = (text: string) => {
      setDraft(text);
      // Native numeric inputs retain incomplete edits ("-", "1e") separately from value.
      if (inputRef.current?.validity.badInput) {
        return;
      }
      if (text === '') {
        notify(null);

        return;
      }
      const next = rounded(Number(text));
      if (
        Number.isFinite(next) &&
        next >= (minValue ?? -Infinity) &&
        next <= (maxValue ?? Infinity)
      ) {
        notify(next);
      }
    };
    const decimalPlaces = (number: number) => {
      const [mantissa, exponent = '0'] = String(number).split('e');

      return Math.max(
        0,
        (mantissa.split('.')[1]?.length ?? 0) - Number(exponent)
      );
    };
    const commit = () => {
      const parsed = draft === '' ? null : Number(draft);
      const next =
        inputRef.current?.validity.badInput ||
        (parsed !== null && !Number.isFinite(parsed))
          ? lastValid.current
          : parsed === null
          ? null
          : clamp(rounded(clamp(parsed)));
      setDraft(next === null ? '' : String(next));
      notify(next);
    };

    return (
      <Input
        {...props}
        aria-valuemax={maxValue}
        aria-valuemin={minValue}
        // Native spinner buttons snap to a step grid; keyboard arrows below
        // increment relative to the edited decimal instead.
        inputClassName={cx(
          props.inputClassName,
          'tw:[appearance:textfield] tw:[&::-webkit-inner-spin-button]:appearance-none tw:[&::-webkit-outer-spin-button]:appearance-none'
        )}
        ref={mergeRefs<HTMLInputElement>(inputRef, ref)}
        step="any"
        trailingSlot={
          suffix ? (
            <span className="tw:pe-3 tw:text-tertiary">{suffix}</span>
          ) : (
            props.trailingSlot
          )
        }
        type="number"
        value={draft}
        onBlur={(event) => {
          commit();
          onBlur?.(event);
        }}
        onChange={updateDraft}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || props.isReadOnly || props.isDisabled) {
            return;
          }
          if (event.key === 'Enter') {
            commit();
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const current =
              draft !== '' && Number.isFinite(Number(draft))
                ? Number(draft)
                : lastValid.current ?? 0;
            // Add to the current value instead of snapping an off-grid decimal to an integer.
            const places = Math.min(
              20,
              Math.max(decimalPlaces(current), decimalPlaces(step))
            );
            const stepped = Number(
              (
                current +
                (event.key === 'ArrowUp' ? step : -step) *
                  (event.shiftKey ? 10 : 1)
              ).toFixed(places)
            );
            const next = clamp(rounded(stepped));
            setDraft(String(next));
            notify(next);
          }
        }}
      />
    );
  }
);
