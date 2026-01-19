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
import { KeyboardArrowDown } from '@mui/icons-material';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { isEmpty, isEqual, omit, pick } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { ReactComponent as SettingIcon } from '../../../../../assets/svg/ic-settings-primery.svg';
import { useTourProvider } from '../../../../../context/TourProvider/TourProvider';
import { EntityTabs, EntityType } from '../../../../../enums/entity.enum';
import { ProfilerDashboardType } from '../../../../../enums/table.enum';
import { Operation } from '../../../../../generated/entity/policies/policy';
import LimitWrapper from '../../../../../hoc/LimitWrapper';
import useCustomLocation from '../../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../../hooks/useFqn';
import { getPrioritizedEditPermission } from '../../../../../utils/PermissionsUtils';
import {
  getAddCustomMetricPath,
  getEntityDetailsPath,
} from '../../../../../utils/RouterUtils';
import MuiDatePickerMenu from '../../../../common/MuiDatePickerMenu/MuiDatePickerMenu';
import TabsLabel from '../../../../common/TabsLabel/TabsLabel.component';
import { TestLevel } from '../../../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.interface';
import { ProfilerTabPath } from '../../ProfilerDashboard/profilerDashboard.interface';
import ColumnPickerMenu from '../../TableProfiler/ColumnPickerMenu';
import profilerClassBase from '../../TableProfiler/ProfilerClassBase';
import { useTableProfiler } from '../../TableProfiler/TableProfilerProvider';

const TabFilters = () => {
  const { isTourOpen } = useTourProvider();
  const location = useCustomLocation();
  const theme = useTheme();
  const { subTab: activeTab = profilerClassBase.getDefaultTabKey(isTourOpen) } =
    useParams<{ subTab: ProfilerTabPath }>();

  const searchData = useMemo(() => {
    const param = location.search;

    return QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );
  }, [location.search]);

  const { formType, activeColumnFqn, dateRangeObject } = useMemo(() => {
    const startTs = searchData.startTs ? Number(searchData.startTs) : undefined;
    const endTs = searchData.endTs ? Number(searchData.endTs) : undefined;

    return {
      activeColumnFqn: searchData.activeColumnFqn as string,
      formType:
        activeTab === ProfilerTabPath.COLUMN_PROFILE
          ? TestLevel.COLUMN
          : TestLevel.TABLE,
      dateRangeObject: {
        startTs,
        endTs,
        key: searchData.key as string,
        title: searchData.title as string,
      } as DateRangeObject,
    } as {
      activeColumnFqn: string;
      formType: TestLevel | ProfilerDashboardType;
      dateRangeObject: DateRangeObject;
    };
  }, [searchData, activeTab, isTourOpen]);

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const {
    permissions,
    isTableDeleted = false,
    onSettingButtonClick,
    onTestCaseDrawerOpen,
    table,
  } = useTableProfiler();

  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn: datasetFQN } = useFqn();
  const editDataProfile =
    permissions &&
    getPrioritizedEditPermission(permissions, Operation.EditDataProfile);

  const handleTestCaseClick = () => {
    onTestCaseDrawerOpen(formType as TestLevel);
    handleMenuClose();
  };

  const handleCustomMetricClick = () => {
    navigate(
      getAddCustomMetricPath(formType as ProfilerDashboardType, datasetFQN)
    );
    handleMenuClose();
  };

  const handleDateRangeChange = (value: DateRangeObject) => {
    const updatedFilter = pick(value, ['startTs', 'endTs', 'key', 'title']);
    const existingFilters = pick(dateRangeObject, ['startTs', 'endTs']);

    if (!isEqual(existingFilters, pick(updatedFilter, ['startTs', 'endTs']))) {
      navigate(
        {
          pathname: getEntityDetailsPath(
            EntityType.TABLE,
            datasetFQN,
            EntityTabs.PROFILER,
            activeTab
          ),
          search: QueryString.stringify({
            ...searchData,
            ...updatedFilter,
          }),
        },
        {
          replace: true,
        }
      );
    }
  };

  const handleDateRangeClear = () => {
    navigate(
      {
        pathname: getEntityDetailsPath(
          EntityType.TABLE,
          datasetFQN,
          EntityTabs.PROFILER,
          activeTab
        ),
        search: QueryString.stringify(
          omit(searchData, ['startTs', 'endTs', 'key', 'title'])
        ),
      },
      {
        replace: true,
      }
    );
  };

  const updateActiveColumnFqn = (key: string) => {
    navigate({
      pathname: getEntityDetailsPath(
        EntityType.TABLE,
        datasetFQN,
        EntityTabs.PROFILER,
        activeTab
      ),
      search: QueryString.stringify({
        ...searchData,
        activeColumnFqn: key,
      }),
    });
  };

  return (
    <Stack
      alignItems="center"
      direction="row"
      justifyContent="flex-end"
      spacing={5}>
      {!isEmpty(activeColumnFqn) && (
        <Box alignItems="center" display="flex" gap={2}>
          <Typography
            sx={{
              color: theme.palette.grey[900],
              fontSize: theme.typography.pxToRem(13),
              fontWeight: 500,
            }}>
            {`${t('label.column')}:`}
          </Typography>
          <ColumnPickerMenu
            activeColumnFqn={activeColumnFqn}
            columns={table?.columns || []}
            handleChange={updateActiveColumnFqn}
          />
        </Box>
      )}

      {[
        ProfilerTabPath.COLUMN_PROFILE,
        ProfilerTabPath.DATA_QUALITY,
        ProfilerTabPath.OVERVIEW,
      ].includes(activeTab) && isEmpty(activeColumnFqn) ? null : (
        <Box alignItems="center" display="flex" gap={2}>
          <Typography
            sx={{
              color: theme.palette.grey[900],
              fontSize: theme.typography.pxToRem(13),
              fontWeight: 500,
            }}>
            {`${t('label.date')}:`}
          </Typography>
          <MuiDatePickerMenu
            allowClear
            showSelectedCustomRange
            defaultDateRange={dateRangeObject}
            handleDateRangeChange={handleDateRangeChange}
            size="small"
            onClear={handleDateRangeClear}
          />
        </Box>
      )}

      {editDataProfile && !isTableDeleted && (
        <>
          <LimitWrapper resource="dataQuality">
            <>
              <Button
                data-testid="profiler-add-table-test-btn"
                endIcon={<KeyboardArrowDown />}
                sx={{ height: '32px' }}
                variant="contained"
                onClick={handleMenuClick}>
                {t('label.add')}
              </Button>
              <Menu
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                open={open}
                sx={{
                  '.MuiPaper-root': {
                    width: 'max-content',
                  },
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                onClose={handleMenuClose}>
                <MenuItem onClick={handleTestCaseClick}>
                  <TabsLabel id="test-case" name={t('label.test-case')} />
                </MenuItem>
                <MenuItem onClick={handleCustomMetricClick}>
                  <TabsLabel
                    id="custom-metric"
                    name={t('label.custom-metric')}
                  />
                </MenuItem>
              </Menu>
            </>
          </LimitWrapper>
          <Tooltip placement="top" title={t('label.setting-plural')}>
            <Button
              color="primary"
              data-testid="profiler-setting-btn"
              sx={{
                minWidth: '36px',
                height: '32px',
              }}
              variant="outlined"
              onClick={onSettingButtonClick}>
              <SettingIcon />
            </Button>
          </Tooltip>
        </>
      )}
    </Stack>
  );
};

export default TabFilters;
