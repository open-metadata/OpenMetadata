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
import { Box, Grid, Typography } from '@openmetadata/ui-core-components';
import { Button } from 'antd';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DatePickerMenu from '../../../components/common/DatePickerMenu/DatePickerMenu.component';
import ManageButton from '../../../components/common/EntityPageInfos/ManageButton/ManageButton';
import FilterSelectDropdown from '../../../components/common/FilterSelectDropdown/FilterSelectDropdown';
import DataInsightSummary from '../../../components/DataInsight/DataInsightSummary';
import KPIChart from '../../../components/DataInsight/KPIChart';
import { ROUTES } from '../../../constants/constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { EntityType } from '../../../enums/entity.enum';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { DataInsightTabs } from '../../../interface/data-insight.interface';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { getOptionalDataInsightTabFlag } from '../../../utils/DataInsightPureUtils';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import dataInsightClassBase from '../DataInsightClassBase';
import { useDataInsightProvider } from '../DataInsightProvider';
import { DataInsightHeaderProps } from './DataInsightHeader.interface';
const DataInsightHeader = ({ onScrollToChart }: DataInsightHeaderProps) => {
  const {
    teamFilter: team,
    tierFilter: tier,
    chartFilter,
    onChartFilterChange,
    kpi,
  } = useDataInsightProvider();

  const { tab } = useRequiredParams<{ tab: DataInsightTabs }>();
  const navigate = useNavigate();
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

  const extraDropdownContent = useMemo(
    () => dataInsightClassBase.getManageExtraOptions(),
    []
  );

  const handleAddKPI = () => {
    navigate(ROUTES.ADD_KPI);
  };

  return (
    <Grid className="layout-row layout-grid" style={getLayoutGutter(16, 16)}>
      <Grid.Item className="layout-column" span={24}>
        <Box
          inline
          align="start"
          className="layout-space layout-space-horizontal w-full justify-between"
          gap={2}
          itemClassName="layout-space-item">
          <div data-testid="data-insight-header">
            <div className="flex gap-2 items-center">
              <Typography
                as="h5"
                className="tw:mb-2!"
                size="text-md"
                weight="semibold">
                {t('label.data-insight-plural')}
              </Typography>
            </div>
            <Typography className="data-insight-label-text">
              {t('message.data-insight-subtitle')}
            </Typography>
          </div>

          <div className="d-flex gap-2">
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

            {!isEmpty(extraDropdownContent) ? (
              <ManageButton
                entityName={EntityType.KPI}
                entityType={EntityType.KPI}
                extraDropdownContent={extraDropdownContent}
              />
            ) : null}
          </div>
        </Box>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Box
          inline
          align="center"
          className="layout-space layout-space-horizontal w-full justify-between align-center"
          gap={2}
          itemClassName="layout-space-item">
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal w-full"
            gap={4}
            itemClassName="layout-space-item">
            <FilterSelectDropdown
              hideCounts
              label={t('label.team')}
              searchKey="teams"
              {...team}
            />

            <FilterSelectDropdown
              hideCounts
              label={t('label.tier')}
              searchKey="tier"
              {...tier}
            />
          </Box>
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            gap={2}
            itemClassName="layout-space-item">
            <Typography
              as="article"
              className="data-insight-label-text text-xs">
              {`${formatDate(chartFilter.startTs)} - ${formatDate(
                chartFilter.endTs
              )}`}
            </Typography>
            <DatePickerMenu
              handleDateRangeChange={onChartFilterChange}
              showSelectedCustomRange={false}
            />
          </Box>
        </Box>
      </Grid.Item>

      {/* Do not show summary for KPIs */}
      {showDataInsightSummary && (
        <Grid.Item className="layout-column" span={24}>
          <DataInsightSummary
            chartFilter={chartFilter}
            onScrollToChart={onScrollToChart}
          />
        </Grid.Item>
      )}

      {/* Do not show KPIChart for app analytics */}
      {showKpiChart && (
        <Grid.Item className="layout-column" span={24}>
          <KPIChart
            chartFilter={chartFilter}
            createKPIPermission={createKPIPermission}
            isKpiLoading={kpi.isLoading}
            kpiList={kpi.data}
            viewKPIPermission={viewKPIPermission}
          />
        </Grid.Item>
      )}
    </Grid>
  );
};

export default DataInsightHeader;
