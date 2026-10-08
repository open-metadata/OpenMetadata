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

import { Box } from '@openmetadata/ui-core-components';
import { Progress } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { getLayoutGutter } from '../../../../../utils/common/layout.utils';
import { calculatePercentage } from '../../../../../utils/NumberUtils';
import { ProfilerProgressWidgetProps } from '../TableProfiler.interface';

const ProfilerProgressWidget: React.FC<ProfilerProgressWidgetProps> = ({
  value,
  strokeColor,
  direction = 'left',
}) => {
  const modifiedValue = Math.round(value * 100);

  return (
    <Box
      className={`layout-row ${classNames('flex-row', {
        'flex-row-reverse': direction === 'right',
      })}`}
      data-testid="profiler-progress-bar-container"
      style={{ ...getLayoutGutter(16) }}
      wrap="wrap">
      <Box
        className="layout-column tw:block"
        style={{ maxWidth: '25%', flex: `0 0 ${'25%'}` }}>
        <p className="percent-info" data-testid="percent-info">
          {calculatePercentage(value, 1, 2, true)}
        </p>
      </Box>
      <Box
        className="layout-column tw:block"
        style={{ maxWidth: '75%', flex: `0 0 ${'75%'}` }}>
        <Progress
          data-testid="progress-bar"
          percent={modifiedValue}
          showInfo={false}
          size="small"
          strokeColor={strokeColor}
        />
      </Box>
    </Box>
  );
};

export default ProfilerProgressWidget;
