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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isEqual, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PROFILER_FILTER_RANGE } from '../../../../constants/profiler.constant';
import { TestCaseResult } from '../../../../generated/tests/testCase';
import { getListTestCaseResults } from '../../../../rest/testAPI';
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DatePickerMenu from '../../../common/DatePickerMenu/DatePickerMenu.component';
import Loader from '../../../common/Loader/Loader';
import { TestSummaryProps } from '../ProfilerDashboard/profilerDashboard.interface';
import './test-summary.less';
import TestSummaryGraph from './TestSummaryGraph';

const TestSummary: React.FC<TestSummaryProps> = ({ data }) => {
  const defaultRange = useMemo(
    () => ({
      initialRange: {
        startTs: getEpochMillisForPastDays(
          PROFILER_FILTER_RANGE.last30days.days
        ),
        endTs: getCurrentMillis(),
      },
      key: 'last30days',
      title: PROFILER_FILTER_RANGE.last30days.title,
    }),
    []
  );
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [dateRangeObject, setDateRangeObject] = useState<DateRangeObject>(
    defaultRange.initialRange
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isGraphLoading, setIsGraphLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>(
    defaultRange.title
  );

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  const fetchTestResults = async (dateRangeObj: DateRangeObject) => {
    if (isEmpty(data)) {
      return;
    }
    setIsGraphLoading(true);
    try {
      const { data: chartData } = await getListTestCaseResults(
        data.fullyQualifiedName ?? '',
        pick(dateRangeObj, ['startTs', 'endTs'])
      );

      setResults(chartData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setIsGraphLoading(false);
    }
  };

  const getGraph = useMemo(() => {
    if (isGraphLoading) {
      return <Loader />;
    }

    return (
      <TestSummaryGraph
        selectedTimeRange={selectedTimeRange}
        testCaseName={data.name}
        testCaseParameterValue={data.parameterValues}
        testCaseResults={results}
        testDefinitionName={data.testDefinition.name}
      />
    );
  }, [isGraphLoading, data, results, selectedTimeRange]);

  useEffect(() => {
    if (dateRangeObject) {
      fetchTestResults(dateRangeObject);
    }
  }, [dateRangeObject]);

  const handleSelectedTimeRange = useCallback((range: string) => {
    setSelectedTimeRange(range);
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Row data-testid="test-summary-container" gutter={[0, 16]}>
      <Col className="d-flex justify-end" span={24}>
        <DatePickerMenu
          showSelectedCustomRange
          defaultDateRange={pick(defaultRange, ['key', 'title'])}
          handleDateRangeChange={handleDateRangeChange}
          handleSelectedTimeRange={handleSelectedTimeRange}
        />
      </Col>
      <Col data-testid="graph-container" span={24}>
        {getGraph}
      </Col>
    </Row>
  );
};

export default TestSummary;
