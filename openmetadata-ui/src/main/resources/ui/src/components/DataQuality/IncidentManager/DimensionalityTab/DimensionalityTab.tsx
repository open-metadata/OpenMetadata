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
import {
  Box,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import { ColumnsType } from 'antd/lib/table';
import { format } from 'date-fns';
import { toLower } from 'lodash';
import { DateRangeObject } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DEFAULT_RANGE_DATA } from '../../../../constants/profiler.constant';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import { getTestCaseDimensionResultsByFqn } from '../../../../rest/testAPI';
import { getTestCaseDimensionsDetailPagePath } from '../../../../utils/RouterUtils';
import DateTimeDisplay from '../../../common/DateTimeDisplay/DateTimeDisplay';
import MuiDatePickerMenu from '../../../common/MuiDatePickerMenu/MuiDatePickerMenu';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import Table from '../../../common/Table/Table';
import DimensionalityHeatmap from './DimensionalityHeatmap/DimensionalityHeatmap.component';
import { DimensionResultWithTimestamp } from './DimensionalityHeatmap/DimensionalityHeatmap.interface';
import { getMockDimensionResults } from './DimensionalityHeatmap/DimensionalityHeatmap.mock';

const USE_MOCK_DATA = false;

const DimensionalityTab = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { testCase } = useTestCaseStore();
  const [dateRange, setDateRange] = useState(DEFAULT_RANGE_DATA);
  const [dimensionData, setDimensionData] = useState<
    DimensionResultWithTimestamp[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const dimensionColumnsOptions = useMemo(
    () => testCase?.dimensionColumns ?? [],
    [testCase]
  );

  const [selectedDimension, setSelectedDimension] = useState(
    dimensionColumnsOptions?.[0]
  );

  const handleDateRangeChange = (value: DateRangeObject) => {
    setDateRange({
      startTs: value.startTs,
      endTs: value.endTs,
    });
  };

  const handleDimensionChange = (event: SelectChangeEvent<string>) => {
    setSelectedDimension(event.target.value);
  };

  const fetchDimensionColumnData = async () => {
    setIsLoading(true);
    try {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const mockData = getMockDimensionResults(
          dateRange.startTs,
          dateRange.endTs
        );
        setDimensionData(mockData);
      } else {
        if (!testCase?.fullyQualifiedName || !selectedDimension) {
          return;
        }
        const response = await getTestCaseDimensionResultsByFqn(
          testCase.fullyQualifiedName,
          {
            // dimensionalityKey: selectedDimension,
            // startTs: dateRange.startTs,
            // endTs: dateRange.endTs,
          }
        );
        setDimensionData(response.data);
      }
    } catch (error) {
      setDimensionData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (USE_MOCK_DATA || selectedDimension) {
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

    return Array.from(dimensionMap.entries()).map(
      ([dimensionValue, result]) => ({
        key: `${dimensionValue}-${result.timestamp}`,
        dimensionValue,
        result,
      })
    );
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
            label={result.testCaseStatus}
            status={toLower(result.testCaseStatus) as StatusType}
          />
        ) : (
          <Typography sx={{ fontSize: 14 }}>--</Typography>
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
          <Typography
            sx={{
              color: 'primary.main',
              fontSize: 14,
              fontWeight: 400,
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}>
            <Link
              to={getTestCaseDimensionsDetailPagePath(
                testCase?.fullyQualifiedName || '',
                record.result.dimensionKey || ''
              )}>
              {dimensionValue}
            </Link>
          </Typography>
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
          <Typography sx={{ fontSize: 14 }}>--</Typography>
        );
      },
    },
  ];

  return (
    <Stack p={5} spacing={4}>
      <Box alignItems="center" display="flex" flexWrap="nowrap" gap={3}>
        <Box alignItems="center" display="flex" flexWrap="nowrap" gap={1}>
          <Typography
            sx={{
              color: theme.palette.grey[900],
              fontSize: theme.typography.pxToRem(13),
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
            {`${t('label.date')}:`}
          </Typography>
          <MuiDatePickerMenu
            showSelectedCustomRange
            handleDateRangeChange={handleDateRangeChange}
            size="small"
          />
        </Box>
        <Box alignItems="center" display="flex" flexWrap="nowrap" gap={1}>
          <Typography
            sx={{
              color: theme.palette.grey[900],
              fontSize: theme.typography.pxToRem(13),
              fontWeight: 500,
              whiteSpace: 'nowrap',
            }}>
            {`${t('label.select-dimension')}:`}
          </Typography>
          <Select
            size="small"
            sx={{
              minWidth: 150,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.grey[300],
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.grey[400],
              },
              '& .MuiSelect-select': {
                fontSize: '12px',
                padding: '6px 12px',
              },
            }}
            value={selectedDimension}
            onChange={handleDimensionChange}>
            {dimensionColumnsOptions.map((column) => (
              <MenuItem key={column} value={column}>
                {column}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      <DimensionalityHeatmap
        data={dimensionData}
        endDate={dateRange.endTs}
        isLoading={isLoading}
        startDate={dateRange.startTs}
      />
      <Table
        bordered
        columns={tableColumns}
        dataSource={getLatestResultPerDimension}
        loading={isLoading}
        pagination={false}
      />
    </Stack>
  );
};

export default DimensionalityTab;
