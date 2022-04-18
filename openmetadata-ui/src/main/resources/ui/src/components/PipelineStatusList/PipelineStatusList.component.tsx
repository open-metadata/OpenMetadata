/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { isNil, uniqueId } from 'lodash';
import moment from 'moment';
import React, { FC, Fragment, HTMLAttributes, useState } from 'react';
import Select, { SingleValue } from 'react-select';
import { Pipeline, StatusType } from '../../generated/entity/data/pipeline';
import { withLoader } from '../../hoc/withLoader';
import {
  getModifiedPipelineStatus,
  getStatusBadgeIcon,
  STATUS_OPTIONS,
} from '../../utils/PipelineDetailsUtils';
import SVGIcons from '../../utils/SvgUtils';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';
import CustomOption from './CustomOption';

interface Prop extends HTMLAttributes<HTMLDivElement> {
  pipelineStatus: Pipeline['pipelineStatus'];
}
interface Option {
  value: string;
  label: string;
}

const PipelineStatusList: FC<Prop> = ({ className, pipelineStatus }: Prop) => {
  const [selectedFilter, setSelectedFilter] = useState('');

  const handleOnChange = (
    value: SingleValue<unknown>,
    { action }: { action: string }
  ) => {
    if (isNil(value) || action === 'clear') {
      setSelectedFilter('');
    } else {
      const selectedValue = value as Option;
      setSelectedFilter(selectedValue.value);
    }
  };

  if (isNil(pipelineStatus) || pipelineStatus.length === 0) {
    return (
      <div
        className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8"
        data-testid="no-data">
        <span>No Execution data available.</span>
      </div>
    );
  } else {
    return (
      <Fragment>
        <div className={className} data-testid="pipeline-status-list">
          <div className="tw-flex tw-justify-between tw-mt-2 tw-mb-4">
            <div />
            <div data-testid="filter-dropdown">
              <Select
                isClearable
                aria-label="Filter by Status"
                components={{ Option: CustomOption }}
                isSearchable={false}
                options={STATUS_OPTIONS}
                placeholder="Status..."
                styles={reactSingleSelectCustomStyle}
                onChange={handleOnChange}
              />
            </div>
          </div>
          <table
            className="tw-w-full"
            data-testid="pipeline-status-table"
            id="pipeline-status-table">
            <thead>
              <tr className="tableHead-row">
                <th className="tableHead-cell">Task Name</th>
                <th className="tableHead-cell">Status</th>
                <th className="tableHead-cell">Date &amp; Time</th>
              </tr>
            </thead>
            <tbody className="tableBody">
              {getModifiedPipelineStatus(
                selectedFilter as StatusType,
                pipelineStatus
              ).map((status) => (
                <tr
                  className={classNames('tableBody-row')}
                  data-testid="tableBody-row"
                  key={uniqueId()}>
                  <td className="tableBody-cell" data-testid="tableBody-cell">
                    {status?.name}
                  </td>
                  <td className="tableBody-cell" data-testid="tableBody-cell">
                    <div className="tw-flex tw-items-center">
                      <SVGIcons
                        alt={status?.executionStatus ?? ''}
                        icon={getStatusBadgeIcon(
                          status?.executionStatus as StatusType
                        )}
                        width="16px"
                      />
                      <span className="tw-ml-2">{status?.executionStatus}</span>
                    </div>
                  </td>
                  <td className="tableBody-cell" data-testid="tableBody-cell">
                    {status?.executionDate
                      ? moment(status?.executionDate).format(
                          'DD-MM-YYYY hh:mm A'
                        )
                      : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Fragment>
    );
  }
};

export default withLoader<Prop>(PipelineStatusList);
