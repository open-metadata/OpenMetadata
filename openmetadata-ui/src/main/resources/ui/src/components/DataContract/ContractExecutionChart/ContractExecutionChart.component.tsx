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
import { Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEqual, pick, sortBy } from 'lodash';
import { DateRangeObject } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Rectangle,
    ResponsiveContainer,
    XAxis
} from 'recharts';
import { GREEN_3, RED_3, YELLOW_2 } from '../../../constants/Color.constants';
import { PROFILER_FILTER_RANGE } from '../../../constants/profiler.constant';
import { DataContract } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { ContractExecutionStatus } from '../../../generated/type/contractExecutionStatus';
import { getAllContractResults } from '../../../rest/contractAPI';
import {
    formatDateTime,
    getCurrentMillis,
    getEpochMillisForPastDays
} from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { Tooltip } from '../../common/AntdCompat';
import DatePickerMenu from '../../common/DatePickerMenu/DatePickerMenu.component';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import Loader from '../../common/Loader/Loader';
import './contract-execution-chart.less';
;

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

  const processedChartData = useMemo(() => {
    return contractExecutionResultList.map((item) => {
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
    <ExpandableCard
      cardProps={{
        className: 'expandable-card-contract',
        title: (
          <div className="contract-card-title-container">
            <Typography.Text className="contract-card-title">
              {t('label.contract-execution-history')}
            </Typography.Text>
            <Typography.Text className="contract-card-description">
              {t('message.contract-execution-history-description')}
            </Typography.Text>
          </div>
        ),
      }}>
      <div className="expandable-card-contract-body contract-execution-chart-container">
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
                height={200}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
                width={500}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  domain={['min', 'max']}
                  tickFormatter={formatDateTime}
                />
                <Tooltip />
                <Legend />
                <Bar
                  activeBar={<Rectangle fill={GREEN_3} stroke={GREEN_3} />}
                  dataKey="success"
                  fill={GREEN_3}
                  name={t('label.success')}
                />
                <Bar
                  activeBar={<Rectangle fill={RED_3} stroke={RED_3} />}
                  dataKey="failed"
                  fill={RED_3}
                  name={t('label.failed')}
                />
                <Bar
                  activeBar={<Rectangle fill={YELLOW_2} stroke={YELLOW_2} />}
                  dataKey="aborted"
                  fill={YELLOW_2}
                  name={t('label.aborted')}
                />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </ExpandableCard>
  );
};

export default ContractExecutionChart;
