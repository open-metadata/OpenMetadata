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
import { CalendarDate } from '@internationalized/date';
import { Box, DatePicker, TimePicker } from '@openmetadata/ui-core-components';
import { DateTime } from 'luxon';
import { ComponentProps, FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCustomPropertyDateTime } from '../../../../../utils/CustomProperty.utils';
import {
  CustomPropertyRenderer,
  PropertyEditProps,
  PropertyViewProps,
} from '../CustomPropertyCard.types';
import { getPropertyTypeMeta } from '../CustomPropertyCard.utils';
import { PropertyValueChip } from '../PropertyValueChip';
import {
  DateParts,
  fromDateTimeEditState,
  toDateTimeEditState,
} from './DatePropertyValue.utils';

const DATE_CP = 'date-cp';
const TIME_CP = 'time-cp';

// @internationalized/date resolves to different patch versions in the app and
// in ui-core-components, so TypeScript sees two nominal DateValue types.
type PickerDate = NonNullable<ComponentProps<typeof DatePicker>['value']>;

const toPickerDate = ({ year, month, day }: DateParts) =>
  new CalendarDate(year, month, day) as unknown as PickerDate;

const DatePropertyView = ({ property, value }: PropertyViewProps) => (
  <PropertyValueChip
    icon={getPropertyTypeMeta(property.propertyType.name).icon}>
    {String(value)}
  </PropertyValueChip>
);

const DatePropertyEdit = ({
  property,
  value,
  isSaving,
  onSave,
  formId,
}: PropertyEditProps) => {
  const { t } = useTranslation();
  const typeName = property.propertyType.name ?? DATE_CP;
  const config = property.customPropertyConfig?.config;
  const [state, setState] = useState(() =>
    toDateTimeEditState(value, typeName, config)
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(fromDateTimeEditState(state, typeName, config));
  };

  return (
    <form noValidate id={formId} onSubmit={handleSubmit}>
      <Box align="center" gap={3} wrap="wrap">
        {typeName !== TIME_CP && (
          <div data-testid="date-time-picker">
            <DatePicker
              aria-label={t('label.date')}
              isDisabled={isSaving}
              value={state.date ? toPickerDate(state.date) : null}
              onChange={(date) =>
                setState((prev) => ({
                  ...prev,
                  date: date
                    ? { year: date.year, month: date.month, day: date.day }
                    : null,
                }))
              }
            />
          </div>
        )}
        {typeName !== DATE_CP && (
          <div className="tw:w-40" data-testid="time-picker">
            {/* Every supported time format stores seconds. */}
            <TimePicker
              aria-label={t('label.time')}
              granularity="second"
              hourCycle={24}
              isDisabled={isSaving}
              value={state.time}
              onChange={(time) => setState((prev) => ({ ...prev, time }))}
            />
          </div>
        )}
      </Box>
    </form>
  );
};

export const datePropertyRenderer: CustomPropertyRenderer = {
  View: DatePropertyView,
  Edit: DatePropertyEdit,
  getEmptyHint: (property, t) =>
    t('message.example-value', {
      value: formatCustomPropertyDateTime(
        DateTime.now(),
        property.propertyType.name ?? DATE_CP,
        property.customPropertyConfig?.config
      ),
    }),
};
