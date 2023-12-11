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
import { Col, Menu, MenuProps, Row, Space } from 'antd';
import Qs from 'qs';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useLocation } from 'react-router-dom';
import { ReactComponent as ColumnProfileIcon } from '../../assets/svg/column-profile.svg';
import { ReactComponent as DataQualityIcon } from '../../assets/svg/data-quality.svg';
import { ReactComponent as TableProfileIcon } from '../../assets/svg/table-profile.svg';
import { TableProfilerTab } from '../ProfilerDashboard/profilerDashboard.interface';
import { useTourProvider } from '../TourProvider/TourProvider';
import ColumnProfileTable from './Component/ColumnProfileTable';
import TableProfilerChart from './Component/TableProfilerChart';
import { QualityTab } from './QualityTab/QualityTab.component';
import { TableProfilerProps } from './TableProfiler.interface';
import { TableProfilerProvider } from './TableProfilerProvider';

const TableProfiler = (props: TableProfilerProps) => {
  const { isTourOpen } = useTourProvider();
  const history = useHistory();
  const location = useLocation();
  const { t } = useTranslation();
  const {
    activeTab = isTourOpen
      ? TableProfilerTab.COLUMN_PROFILE
      : TableProfilerTab.TABLE_PROFILE,
  } = useMemo(() => {
    const param = location.search;
    const searchData = Qs.parse(
      param.startsWith('?') ? param.substring(1) : param
    );

    return searchData as { activeTab: string; activeColumnFqn: string };
  }, [location.search, isTourOpen]);

  const { viewTest, viewProfiler } = useMemo(() => {
    const { permissions } = props;
    const viewPermission = permissions.ViewAll || permissions.ViewBasic;

    return {
      viewTest: viewPermission || permissions.ViewTests,
      viewProfiler: viewPermission || permissions.ViewDataProfile,
    };
  }, [props.permissions]);

  const tabOptions = useMemo(
    () => [
      {
        label: t('label.table-entity-text', {
          entityText: t('label.profile'),
        }),
        key: TableProfilerTab.TABLE_PROFILE,
        disabled: !viewProfiler,
        icon: <TableProfileIcon />,
      },
      {
        label: t('label.column-entity', {
          entity: t('label.profile'),
        }),
        key: TableProfilerTab.COLUMN_PROFILE,
        disabled: !viewProfiler,
        icon: <ColumnProfileIcon />,
      },
      {
        label: t('label.data-entity', {
          entity: t('label.quality'),
        }),
        key: TableProfilerTab.DATA_QUALITY,
        disabled: !viewTest,
        icon: <DataQualityIcon />,
      },
    ],
    [viewTest, viewProfiler]
  );

  const activeTabComponent = useMemo(() => {
    switch (activeTab) {
      case TableProfilerTab.DATA_QUALITY:
        return <QualityTab />;
      case TableProfilerTab.COLUMN_PROFILE:
        return <ColumnProfileTable />;
      case TableProfilerTab.TABLE_PROFILE:
      default:
        return <TableProfilerChart />;
    }
  }, [activeTab]);

  const handleTabChange: MenuProps['onClick'] = (value) => {
    history.push({ search: Qs.stringify({ activeTab: value.key }) });
  };

  return (
    <TableProfilerProvider {...props}>
      <Row
        className="table-profiler-container h-full flex-grow"
        data-testid="table-profiler-container"
        gutter={[16, 16]}
        id="profilerDetails">
        <Col className="p-t-sm data-quality-left-panel" span={4}>
          <Menu
            className="h-full p-x-0 custom-menu"
            data-testid="profiler-tab-left-panel"
            items={tabOptions}
            mode="inline"
            selectedKeys={[activeTab ?? TableProfilerTab.TABLE_PROFILE]}
            onClick={handleTabChange}
          />
        </Col>
        <Col className="data-quality-content-panel" span={20}>
          <Space
            className="w-full h-min-full p-sm"
            direction="vertical"
            size={16}>
            {activeTabComponent}
          </Space>
        </Col>
      </Row>
    </TableProfilerProvider>
  );
};

export default TableProfiler;
