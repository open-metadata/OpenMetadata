/*
 *  Copyright 2023 Collate.
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
import { Stack, Tab, Tabs } from '@mui/material';
import Qs from 'qs';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTourProvider } from '../../../../context/TourProvider/TourProvider';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
import profilerClassBase from '../TableProfiler/ProfilerClassBase';
import { TableProfilerProps } from '../TableProfiler/TableProfiler.interface';
import { TableProfilerProvider } from '../TableProfiler/TableProfilerProvider';
import './data-observability-tab.less';
import TabFilters from './TabFilters/TabFilters';

const DataObservabilityTab = (props: TableProfilerProps) => {
  const { isTourOpen } = useTourProvider();
  const navigate = useNavigate();
  const location = useCustomLocation();

  const { activeTab = profilerClassBase.getDefaultTabKey(isTourOpen) } =
    useMemo(() => {
      const param = location.search;
      const searchData = Qs.parse(
        param.startsWith('?') ? param.substring(1) : param
      );

      return searchData as {
        activeTab: TableProfilerTab;
        activeColumnFqn: string;
      };
    }, [location.search, isTourOpen]);

  const tabOptions = useMemo(() => {
    return profilerClassBase.getProfilerTabOptions();
  }, []);

  const activeTabComponent = useMemo(() => {
    const tabComponents = profilerClassBase.getProfilerTabs();
    const ActiveComponent = tabComponents[activeTab];

    return <ActiveComponent />;
  }, [activeTab]);

  const handleTabChangeMUI = (_: React.SyntheticEvent, newValue: string) => {
    navigate(
      { search: Qs.stringify({ activeTab: newValue }) },
      {
        replace: true,
      }
    );
  };

  return (
    <TableProfilerProvider {...props}>
      <div
        className="data-observability-tab-container"
        data-testid="table-profiler-container"
        id="profilerDetails">
        <Stack
          alignItems="center"
          direction="row"
          justifyContent="space-between"
          spacing={4}>
          <Tabs
            sx={(theme) => ({
              width: 'auto',
              display: 'inline-flex',
              '.MuiTab-root': {
                transition: 'background-color 0.2s ease-in, color 0.2s ease-in',
                borderRadius: '6px',
              },
              '.Mui-selected': {
                backgroundColor: `${theme.palette.primary.main} !important`,
                color: `${theme.palette.primary.contrastText} !important`,
              },
              '.MuiTab-root:hover': {
                backgroundColor: `${theme.palette.primary.main} !important`,
                color: `${theme.palette.primary.contrastText} !important`,
              },
              '.MuiTabs-indicator': {
                display: 'none',
              },
              '.MuiTabs-scroller': {
                padding: '0 8px',
              },
              '.MuiTab-root:not(:first-of-type)': {
                marginLeft: '4px',
              },
            })}
            value={activeTab}
            onChange={handleTabChangeMUI}>
            {tabOptions.map(({ label, key }) => (
              <Tab key={key} label={label} value={key} />
            ))}
          </Tabs>
          <TabFilters />
        </Stack>
        <div className="data-observability-content-panel">
          {activeTabComponent}
        </div>
      </div>
    </TableProfilerProvider>
  );
};

export default DataObservabilityTab;
