/*
 *  Copyright 2023 Collate.
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
import { Box, NumberInput, Slider } from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { isNumber } from 'lodash';
import { useTranslation } from 'react-i18next';

export const CustomRangeWidget = (props: WidgetProps) => {
  const min = props.schema.minimum ?? 0;
  const { t } = useTranslation();
  const label = props.label || t('label.profile-sample');

  return (
    // Two items and one gap: a 24-column Grid with colGap puts the gap between every column,
    // which needs 460px before any content and pushes the number input out of narrow dialogs.
    <Box data-testid="percentage-input" gap={5}>
      <div className="tw:min-w-0 tw:flex-3">
        <Slider
          showRange
          aria-label={label}
          isDisabled={props.disabled || props.readonly}
          labelFormatter={(value) => `${value}%`}
          maxValue={100}
          minValue={min}
          step={1}
          value={isNumber(props.value) ? props.value : min}
          onChange={props.onChange}
        />
      </div>
      <div className="tw:min-w-0 tw:flex-1">
        <NumberInput
          aria-label={label}
          formatOptions={{ style: 'unit', unit: 'percent' }}
          id={props.id}
          inputDataTestId="slider-input"
          isDisabled={props.disabled || props.readonly}
          maxValue={100}
          minValue={min}
          name={props.name}
          step={1}
          value={isNumber(props.value) ? props.value : Number.NaN}
          onChange={(value) =>
            props.onChange(Number.isNaN(value) ? null : value)
          }
        />
      </div>
    </Box>
  );
};
