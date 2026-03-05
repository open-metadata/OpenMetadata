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

import { isUndefined } from 'lodash';
import { getStatisticsDisplayValue } from '../../../../utils/CommonUtils';
import '../ProfilerDashboard/profiler-dashboard.less';
import { ProfilerLatestValueProps } from '../ProfilerDashboard/profilerDashboard.interface';

const ProfilerLatestValue = ({
  information,
  tickFormatter,
  stringValue = false,
  extra,
}: ProfilerLatestValueProps) => {
  const getLatestValue = (value?: number | string) => {
    if (isUndefined(value)) {
      return '--';
    }

    if (tickFormatter || stringValue) {
      return `${value}${tickFormatter ?? ''}`;
    } else {
      return getStatisticsDisplayValue(value);
    }
  };

  return (
    <div
      className="tw:flex tw:items-center tw:rounded-[10px] tw:bg-gray-50 tw:px-7.5 tw:py-4"
      data-testid="data-summary-container">
      <div className="tw:flex tw:grow tw:gap-20">
        {information.map((info) => (
          <div key={info.title}>
            <p
              className="tw:m-0 tw:mb-1 tw:break-all tw:pl-2 tw:text-[11px] tw:font-semibold tw:leading-3 tw:text-secondary"
              data-testid="title"
              style={{ borderLeft: `4px solid ${info.color}` }}>
              {info.title}
            </p>
            <p
              className="tw:m-0 tw:break-all tw:text-[17px] tw:font-bold tw:text-primary"
              data-testid="value">
              {getLatestValue(info.latestValue)}
            </p>
            {info.extra && (
              <>
                <hr className="tw:my-2 tw:h-px tw:border-0 tw:border-t tw:border-dashed tw:border-border-primary" />
                <p
                  className="tw:m-0 tw:break-all tw:text-[11px] tw:text-primary"
                  data-testid="extra">
                  {info.extra}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
      {extra && <div className="tw:flex tw:justify-end">{extra}</div>}
    </div>
  );
};

export default ProfilerLatestValue;
