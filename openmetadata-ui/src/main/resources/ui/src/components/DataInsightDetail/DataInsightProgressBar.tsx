/*
 *  Copyright 2022 Collate
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

import { Progress, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

interface DataInsightProgressBarProps {
  width?: number;
  progress: number;
  className?: string;
  showLabel?: boolean;
  showSuccessInfo?: boolean;
  label?: string;
  target?: number;
  successValue?: number | string;
  startValue?: number | string;
  suffix?: string;
}

const DataInsightProgressBar = ({
  width,
  progress,
  className,
  target,
  startValue,
  label,
  suffix = '%',
  successValue = 100,
  showLabel = true,
  showSuccessInfo = false,
}: DataInsightProgressBarProps) => {
  const { t } = useTranslation();

  return (
    <div className={classNames(className)} style={{ width }}>
      {showLabel && (
        <Typography.Text className="data-insight-label-text">
          {label ?? t('label.latest')}
        </Typography.Text>
      )}
      <div className="flex">
        <Progress
          className="data-insight-progress-bar"
          format={(per) => (
            <>
              <span>
                {startValue ?? per}
                {suffix}
              </span>
              {target && (
                <span
                  className="data-insight-kpi-target"
                  style={{ width: `${target}%` }}
                />
              )}
              <span>
                {successValue}
                {suffix}
              </span>
            </>
          )}
          percent={progress}
          strokeColor="#B3D4F4"
        />
        {showSuccessInfo && progress >= 100 && (
          <SVGIcons className="m-l-xs" icon={Icons.SUCCESS_BADGE} />
        )}
      </div>
    </div>
  );
};

export default DataInsightProgressBar;
