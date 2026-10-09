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

import { CloseOutlined } from '@ant-design/icons';
import { Box } from '@openmetadata/ui-core-components';
import { Button, InputNumber, Slider, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { percentageFormatter } from '../../../utils/ChartUtils';
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
          marks={{
            [min]: `${min}%`,
            100: '100%',
          }}
          max={100}
          min={min}
          tooltip={{ open: false }}
          value={value}
          onChange={onChange}
        />
      </Box>
      <Box className="layout-column tw:block w-32">
        <div className="flex items-center gap-2">
          <InputNumber
            data-testid="slider-input"
            formatter={percentageFormatter}
            max={100}
            min={min}
            step={1}
            value={value}
            onChange={onChange}
          />
          <Tooltip title={t('label.clear')}>
            <Button
              className="p-0"
              data-testid="clear-slider-input"
              type="text"
              onClick={() => onChange(null)}>
              <CloseOutlined />
            </Button>
          </Tooltip>
        </div>
      </Box>
    </Box>
  );
};

export default SliderWithInput;
