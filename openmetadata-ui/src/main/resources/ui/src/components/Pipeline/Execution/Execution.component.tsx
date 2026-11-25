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

import {
  Box,
  Button,
  ButtonGroup,
  ButtonGroupItem,
  Dropdown,
  Grid,
  selectedTriggerClassName,
} from '@openmetadata/ui-core-components';
import { WeeklyEmailPreferences } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { findKey, map } from 'lodash';
import { Key, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EXECUTION_FILTER_RANGE,
  MenuOptions,
} from '../../../constants/execution.constants';
import { PIPELINE_EXECUTION_TABS } from '../../../constants/pipeline.constants';
import {
  SEGMENT_TOGGLE_GROUP_CLASS,
  SEGMENT_TOGGLE_ITEM_CLASS,
} from '../../../constants/SegmentToggle.constants';
import { PipelineStatus, Task } from '../../../generated/entity/data/pipeline';
import { getAllPipelineStatuses } from '../../../rest/pipelineAPI';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DateRangeFilter from '../../common/DateRangeFilter/DateRangeFilter';
import ListView from './ListView/ListViewTab.component';
import TreeViewTab from './TreeView/TreeViewTab.component';

interface ExecutionProps {
  pipelineFQN: string;
  tasks: Task[];
}

const ExecutionsTab = ({ pipelineFQN, tasks }: ExecutionProps) => {
  const { t } = useTranslation();
  const [view, setView] = useState(PIPELINE_EXECUTION_TABS.LIST_VIEW);
  const [searchValue, setSearchValue] = useState<string>('');
  const [executions, setExecutions] = useState<Array<PipelineStatus>>();
  const [datesSelected, setDatesSelected] = useState<boolean>(false);
  const [startTime, setStartTime] = useState(() =>
    getEpochMillisForPastDays(EXECUTION_FILTER_RANGE.last365days.days)
  );
  const [endTime, setEndTime] = useState(() => getCurrentMillis());
  const [status, setStatus] = useState(MenuOptions.all);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPipelineStatus = async (
    startRange: number,
    endRange: number,
    signal: AbortSignal
  ) => {
    try {
      setIsLoading(true);

      const statuses = await getAllPipelineStatuses(
        pipelineFQN,
        { startTs: startRange, endTs: endRange },
        signal
      );
      if (!signal.aborted) {
        setExecutions(statuses);
      }
    } catch (error) {
      if (!signal.aborted) {
        showErrorToast(
          error as AxiosError,
          t('message.fetch-pipeline-status-error')
        );
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const isStatusFiltered = status !== MenuOptions.all;

  const handleMenuClick = useCallback(
    (key: Key) => setStatus(MenuOptions[key as keyof typeof MenuOptions]),
    []
  );

  const onDateChange = (range?: { startTs: number; endTs: number }) => {
    setDatesSelected(Boolean(range));
    setStartTime(
      range?.startTs ??
        getEpochMillisForPastDays(EXECUTION_FILTER_RANGE.last365days.days)
    );
    setEndTime(range?.endTs ?? getCurrentMillis());
  };

  useEffect(() => {
    // Reading a range can take several requests, so a superseded read must not land last.
    const controller = new AbortController();
    fetchPipelineStatus(startTime, endTime, controller.signal);

    return () => controller.abort();
  }, [pipelineFQN, datesSelected, startTime, endTime]);

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  return (
    <div
      className="h-full p-md border-default border-radius-sm"
      data-testid="execution-tab">
      <Grid
        className="layout-row layout-grid"
        style={{ ...getLayoutGutter(16, 16) }}>
        <Grid.Item className="layout-column" span={24}>
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal justify-between w-full"
            gap={2}
            itemClassName="layout-space-item">
            <ButtonGroup
              disallowEmptySelection
              className={SEGMENT_TOGGLE_GROUP_CLASS}
              data-testid="radio-switch"
              selectedKeys={[view]}
              size="sm"
              onSelectionChange={(keys) => {
                const selected = [...keys][0];
                if (selected) {
                  setView(selected as PIPELINE_EXECUTION_TABS);
                }
              }}>
              {Object.values(PIPELINE_EXECUTION_TABS).map((tab) => (
                <ButtonGroupItem
                  className={SEGMENT_TOGGLE_ITEM_CLASS}
                  id={tab}
                  key={tab}>
                  {tab}
                </ButtonGroupItem>
              ))}
            </ButtonGroup>

            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal"
              gap={2}
              itemClassName="layout-space-item">
              <Dropdown.Root>
                <Button
                  className={
                    isStatusFiltered ? selectedTriggerClassName(true) : undefined
                  }
                  color="secondary"
                  data-testid="status-button"
                  iconLeading={WeeklyEmailPreferences}
                  size="sm">
                  {isStatusFiltered ? status : t('label.status')}
                </Button>
                <Dropdown.Popover className="tw:w-auto" placement="bottom">
                  <Dropdown.Menu
                    disallowEmptySelection
                    aria-label={t('label.status')}
                    selectedKeys={[
                      findKey(MenuOptions, (v) => v === status) ?? 'all',
                    ]}
                    selectionMode="single"
                    onAction={handleMenuClick}>
                    {map(MenuOptions, (value, key) => (
                      <Dropdown.Item id={key} key={key}>
                        {value}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
              {view === PIPELINE_EXECUTION_TABS.LIST_VIEW ? (
                <div data-testid="data-range-picker">
                  <DateRangeFilter
                    endTs={datesSelected ? endTime : undefined}
                    size="sm"
                    startTs={datesSelected ? startTime : undefined}
                    onApply={onDateChange}
                    onClear={() => onDateChange()}
                  />
                </div>
              ) : null}
            </Box>
          </Box>
        </Grid.Item>
        <Grid.Item className="layout-column" span={24}>
          {view === PIPELINE_EXECUTION_TABS.LIST_VIEW ? (
            <ListView
              executions={executions}
              handleSearch={handleSearch}
              loading={isLoading}
              searchString={searchValue}
              status={status}
            />
          ) : (
            <TreeViewTab
              endTime={endTime}
              executions={executions}
              startTime={startTime}
              status={status}
              tasks={tasks}
            />
          )}
        </Grid.Item>
      </Grid>
    </div>
  );
};

export default ExecutionsTab;
