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
import { HelpOutline, KeyboardArrowDown } from '@mui/icons-material';
import {
  Box,
  Card,
  MenuItem,
  Select,
  SelectChangeEvent,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
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
  const theme = useTheme();
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

    return {
      dimensionColumnsOptions: testCase?.dimensionColumns ?? [],
      selectedColumn: column ? column : testCase?.dimensionColumns?.[0],
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

  const handleDimensionChange = (event: SelectChangeEvent<string>) => {
    setSelectedDimension(event.target.value);
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
          <Typography sx={{ fontSize: 14 }}>--</Typography>
        );
      },
    },
    {
      title: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {t('label.impact-score')}
          <Tooltip
            placement="top"
            title={
              <Typography sx={{ fontSize: 12 }}>
                {t('message.impact-score-helper')}
              </Typography>
            }>
            <HelpOutline sx={{ fontSize: 16 }} />
          </Tooltip>
        </Box>
      ),
      dataIndex: 'result',
      key: 'impactScore',
      width: 120,
      render: (result: DimensionResultWithTimestamp) => {
        return (
          <Typography sx={{ fontSize: 14 }}>
            {result?.impactScore ?? '--'}
          </Typography>
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

  const noDataPlaceholder = useMemo(() => {
    if (isLoading) {
      return (
        <Stack spacing={8}>
          <Skeleton height={200} variant="rounded" width="100%" />
          <Skeleton height={200} variant="rounded" width="100%" />
        </Stack>
      );
    }

    return (
      <NoDataPlaceholderNew size={SIZE.LARGE}>
        <Trans
          components={{
            0: <Typography sx={{ fontSize: '14px' }} />,
            1: <Typography sx={{ fontSize: '14px' }} />,
            2: <Link to={pipelineLink} />,
          }}
          i18nKey="message.no-dimension-description"
        />
      </NoDataPlaceholderNew>
    );
  }, [isLoading, pipelineLink]);

  return (
    <Stack p={5} spacing={7}>
      <Box alignItems="center" display="flex" flexWrap="nowrap" gap={7.5}>
        <Box alignItems="center" display="flex" flexWrap="nowrap" gap={2.5}>
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
            IconComponent={KeyboardArrowDown}
            MenuProps={{
              PaperProps: {
                sx: {
                  width: 'max-content',
                  '& .MuiMenuItem-root': {
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                      '&:hover': {
                        backgroundColor: theme.palette.primary.dark,
                      },
                    },
                  },
                },
              },
            }}
            data-testid="dimension-select"
            size="small"
            sx={{
              minWidth: 150,
              fontWeight: 600,
              '& .MuiSvgIcon-root': {
                color: theme.palette.grey[900],
              },
              '& .MuiSelect-select': {
                fontSize: '12px !important',
                lineHeight: '18px !important',
                padding: '6px 12px !important',
                'box-shadow': 'none !important',
                border: `1px solid ${theme.palette.grey[200]}`,
              },
              '&:hover .MuiSelect-select': {
                bgcolor: theme.palette.grey[50],
              },
            }}
            value={selectedDimension}
            onChange={handleDimensionChange}>
            {dimensionColumnsOptions.map((column) => (
              <MenuItem
                key={column}
                sx={{
                  fontWeight: 500,
                }}
                value={column}>
                {column}
              </MenuItem>
            ))}
          </Select>
        </Box>
        <Box alignItems="center" display="flex" flexWrap="nowrap" gap={2.5}>
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
            defaultDateRange={DEFAULT_SELECTED_RANGE}
            handleDateRangeChange={handleDateRangeChange}
            size="small"
          />
        </Box>
      </Box>

      {isEmpty(dimensionData) || isLoading ? (
        noDataPlaceholder
      ) : (
        <>
          <Card
            sx={{
              p: 4,
              boxShadow: 'none',
              border: `1px solid ${theme.palette.grey[200]}`,
              borderRadius: '10px',
            }}>
            <DimensionalityHeatmap
              data={dimensionData}
              endDate={dateRange.endTs}
              isLoading={isLoading}
              startDate={dateRange.startTs}
            />
          </Card>
          <Box>
            <Typography
              sx={{
                mb: 2.5,
                color: theme.palette.grey[900],
                fontSize: theme.typography.pxToRem(14),
                fontWeight: 500,
              }}>
              {t('label.entity-text-table', {
                entityText: selectedDimension || '',
              })}
            </Typography>
            <Table
              bordered
              columns={tableColumns}
              dataSource={getLatestResultPerDimension}
              loading={isLoading}
              pagination={false}
            />
          </Box>
        </>
      )}
    </Stack>
  );
};

export default DimensionalityTab;
