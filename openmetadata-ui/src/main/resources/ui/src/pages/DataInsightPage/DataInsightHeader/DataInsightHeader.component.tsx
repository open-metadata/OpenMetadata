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
import { Button, Col, Row, Space, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import DataInsightSummary from '../../../components/DataInsightDetail/DataInsightSummary';
import KPIChart from '../../../components/DataInsightDetail/KPIChart';
import DatePickerMenu from '../../../components/DatePickerMenu/DatePickerMenu.component';
import { usePermissionProvider } from '../../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../components/PermissionProvider/PermissionProvider.interface';
import SearchDropdown from '../../../components/SearchDropdown/SearchDropdown';
import { ROUTES } from '../../../constants/constants';
import { Operation } from '../../../generated/entity/policies/policy';
import { DataInsightTabs } from '../../../interface/data-insight.interface';
import { getOptionalDataInsightTabFlag } from '../../../utils/DataInsightUtils';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { DataInsightHeaderProps } from './DataInsightHeader.interface';

const DataInsightHeader = ({
  team,
  tier,
  chartFilter,
  onScrollToChart,
  onChartFilterChange,
  kpi,
}: DataInsightHeaderProps) => {
  const { tab } = useParams<{ tab: DataInsightTabs }>();
  const history = useHistory();
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();

  const { showDataInsightSummary, showKpiChart } =
    getOptionalDataInsightTabFlag(tab);

  const viewKPIPermission = useMemo(
    () => checkPermission(Operation.ViewAll, ResourceEntity.KPI, permissions),
    [permissions]
  );

  const createKPIPermission = useMemo(
    () => checkPermission(Operation.Create, ResourceEntity.KPI, permissions),
    [permissions]
  );

  const handleAddKPI = () => {
    history.push(ROUTES.ADD_KPI);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Space className="w-full justify-between items-start">
          <div data-testid="data-insight-header">
            <Typography.Title level={5}>
              {t('label.data-insight-plural')}
            </Typography.Title>
            <Typography.Text className="data-insight-label-text">
              {t('message.data-insight-subtitle')}
            </Typography.Text>
          </div>

          {createKPIPermission && (
            <Button
              data-testid="add-kpi-btn"
              type="primary"
              onClick={handleAddKPI}>
              {t('label.add-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Button>
          )}
        </Space>
      </Col>
      <Col span={24}>
        <Space className="w-full justify-between align-center">
          <Space className="w-full" size={16}>
            <SearchDropdown
              label={t('label.team')}
              searchKey="teams"
              {...team}
            />

            <SearchDropdown
              label={t('label.tier')}
              searchKey="tier"
              {...tier}
            />
          </Space>
          <Space>
            <Typography className="data-insight-label-text text-xs">
              {`${formatDate(chartFilter.startTs)} - ${formatDate(
                chartFilter.endTs
              )}`}
            </Typography>
            <DatePickerMenu
              handleDateRangeChange={onChartFilterChange}
              showSelectedCustomRange={false}
            />
          </Space>
        </Space>
      </Col>

      {/* Do not show summary for KPIs */}
      {showDataInsightSummary && (
        <Col span={24}>
          <DataInsightSummary
            chartFilter={chartFilter}
            onScrollToChart={onScrollToChart}
          />
        </Col>
      )}

      {/* Do not show KPIChart for app analytics */}
      {showKpiChart && (
        <Col span={24}>
          <KPIChart
            chartFilter={chartFilter}
            createKPIPermission={createKPIPermission}
            isKpiLoading={kpi.isLoading}
            kpiList={kpi.data}
            viewKPIPermission={viewKPIPermission}
          />
        </Col>
      )}
    </Row>
  );
};

export default DataInsightHeader;
