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
import { Button, Col, InputNumber, Row, Slider } from 'antd';
import { Tooltip } from '../AntdCompat';;
import { useTranslation } from 'react-i18next';
import { percentageFormatter } from '../../../utils/ChartUtils';
import { SliderWithInputProps } from './SliderWithInput.interface';
const SliderWithInput = ({
  value,
  onChange,
  className,
}: SliderWithInputProps) => {
  const { t } = useTranslation();

  return (
    <Row className={className} data-testid="percentage-input" gutter={20}>
      <Col flex="auto">
        <Slider
          marks={{
            0: '0%',
            100: '100%',
          }}
          max={100}
          min={0}
          tooltip={{ open: false }}
          value={value}
          onChange={onChange}
        />
      </Col>
      <Col className="w-32">
        <div className="flex items-center gap-2">
          <InputNumber
            data-testid="slider-input"
            formatter={percentageFormatter}
            max={100}
            min={0}
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
      </Col>
    </Row>
  );
};

export default SliderWithInput;
