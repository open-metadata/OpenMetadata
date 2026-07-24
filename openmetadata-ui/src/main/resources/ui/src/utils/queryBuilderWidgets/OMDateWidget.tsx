/*
 *  Copyright 2024 Collate.
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
import type { DateTimeWidgetProps } from '@react-awesome-query-builder/ui';
import moment from 'moment';
import type { FC } from 'react';

// DateInput from @openmetadata/ui-core-components is not publicly exported and requires
// @internationalized/date CalendarDate objects, which are incompatible with the query
// builder's string-based date values. Native <input> is used instead.
const classNameValue =
  'tw:rounded-lg tw:bg-primary tw:px-3 tw:py-2 tw:text-sm tw:text-primary ' +
  'tw:shadow-xs tw:ring-1 tw:ring-primary tw:ring-inset tw:outline-hidden ' +
  'tw:transition tw:duration-100 focus:tw:ring-2 focus:tw:ring-brand ' +
  'disabled:tw:cursor-not-allowed disabled:tw:bg-disabled-subtle disabled:tw:text-disabled';

const NATIVE_FORMATS = {
  time: 'HH:mm:ss',
  datetime: 'YYYY-MM-DDTHH:mm:ss',
  date: 'YYYY-MM-DD',
} as const;

const RAQB_DEFAULT_FORMATS = {
  time: 'HH:mm:ss',
  datetime: 'YYYY-MM-DD HH:mm:ss',
  date: 'YYYY-MM-DD',
} as const;

const getInputKind = (
  fieldType: string | undefined,
  storedFormat: string | undefined
): keyof typeof NATIVE_FORMATS => {
  const hasDatePart = !storedFormat || /[DMY]/.test(storedFormat);
  const hasTimePart = storedFormat ? /[Hhms]/.test(storedFormat) : false;

  let result: keyof typeof NATIVE_FORMATS = 'date';
  if (fieldType === 'time' || (!hasDatePart && hasTimePart)) {
    result = 'time';
  } else if (fieldType === 'datetime' || hasTimePart) {
    result = 'datetime';
  }

  return result;
};

// The query builder stores values in the field's `valueFormat` (a moment
// format, e.g. "DD-MM-YYYY HH:mm:ss" for custom properties), while native
// date/time inputs only speak fixed ISO-like formats — convert both ways.
const OMDateWidget: FC<DateTimeWidgetProps> = ({
  value,
  setValue,
  placeholder,
  readonly,
  fieldType,
  valueFormat,
  dateFormat,
}) => {
  const kind = getInputKind(fieldType, valueFormat ?? dateFormat);
  const storedFormat = valueFormat ?? dateFormat ?? RAQB_DEFAULT_FORMATS[kind];
  const nativeFormat = NATIVE_FORMATS[kind];

  const parsed = value ? moment(String(value), storedFormat, true) : null;
  const displayValue = parsed?.isValid()
    ? parsed.format(nativeFormat)
    : String(value ?? '');

  const handleChange = (nativeValue: string) => {
    if (!nativeValue) {
      setValue(null as unknown as string);
    } else {
      setValue(moment(nativeValue, nativeFormat).format(storedFormat));
    }
  };

  return (
    <input
      className={classNameValue}
      disabled={readonly}
      placeholder={placeholder}
      // Native time inputs default to step=60, which rejects values with a
      // seconds component — the stored formats include seconds.
      step={kind === 'date' ? undefined : 1}
      type={kind === 'datetime' ? 'datetime-local' : kind}
      value={displayValue}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
};

export default OMDateWidget;
