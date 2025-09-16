/*
 *  Copyright 2025 Collate.
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
import { AxiosError } from 'axios';
import { isEqual, pick, sortBy } from 'lodash';
import { DateRangeObject } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  XAxis,
} from 'recharts';
import {
  GREEN_4,
  GREY_100,
  RED_3,
  YELLOW_2,
} from '../../../constants/Color.constants';
import { DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS } from '../../../constants/DataContract.constants';
import { PROFILER_FILTER_RANGE } from '../../../constants/profiler.constant';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import { getAllContractResults } from '../../../rest/contractAPI';
import { getContractExecutionMonthTicks } from '../../../utils/DataContract/DataContractUtils';
import {
  formatMonth,
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import Loader from '../../common/Loader/Loader';
import './contract-execution-chart.less';

const ContractExecutionChart = ({ contract }: { contract: DataContract }) => {
  const { t } = useTranslation();
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

  const [contractExecutionResultList, setContractExecutionResultList] =
    useState<DataContractResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [dateRangeObject, setDateRangeObject] = useState<DateRangeObject>(
    defaultRange.initialRange
  );

  const fetchAllContractResults = async (dateRangeObj: DateRangeObject) => {
    try {
      setIsLoading(true);
      const results = await getAllContractResults(contract.id, {
        ...pick(dateRangeObj, ['startTs', 'endTs']),
      });
      setContractExecutionResultList(sortBy(results.data, 'timestamp'));
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const { processedChartData, executionMonthThicks } = useMemo(() => {
    const processed = contractExecutionResultList.map((item) => {
      return {
        name: item.timestamp,
        failed:
          item.contractExecutionStatus === ContractExecutionStatus.Failed
            ? 1
            : 0,
        success:
          item.contractExecutionStatus === ContractExecutionStatus.Success
            ? 1
            : 0,
        aborted:
          item.contractExecutionStatus === ContractExecutionStatus.Aborted
            ? 1
            : 0,
      };
    });

    return {
      processedChartData: processed,
      executionMonthThicks: getContractExecutionMonthTicks(processed),
    };
  }, [contractExecutionResultList]);

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
    }
  };

  useEffect(() => {
    fetchAllContractResults(dateRangeObject);
  }, [dateRangeObject]);

  return (
    <div className="contract-execution-chart-container">
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <DatePickerMenu
            showSelectedCustomRange
            defaultDateRange={pick(defaultRange, ['key', 'title'])}
            handleDateRangeChange={handleDateRangeChange}
          />

          <ResponsiveContainer height="100%" width="100%">
            <BarChart
              data={processedChartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 5,
              }}
              width={500}>
              <CartesianGrid
                stroke={GREY_100}
                strokeDasharray="0"
                vertical={false}
              />
              <XAxis
                axisLine={false}
                dataKey="name"
                domain={['min', 'max']}
                tickFormatter={formatMonth}
                tickMargin={10}
                ticks={executionMonthThicks}
              />
              <Bar
                activeBar={<Rectangle fill={GREEN_4} stroke={GREEN_4} />}
                dataKey="success"
                fill={GREEN_4}
                name={t('label.success')}
                {...DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS}
              />
              <Bar
                activeBar={<Rectangle fill={RED_3} stroke={RED_3} />}
                dataKey="failed"
                fill={RED_3}
                name={t('label.failed')}
                {...DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS}
              />
              <Bar
                activeBar={<Rectangle fill={YELLOW_2} stroke={YELLOW_2} />}
                dataKey="aborted"
                fill={YELLOW_2}
                name={t('label.aborted')}
                {...DATA_CONTRACT_EXECUTION_CHART_COMMON_PROPS}
              />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
};

export default ContractExecutionChart;
