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

import { isNil } from 'lodash';
import React, { FC, Fragment, HTMLAttributes, useMemo, useState } from 'react';
import Select, { SingleValue } from 'react-select';
import {
  Pipeline,
  PipelineStatus,
  StatusType,
} from '../../generated/entity/data/pipeline';
import {
  getFilteredPipelineStatus,
  STATUS_OPTIONS,
} from '../../utils/PipelineDetailsUtils';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';
import ExecutionStrip from '../ExecutionStrip/ExecutionStrip';
import CustomOption from './CustomOption';

interface Prop extends HTMLAttributes<HTMLDivElement> {
  pipelineStatus: Pipeline['pipelineStatus'];
  selectedExec: PipelineStatus;
  onSelectExecution: (e: PipelineStatus) => void;
}
interface Option {
  value: string;
  label: string;
}

const PipelineStatusList: FC<Prop> = ({
  className,
  pipelineStatus,
  selectedExec,
  onSelectExecution,
}: Prop) => {
  const [selectedFilter, setSelectedFilter] = useState('');

  const executions = useMemo(() => {
    return getFilteredPipelineStatus(
      selectedFilter as StatusType,
      pipelineStatus
    );
  }, [selectedFilter, pipelineStatus]);

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
            <div className="tw-text-base">Executions</div>
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
          {executions.length ? (
            <ExecutionStrip
              executions={executions}
              selectedExecution={selectedExec}
              onSelectExecution={onSelectExecution}
            />
          ) : (
            <div className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
              <span>No execution data is available</span>
            </div>
          )}
        </div>
      </Fragment>
    );
  }
};

export default PipelineStatusList;
