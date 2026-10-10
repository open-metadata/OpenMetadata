/*
 *  Copyright 2022 Collate.
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
  Button,
  NumberInput,
  Slider,
  Tooltip,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { SliderWithInputProps } from './SliderWithInput.interface';
const SliderWithInput = ({
  value,
  onChange,
  className,
  min = 0,
}: SliderWithInputProps) => {
  const { t } = useTranslation();

  return (
    <Box
      className={`layout-row ${className}`}
      data-testid="percentage-input"
      style={getLayoutGutter(20)}
      wrap="wrap">
      <Box className="layout-column tw:block" style={{ flex: 'auto' }}>
        <Slider
          showRange
          aria-label={t('label.profile-sample')}
          labelFormatter={(value) => `${value}%`}
          maxValue={100}
          minValue={min}
          step={1}
          value={value ?? min}
          onChange={(next) =>
            onChange(typeof next === 'number' ? next : next[0])
          }
        />
      </Box>
      <Box className="layout-column tw:block tw:w-44">
        <Box align="center" gap={2}>
          <NumberInput
            aria-label={t('label.profile-sample')}
            formatOptions={{ style: 'unit', unit: 'percent' }}
            inputDataTestId="slider-input"
            maxValue={100}
            minValue={min}
            step={1}
            value={value ?? NaN}
            onChange={(next) => onChange(Number.isNaN(next) ? null : next)}
          />
          <Tooltip title={t('label.clear')}>
            <Button
              aria-label={t('label.clear')}
              color="tertiary"
              data-testid="clear-slider-input"
              iconLeading={XClose}
              size="xxs"
              onPress={() => onChange(null)}
            />
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};

export default SliderWithInput;
