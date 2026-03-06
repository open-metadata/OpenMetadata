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
import { Select, Skeleton, Tooltip } from '@openmetadata/ui-core-components';
import { HelpCircle } from '@untitledui/icons';
import { ColumnsType } from 'antd/lib/table';
import { format } from 'date-fns';
import { isEmpty, split, toLower } from 'lodash';
import { DateRangeObject } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  DEFAULT_RANGE_DATA,
  DEFAULT_SELECTED_RANGE,
  TEST_CASE_STATUS_LABELS,
} from '../../../../constants/profiler.constant';
import { SIZE } from '../../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { getTestCaseDimensionResultsByFqn } from '../../../../rest/testAPI';
import {
  getEndOfDayInMillis,
  getStartOfDayInMillis,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityFQN } from '../../../../utils/FeedUtils';
import {
  getEntityDetailsPath,
  getTestCaseDimensionsDetailPagePath,
} from '../../../../utils/RouterUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import DateTimeDisplay from '../../../common/DateTimeDisplay/DateTimeDisplay';
import NoDataPlaceholderNew from '../../../common/ErrorWithPlaceholder/NoDataPlaceholderNew';
import MuiDatePickerMenu from '../../../common/MuiDatePickerMenu/MuiDatePickerMenu';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import Table from '../../../common/Table/Table';
import { ProfilerTabPath } from '../../../Database/Profiler/ProfilerDashboard/profilerDashboard.interface';
import DimensionalityHeatmap from './DimensionalityHeatmap/DimensionalityHeatmap.component';
import { DimensionResultWithTimestamp } from './DimensionalityHeatmap/DimensionalityHeatmap.interface';

const DimensionalityTab = () => {
  const { t } = useTranslation();
  const { dimensionKey } = useRequiredParams<{ dimensionKey?: string }>();
  const { testCase } = useTestCaseStore();
  const [dateRange, setDateRange] = useState(DEFAULT_RANGE_DATA);
  const [dimensionData, setDimensionData] = useState<
    DimensionResultWithTimestamp[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const { dimensionColumnsOptions, selectedColumn } = useMemo(() => {
    const column = split(dimensionKey || '', '=')[0];

    const options = testCase?.dimensionColumns?.map((column) => ({
      id: column,
      label: column,
    }));

    return {
      dimensionColumnsOptions: options ?? [],
      selectedColumn: column || testCase?.dimensionColumns?.[0],
    };
  }, [testCase, dimensionKey]);

  const pipelineLink = useMemo(() => {
    const tableFqn = getEntityFQN(testCase?.entityLink ?? '');

    return {
      pathname: getEntityDetailsPath(
        EntityType.TABLE,
        tableFqn,
        EntityTabs.PROFILER,
        ProfilerTabPath.DATA_QUALITY
      ),
      search: `?qualityTab=pipeline`,
    };
  }, [testCase]);

  const [selectedDimension, setSelectedDimension] = useState(selectedColumn);

  const handleDateRangeChange = (value: DateRangeObject) => {
    setDateRange({
      startTs: getStartOfDayInMillis(value.startTs),
      endTs: getEndOfDayInMillis(value.endTs),
    });
  };

  const handleDimensionChange = (value: string | number | null) => {
    if (!value) {
      return;
    }
    setSelectedDimension(String(value));
  };

  const fetchDimensionColumnData = async () => {
    setIsLoading(true);
    try {
      if (!testCase?.fullyQualifiedName || !selectedDimension) {
        return;
      }
      const response = await getTestCaseDimensionResultsByFqn(
        testCase.fullyQualifiedName,
        {
          dimensionName: selectedDimension,
          startTs: dateRange.startTs,
          endTs: dateRange.endTs,
        }
      );

      setDimensionData(response.data);
    } catch {
      setDimensionData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDimension) {
      fetchDimensionColumnData();
    }
  }, [selectedDimension, dateRange]);

  const getLatestResultPerDimension = useMemo(() => {
    const dimensionMap = new Map<string, DimensionResultWithTimestamp>();

    dimensionData.forEach((result) => {
      const dimensionValue = result.dimensionValues
        .map((dv) => dv.value)
        .join(', ');

      if (!result.timestamp) {
        return;
      }

      const resultDate = format(new Date(result.timestamp), 'yyyy-MM-dd');
      const existing = dimensionMap.get(dimensionValue);

      if (!existing || !existing.timestamp) {
        dimensionMap.set(dimensionValue, result);
      } else {
        const existingDate = format(new Date(existing.timestamp), 'yyyy-MM-dd');
        const existingTime = existing.timestamp;
        const currentTime = result.timestamp;

        if (
          resultDate > existingDate ||
          (resultDate === existingDate && currentTime > existingTime)
        ) {
          dimensionMap.set(dimensionValue, result);
        }
      }
    });

    return Array.from(dimensionMap.entries())
      .map(([dimensionValue, result]) => ({
        key: `${dimensionValue}-${result.timestamp}`,
        dimensionValue,
        result,
      }))
      .sort((a, b) => {
        const impactScoreA = a.result.impactScore ?? 0;
        const impactScoreB = b.result.impactScore ?? 0;

        return impactScoreB - impactScoreA;
      });
  }, [dimensionData]);

  const tableColumns: ColumnsType<{
    key: string;
    dimensionValue: string;
    result: DimensionResultWithTimestamp;
  }> = [
    {
      title: t('label.status'),
      dataIndex: 'result',
      key: 'status',
      width: 120,
      render: (result: DimensionResultWithTimestamp) => {
        return result?.testCaseStatus ? (
          <StatusBadge
            dataTestId="status-badge"
            label={TEST_CASE_STATUS_LABELS[result.testCaseStatus]}
            status={toLower(result.testCaseStatus) as StatusType}
          />
        ) : (
          <span className="tw:text-sm">--</span>
        );
      },
    },
    {
      title: (
        <div className="tw:flex tw:items-center tw:gap-2">
          {t('label.impact-score')}
          <Tooltip
            placement="top"
            title={
              <span className="tw:text-xs">
                {t('message.impact-score-helper')}
              </span>
            }>
            <HelpCircle height={16} width={16} />
          </Tooltip>
        </div>
      ),
      dataIndex: 'result',
      key: 'impactScore',
      width: 120,
      render: (result: DimensionResultWithTimestamp) => {
        return (
          <span className="tw:text-sm">{result?.impactScore ?? '--'}</span>
        );
      },
    },
    {
      title: t('label.dimension'),
      dataIndex: 'dimensionValue',
      key: 'dimensionValue',
      width: 200,
      render: (dimensionValue: string, record) => {
        return (
          <Link
            className="tw:text-text-brand-secondary"
            to={getTestCaseDimensionsDetailPagePath(
              testCase?.fullyQualifiedName || '',
              record.result.dimensionKey || ''
            )}>
            {dimensionValue}
          </Link>
        );
      },
    },
    {
      title: t('label.last-run'),
      dataIndex: 'result',
      key: 'lastRun',
      width: 200,
      render: (result: DimensionResultWithTimestamp) => {
        return result?.timestamp ? (
          <DateTimeDisplay timestamp={result.timestamp} />
        ) : (
          <span className="tw:text-sm">--</span>
        );
      },
    },
  ];

  const noDataPlaceholder = useMemo(() => {
    if (isLoading) {
      return (
        <div className="tw:flex tw:flex-col tw:gap-16">
          <Skeleton height={200} variant="rounded" width="100%" />
          <Skeleton height={200} variant="rounded" width="100%" />
        </div>
      );
    }

    return (
      <NoDataPlaceholderNew size={SIZE.LARGE}>
        <Trans
          components={{
            0: <span className="tw:text-sm" />,
            1: <span className="tw:text-sm" />,
            2: <Link to={pipelineLink} />,
          }}
          i18nKey="message.no-dimension-description"
        />
      </NoDataPlaceholderNew>
    );
  }, [isLoading, pipelineLink]);

  return (
    <div className="tw:flex tw:flex-col tw:p-5 tw:gap-6">
      <div className="tw:flex tw:items-center tw:flex-nowrap tw:gap-7.5">
        <div className="tw:flex tw:items-center tw:flex-nowrap tw:gap-2.5">
          <p className="tw:m-0 tw:text-[13px] tw:font-medium tw:whitespace-nowrap tw:text-primary">
            {`${t('label.select-dimension')}:`}
          </p>
          <Select
            className="tw:min-w-37.5"
            data-testid="dimension-select"
            items={dimensionColumnsOptions}
            size="sm"
            value={selectedDimension ?? null}
            onChange={handleDimensionChange}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
        </div>
        <div className="tw:flex tw:items-center tw:flex-nowrap tw:gap-2.5">
          <p className="tw:m-0 tw:text-[13px] tw:font-medium tw:whitespace-nowrap tw:text-primary">
            {`${t('label.date')}:`}
          </p>
          <MuiDatePickerMenu
            showSelectedCustomRange
            defaultDateRange={DEFAULT_SELECTED_RANGE}
            handleDateRangeChange={handleDateRangeChange}
            size="small"
          />
        </div>
      </div>

      {isEmpty(dimensionData) || isLoading ? (
        noDataPlaceholder
      ) : (
        <>
          <div className="tw:p-4 tw:shadow-none tw:border tw:border-border-secondary tw:rounded-[10px]">
            <DimensionalityHeatmap
              data={dimensionData}
              endDate={dateRange.endTs}
              isLoading={isLoading}
              startDate={dateRange.startTs}
            />
          </div>
          <div>
            <p className="tw:m-0 tw:mb-2.5 tw:text-sm tw:font-medium tw:text-primary">
              {t('label.entity-text-table', {
                entityText: selectedDimension || '',
              })}
            </p>
            <Table
              bordered
              columns={tableColumns}
              dataSource={getLatestResultPerDimension}
              loading={isLoading}
              pagination={false}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default DimensionalityTab;
