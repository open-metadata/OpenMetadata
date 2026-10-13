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
import { Grid } from '@openmetadata/ui-core-components';
import { WidgetProps } from '@rjsf/utils';
import { InputNumber, Slider } from 'antd';
import { getLayoutGutter } from '../../../../utils/common/layout.utils';

export const CustomRangeWidget = (props: WidgetProps) => {
  const min = props.schema.minimum ?? 0;

  return (
    <Grid
      className="layout-row layout-grid"
      data-testid="percentage-input"
      style={{ ...getLayoutGutter(20) }}>
      <Grid.Item className="layout-column" span={20}>
        <Slider
          marks={{
            [min]: `${min}%`,
            100: '100%',
          }}
          max={100}
          min={min}
          tooltip={{ open: false }}
          value={props.value}
          onChange={props.onChange}
        />
      </Grid.Item>
      <Grid.Item className="layout-column" span={4}>
        <InputNumber
          data-testid="slider-input"
          formatter={(value) => `${value}%`}
          id={props.id}
          max={100}
          min={min}
          name={props.name}
          step={1}
          value={props.value}
          onChange={props.onChange}
        />
      </Grid.Item>
    </Grid>
  );
};
