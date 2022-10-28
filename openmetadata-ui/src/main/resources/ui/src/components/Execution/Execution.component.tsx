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

import { CloseCircleOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  DatePicker,
  Dropdown,
  Menu,
  MenuProps,
  Radio,
  RadioChangeEvent,
  Row,
  Space,
  Typography,
} from 'antd';
import { RangePickerProps } from 'antd/lib/date-picker';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isNaN, toNumber } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Calendar } from '../../assets/svg/calendar.svg';
import { ReactComponent as FilterIcon } from '../../assets/svg/filter.svg';
import { getPipelineStatus } from '../../axiosAPIs/pipelineAPI';
import { MenuOptions } from '../../constants/execution.constants';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
import {
  PipelineStatus,
  StatusType,
} from '../../generated/entity/data/pipeline';
import { getStatusLabel } from '../../utils/executionUtils';
import {
  getCurrentDateTimeStamp,
  getPastDatesTimeStampFromCurrentDate,
  getTimeStampByDate,
} from '../../utils/TimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './Execution.style.less';
import ListView from './ListView/ListViewTab.component';
import TreeViewTab from './TreeView/TreeViewTab.component';

interface ExecutionProps {
  pipelineFQN: string;
}

interface SummaryCardContentProps {
  heading: string;
  name: string;
}

const ExecutionsTab = ({ pipelineFQN }: ExecutionProps) => {
  const { t } = useTranslation();

  const listViewLabel = t('label.list');
  const treeViewLabel = t('label.tree');

  const [view, setView] = useState(listViewLabel);
  const [executions, setExecutions] = useState<Array<PipelineStatus>>();
  const [datesSelected, setDatesSelected] = useState<boolean>(false);
  const [startTime, setStartTime] = useState(
    getPastDatesTimeStampFromCurrentDate(PROFILER_FILTER_RANGE.last365days.days)
  );
  const [endTime, setEndTime] = useState(getCurrentDateTimeStamp());
  const [isClickedCalendar, setIsClickedCalendar] = useState(false);
  const [status, setStatus] = useState(MenuOptions.all);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPipelineStatus = async (
    startRange?: number,
    endRange?: number
  ) => {
    try {
      setIsLoading(true);
      const startTs =
        startRange ||
        getPastDatesTimeStampFromCurrentDate(
          PROFILER_FILTER_RANGE.last365days.days
        );

      const endTs = endRange || getCurrentDateTimeStamp();

      const response = await getPipelineStatus(pipelineFQN, {
        startTs,
        endTs,
      });
      setExecutions(response.data);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.fetch-pipeline-status-error')
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = (e: RadioChangeEvent) => {
    setView(e.target.value);
  };

  const handleMenuClick: MenuProps['onClick'] = (event) => {
    if (event?.key) {
      const key = toNumber(event.key);
      if (key === 1) {
        return setStatus(StatusType.Successful);
      }
      if (key === 2) {
        return setStatus(StatusType.Failed);
      }
      if (key === 3) {
        return setStatus(StatusType.Pending);
      }
    }

    return setStatus(MenuOptions.all);
  };

  const menu = (
    <Menu
      items={[
        {
          key: 0,
          label: MenuOptions.all,
        },
        {
          key: 1,
          label: MenuOptions[StatusType.Successful],
        },
        {
          key: 2,
          label: MenuOptions[StatusType.Failed],
        },
        {
          key: 3,
          label: MenuOptions[StatusType.Pending],
        },
      ]}
      onClick={handleMenuClick}
    />
  );

  const SummaryCardContent = ({
    heading,
    name,
    ...otherProps
  }: SummaryCardContentProps) => (
    <Space direction="vertical" {...otherProps}>
      <p className="sub-heading">{heading}</p>
      <Row gutter={16}>
        <Col>
          <p className="content-text">{name}</p>
        </Col>
        <Col>
          {' '}
          <Typography.Text>{name}</Typography.Text>
        </Col>
      </Row>
    </Space>
  );

  const onDateChange: RangePickerProps['onChange'] = (_, dateStrings) => {
    if (dateStrings) {
      const startTime = getTimeStampByDate(dateStrings[0]);

      const endTime = getTimeStampByDate(dateStrings[1]);

      if (!isNaN(startTime) && !isNaN(endTime)) {
        setStartTime(startTime);
        setEndTime(endTime);
      }
      if (isNaN(startTime)) {
        setIsClickedCalendar(false);
        setStartTime(
          getPastDatesTimeStampFromCurrentDate(
            PROFILER_FILTER_RANGE.last365days.days
          )
        );
        setEndTime(getCurrentDateTimeStamp());

        return setDatesSelected(false);
      }

      return setDatesSelected(true);
    }
  };

  useEffect(() => {
    fetchPipelineStatus(startTime, endTime);
  }, [pipelineFQN, datesSelected, startTime, endTime]);

  return (
    <Row className="h-full p-md" gutter={16}>
      <Col flex="auto">
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Space className="justify-between w-full">
              <Radio.Group
                // buttonStyle="outline"
                // style={{ marginBottom: 8 }}
                value={view}
                onChange={handleModeChange}>
                <Radio.Button value={listViewLabel}>
                  {listViewLabel}
                </Radio.Button>
                <Radio.Button value={treeViewLabel}>
                  {treeViewLabel}
                </Radio.Button>
              </Radio.Group>
              <Space>
                <Dropdown overlay={menu} placement="bottom">
                  <Button ghost type="primary">
                    <Space>
                      <FilterIcon />
                      <p>
                        {status === MenuOptions.all
                          ? t('label.status')
                          : getStatusLabel(status)}
                      </p>
                    </Space>
                  </Button>
                </Dropdown>
                {view === listViewLabel ? (
                  <>
                    <Button
                      ghost
                      className={classNames(
                        'range-picker-button delay-100',
                        !datesSelected && !isClickedCalendar
                          ? 'range-picker-button-width delay-100'
                          : ''
                      )}
                      type="primary"
                      onClick={() => {
                        setIsClickedCalendar(true);
                      }}>
                      <Space>
                        <Calendar />
                        <label>
                          {!datesSelected ? t('label.date-filter') : ''}
                        </label>
                        <DatePicker.RangePicker
                          allowClear
                          showNow
                          bordered={false}
                          className={classNames('range-picker')}
                          clearIcon={<CloseCircleOutlined />}
                          open={isClickedCalendar}
                          placeholder={['', '']}
                          suffixIcon={null}
                          onChange={onDateChange}
                          onOpenChange={(isOpen) => {
                            setIsClickedCalendar(isOpen);
                          }}
                        />
                      </Space>
                    </Button>
                  </>
                ) : null}
              </Space>
            </Space>
          </Col>
          <Col span={24}>
            {view === listViewLabel ? (
              <ListView
                executions={executions}
                loading={isLoading}
                status={status}
              />
            ) : (
              <TreeViewTab
                endTime={endTime}
                executions={executions}
                startTime={startTime}
                status={status}
              />
            )}
          </Col>
        </Row>
      </Col>
      {/* <Col flex="0 1 400px">
        <Card className="h-full">
          <Space direction="vertical">
            <Typography.Title level={5}>{t('label.summary')}</Typography.Title>
            <Row gutter={[2, 16]}>
              <SummaryCardContent
                heading="Basic Configuration"
                name="Workflow Name"
              />
              <SummaryCardContent heading="Run Schedule" name="Workflow Name" />
            </Row>
          </Space>
        </Card>
      </Col> */}
    </Row>
  );
};

export default ExecutionsTab;
