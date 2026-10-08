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

import { Box, ProgressBarBase } from '@openmetadata/ui-core-components';
import { CSSProperties, FC } from 'react';
import { calculatePercentage } from '../../../../../utils/NumberUtils';
import { ProfilerProgressWidgetProps } from '../TableProfiler.interface';

const ProfilerProgressWidget: FC<ProfilerProgressWidgetProps> = ({
  value,
  strokeColor,
  direction = 'left',
}) => (
  <Box
    align="center"
    data-testid="profiler-progress-bar-container"
    direction={direction === 'right' ? 'row-reverse' : 'row'}
    gap={4}
    // strokeColor is any CSS color, so it reaches the bar through a custom property.
    style={
      strokeColor
        ? ({ '--progress-stroke': strokeColor } as CSSProperties)
        : undefined
    }>
    <p
      className="percent-info tw:m-0 tw:w-1/4 tw:shrink-0 tw:text-sm tw:text-primary"
      data-testid="percent-info">
      {calculatePercentage(value, 1, 2, true)}
    </p>
    <div className="tw:flex-1" data-testid="progress-bar">
      <ProgressBarBase
        className="tw:h-1.5"
        progressClassName={
          strokeColor ? 'tw:bg-(--progress-stroke)' : undefined
        }
        value={Math.min(Math.max(Math.round(value * 100), 0), 100)}
      />
    </div>
  </Box>
);

export default ProfilerProgressWidget;
