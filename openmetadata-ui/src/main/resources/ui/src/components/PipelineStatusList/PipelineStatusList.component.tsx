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

import { Space } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isNil } from 'lodash';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Select, { SingleValue } from 'react-select';
import { getPipelineStatus } from '../../axiosAPIs/pipelineAPI';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
import { Pipeline, PipelineStatus } from '../../generated/entity/data/pipeline';
import jsonData from '../../jsons/en';
import { STATUS_OPTIONS } from '../../utils/PipelineDetailsUtils';
import {
  getCurrentDateTimeStamp,
  getPastDatesTimeStampFromCurrentDate,
} from '../../utils/TimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { reactSingleSelectCustomStyle } from '../common/react-select-component/reactSelectCustomStyle';
import ExecutionStrip from '../ExecutionStrip/ExecutionStrip';
import CustomOption from './CustomOption';

interface Prop extends HTMLAttributes<HTMLDivElement> {
  pipelineFQN: string;
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
  pipelineFQN,
  pipelineStatus,
  selectedExec,
  onSelectExecution,
}: Prop) => {
  const [selectedFilter, setSelectedFilter] = useState<string>();
  const [executions, setExecutions] = useState<Array<PipelineStatus>>([]);

  const filteredExecutions = useMemo(() => {
    return executions.filter((execution) =>
      selectedFilter ? execution.executionStatus === selectedFilter : true
    );
  }, [selectedFilter, executions]);

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

  const fetchPipelineStatus = async () => {
    try {
      const startTs = getPastDatesTimeStampFromCurrentDate(
        PROFILER_FILTER_RANGE.last60days.days
      );

      const endTs = getCurrentDateTimeStamp();

      const response = await getPipelineStatus(pipelineFQN, {
        startTs,
        endTs,
      });
      setExecutions(response.data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        jsonData['api-error-messages']['fetch-pipeline-status-error']
      );
    }
  };

  useEffect(() => {
    fetchPipelineStatus();
  }, []);

  if (isEmpty(pipelineStatus)) {
    return (
      <div
        className="tw-mt-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8"
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
          {!isEmpty(executions) ? (
            <Space size={2}>
              {filteredExecutions.map((execution) => (
                <ExecutionStrip
                  executions={execution as PipelineStatus}
                  key={`${execution.timestamp}${execution.executionStatus}`}
                  selectedExecution={selectedExec}
                  onSelectExecution={onSelectExecution}
                />
              ))}
            </Space>
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
