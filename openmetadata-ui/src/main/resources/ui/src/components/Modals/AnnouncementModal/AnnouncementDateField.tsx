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
  DatePicker,
  HintText,
  Label,
  parseDate,
} from '@openmetadata/ui-core-components';
import { useRef } from 'react';
import { fromCalendarValue, toCalendarDay } from './announcementFormUtils';

/**
 * The error line under a field that is not an `Input` — an `Input` takes the
 * message as its own `hint`, which also wires `aria-describedby` to it. Core's
 * `HintText` is the same element either way, so the two read alike.
 */
export const AnnouncementFieldError = ({
  message,
  testId,
}: {
  message?: string;
  testId: string;
}) =>
  message ? (
    <HintText isInvalid data-testid={testId}>
      {message}
    </HintText>
  ) : null;

interface AnnouncementDateFieldProps {
  /** `end` anchors the value to 23:59:59.999 so the chosen day is included. */
  boundary?: 'start' | 'end';
  error?: string;
  id: string;
  label: string;
  value?: number | null;
  onChange: (value: number | null) => void;
  /**
   * Turns the picked `yyyy-MM-dd` day into the stored epoch millis. Defaults to
   * the day's start (or end, per `boundary`); a form that also edits the time of
   * day passes one that keeps the time it already holds.
   */
  toValue?: (day: string | null) => number | null;
}

/**
 * The design system's `DatePicker` in its `input` trigger variant: a
 * field-shaped control with a leading calendar icon, opening a popover with a
 * calendar, a typable date field and a Today preset. The `input` shape is what
 * the design calls for here — these sit in a labelled column with the other
 * fields, so they have to line up with them rather than read as a pair of loose
 * buttons.
 *
 * The epoch-millis bridge crosses as a `yyyy-MM-dd` string and is rebuilt with
 * core's own `parseDate`. The app and the design system each resolve their own
 * `@internationalized/date`, so a `DateValue` built here is a different type
 * from the one this prop expects; a plain day string has no such identity.
 */
export const AnnouncementDateField = ({
  boundary = 'start',
  error,
  id,
  label,
  value,
  onChange,
  toValue,
}: AnnouncementDateFieldProps) => {
  // What the field held when the popover opened. Core's `DatePicker` commits
  // every day click straight through `onChange`, so without restoring this a
  // mis-click survives dismissing the popover and gets submitted.
  const valueOnOpen = useRef<number | null>(value ?? null);
  // Apply is the only confirming exit. Cancel, Escape and an outside click all
  // leave through `onOpenChange(false)` — and react-aria calls `onCancel` for
  // the button alone — so the revert hangs off the close, not off Cancel.
  const wasApplied = useRef(false);
  const resolve = toValue ?? ((day) => fromCalendarValue(day, boundary));

  return (
    <Box className="tw:min-w-0 tw:flex-1 tw:gap-1.5" direction="col">
      <Label isRequired htmlFor={id}>
        {label}
      </Label>
      <DatePicker
        aria-label={label}
        data-testid={id}
        id={id}
        isInvalid={Boolean(error)}
        triggerVariant="input"
        value={value == null ? null : parseDate(toCalendarDay(value))}
        onApply={() => {
          wasApplied.current = true;
        }}
        onChange={(selected) => onChange(resolve(selected?.toString() ?? null))}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            valueOnOpen.current = value ?? null;
            wasApplied.current = false;
          } else if (!wasApplied.current) {
            onChange(valueOnOpen.current);
          }
        }}
      />
      <AnnouncementFieldError message={error} testId={`${id}-error`} />
    </Box>
  );
};
