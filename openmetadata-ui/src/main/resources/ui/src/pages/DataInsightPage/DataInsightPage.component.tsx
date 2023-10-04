/*
 *  Copyright 2022 Collate.
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
import { t } from 'i18next';
import { isEmpty, isEqual } from 'lodash';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ListItem } from 'react-awesome-query-builder';
import { useHistory, useParams } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import DailyActiveUsersChart from '../../components/DataInsightDetail/DailyActiveUsersChart';
import DataInsightSummary from '../../components/DataInsightDetail/DataInsightSummary';
import DescriptionInsight from '../../components/DataInsightDetail/DescriptionInsight';
import KPIChart from '../../components/DataInsightDetail/KPIChart';
import OwnerInsight from '../../components/DataInsightDetail/OwnerInsight';
import PageViewsByEntitiesChart from '../../components/DataInsightDetail/PageViewsByEntitiesChart';
import TierInsight from '../../components/DataInsightDetail/TierInsight';
import TopActiveUsers from '../../components/DataInsightDetail/TopActiveUsers';
import TopViewEntities from '../../components/DataInsightDetail/TopViewEntities';
import TotalEntityInsight from '../../components/DataInsightDetail/TotalEntityInsight';
import DatePickerMenu from '../../components/DatePickerMenu/DatePickerMenu.component';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { DateRangeObject } from '../../components/ProfilerDashboard/component/TestSummary';
import SearchDropdown from '../../components/SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../components/SearchDropdown/SearchDropdown.interface';
import { autocomplete } from '../../constants/AdvancedSearch.constants';
import { PAGE_SIZE, ROUTES } from '../../constants/constants';
import {
  ENTITIES_CHARTS,
  INITIAL_CHART_FILTER,
} from '../../constants/DataInsight.constants';
import {
  DEFAULT_RANGE_DATA,
  DEFAULT_SELECTED_RANGE,
} from '../../constants/profiler.constant';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { Tag } from '../../generated/entity/classification/tag';
import { Operation } from '../../generated/entity/policies/policy';
import {
  ChartFilter,
  DataInsightTabs,
} from '../../interface/data-insight.interface';
import { getListKPIs } from '../../rest/KpiAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getTags } from '../../rest/tagAPI';
import {
  getDataInsightPathWithFqn,
  getTeamFilter,
} from '../../utils/DataInsightUtils';
import { formatDate } from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { TeamStateType, TierStateType } from './DataInsight.interface';
import './DataInsight.less';
import DataInsightLeftPanel from './DataInsightLeftPanel';
import KPIList from './KPIList';

const fetchTeamSuggestions = autocomplete({
  searchIndex: SearchIndex.TEAM,
  entitySearchIndex: SearchIndex.TEAM,
  entityField: EntityFields.OWNER,
});

const DataInsightPage = () => {
  const { tab } = useParams<{ tab: DataInsightTabs }>();

  const { permissions } = usePermissionProvider();
  const history = useHistory();

  const viewDataInsightChartPermission = useMemo(
    () =>
      checkPermission(
        Operation.ViewAll,
        ResourceEntity.DATA_INSIGHT_CHART,
        permissions
      ),
    [permissions]
  );

  const viewKPIPermission = useMemo(
    () => checkPermission(Operation.ViewAll, ResourceEntity.KPI, permissions),
    [permissions]
  );

  const createKPIPermission = useMemo(
    () => checkPermission(Operation.Create, ResourceEntity.KPI, permissions),
    [permissions]
  );

  const [teamsOptions, setTeamOptions] = useState<TeamStateType>({
    defaultOptions: [],
    selectedOptions: [],
    options: [],
  });
  const [tierOptions, setTierOptions] = useState<TierStateType>({
    selectedOptions: [],
    options: [],
  });

  const [activeTab, setActiveTab] = useState(DataInsightTabs.DATA_ASSETS);
  const [chartFilter, setChartFilter] =
    useState<ChartFilter>(INITIAL_CHART_FILTER);
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const [isKpiLoading, setIsKpiLoading] = useState(false);
  const [selectedDaysFilter, setSelectedDaysFilter] = useState(
    DEFAULT_SELECTED_RANGE.days
  );
  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);
  const [tier, setTier] = useState<{ tags: Tag[]; isLoading: boolean }>({
    tags: [],
    isLoading: true,
  });

  const [selectedChart, setSelectedChart] = useState<DataInsightChartType>();

  const defaultTierOptions = useMemo(() => {
    return tier.tags.map((op) => ({
      key: op.fullyQualifiedName ?? op.name,
      label: getEntityName(op),
    }));
  }, [tier]);

  const { descriptionKpi, ownerKpi } = useMemo(() => {
    return {
      descriptionKpi: kpiList.find(
        (kpi) =>
          kpi.dataInsightChart.name ===
          DataInsightChartType.PercentageOfEntitiesWithDescriptionByType
      ),
      ownerKpi: kpiList.find(
        (kpi) =>
          kpi.dataInsightChart.name ===
          DataInsightChartType.PercentageOfEntitiesWithOwnerByType
      ),
    };
  }, [kpiList]);

  const handleTierChange = (tiers: SearchDropdownOption[] = []) => {
    setTierOptions((prev) => ({ ...prev, selectedOptions: tiers }));
    setChartFilter((previous) => ({
      ...previous,
      tier: tiers.length ? tiers.map((tier) => tier.key).join(',') : undefined,
    }));
  };

  const handleDateRangeChange = (
    value: DateRangeObject,
    daysValue?: number
  ) => {
    if (!isEqual(value, dateRangeObject)) {
      setDateRangeObject(value);
      setSelectedDaysFilter(daysValue ?? 0);
      setChartFilter((previous) => ({
        ...previous,
        startTs: value.startTs,
        endTs: value.endTs,
      }));
    }
  };

  const handleTeamChange = (teams: SearchDropdownOption[] = []) => {
    setTeamOptions((prev) => ({
      ...prev,
      selectedOptions: teams,
    }));
    setChartFilter((previous) => ({
      ...previous,
      team: teams.length ? teams.map((team) => team.key).join(',') : undefined,
    }));
  };

  const handleTeamSearch = async (query: string) => {
    if (fetchTeamSuggestions && !isEmpty(query)) {
      try {
        const response = await fetchTeamSuggestions(query, PAGE_SIZE);
        setTeamOptions((prev) => ({
          ...prev,
          options: getTeamFilter(response.values as ListItem[]),
        }));
      } catch (_error) {
        // we will not show the toast error message for suggestion API
      }
    } else {
      setTeamOptions((prev) => ({
        ...prev,
        options: prev.defaultOptions,
      }));
    }
  };

  const handleTierSearch = async (query: string) => {
    if (query) {
      setTierOptions((prev) => ({
        ...prev,
        options: prev.options.filter(
          (value) =>
            value.label
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()) ||
            value.key.toLocaleLowerCase().includes(query.toLocaleLowerCase())
        ),
      }));
    } else {
      setTierOptions((prev) => ({
        ...prev,
        options: defaultTierOptions,
      }));
    }
  };

  const fetchDefaultTeamOptions = async () => {
    if (teamsOptions.defaultOptions.length) {
      setTeamOptions((prev) => ({
        ...prev,
        options: prev.defaultOptions,
      }));

      return;
    }

    try {
      const response = await searchQuery({
        searchIndex: SearchIndex.TEAM,
        query: '*',
        pageSize: PAGE_SIZE,
      });
      const hits = response.hits.hits;
      const teamFilterOptions = hits.map((hit) => {
        const source = hit._source;

        return { key: source.name, label: source.displayName ?? source.name };
      });
      setTeamOptions((prev) => ({
        ...prev,
        defaultOptions: teamFilterOptions,
        options: teamFilterOptions,
      }));
    } catch (_error) {
      // we will not show the toast error message for search API
    }
  };

  const getTierTag = async () => {
    setTier((prev) => ({ ...prev, isLoading: true }));
    try {
      const { data } = await getTags({
        parent: 'Tier',
      });

      setTier((prev) => ({ ...prev, tags: data }));
      setTierOptions((prev) => ({
        ...prev,
        options: data.map((op) => ({
          key: op.fullyQualifiedName ?? op.name,
          label: getEntityName(op),
        })),
      }));
    } catch (error) {
      // error
    } finally {
      setTier((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const fetchDefaultTierOptions = () => {
    setTierOptions((prev) => ({
      ...prev,
      options: defaultTierOptions,
    }));
  };

  const fetchKpiList = async () => {
    setIsKpiLoading(true);
    try {
      const response = await getListKPIs({ fields: 'dataInsightChart' });
      setKpiList(response.data);
    } catch (_err) {
      setKpiList([]);
    } finally {
      setIsKpiLoading(false);
    }
  };

  const handleScrollToChart = (chartType: DataInsightChartType) => {
    if (ENTITIES_CHARTS.includes(chartType)) {
      history.push(getDataInsightPathWithFqn(DataInsightTabs.DATA_ASSETS));
    } else {
      history.push(getDataInsightPathWithFqn(DataInsightTabs.APP_ANALYTICS));
    }
    setSelectedChart(chartType);
  };

  const handleAddKPI = () => {
    history.push(ROUTES.ADD_KPI);
  };

  useLayoutEffect(() => {
    if (selectedChart) {
      const element = document.getElementById(selectedChart);
      if (element) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setSelectedChart(undefined);
      }
    }
  }, [selectedChart]);

  useEffect(() => {
    getTierTag();
    fetchDefaultTeamOptions();
    fetchKpiList();
  }, []);

  useEffect(() => {
    setChartFilter(INITIAL_CHART_FILTER);
  }, []);

  useEffect(() => {
    setActiveTab(tab ?? DataInsightTabs.DATA_ASSETS);
  }, [tab]);

  if (!viewDataInsightChartPermission && !viewKPIPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  const getTabContent = () => {
    const noDataInsightPermission =
      !viewDataInsightChartPermission &&
      (activeTab === DataInsightTabs.APP_ANALYTICS ||
        activeTab === DataInsightTabs.DATA_ASSETS);

    const noKPIPermission =
      !viewKPIPermission && activeTab === DataInsightTabs.KPIS;

    if (noDataInsightPermission || noKPIPermission) {
      return (
        <Row align="middle" className="w-full h-full" justify="center">
          <Col span={24}>
            <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
          </Col>
        </Row>
      );
    }

    return (
      <Row
        className="page-container"
        data-testid="data-insight-container"
        gutter={[16, 16]}>
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
                options={teamsOptions.options}
                searchKey="teams"
                selectedKeys={teamsOptions.selectedOptions}
                onChange={handleTeamChange}
                onGetInitialOptions={fetchDefaultTeamOptions}
                onSearch={handleTeamSearch}
              />

              <SearchDropdown
                label={t('label.tier')}
                options={tierOptions.options}
                searchKey="tier"
                selectedKeys={tierOptions.selectedOptions}
                onChange={handleTierChange}
                onGetInitialOptions={fetchDefaultTierOptions}
                onSearch={handleTierSearch}
              />
            </Space>
            <Space>
              <Typography className="data-insight-label-text text-xs">
                {`${formatDate(chartFilter.startTs)} - ${formatDate(
                  chartFilter.endTs
                )}`}
              </Typography>
              <DatePickerMenu
                handleDateRangeChange={handleDateRangeChange}
                showSelectedCustomRange={false}
              />
            </Space>
          </Space>
        </Col>

        {/* Do not show summary for KPIs */}
        {tab !== DataInsightTabs.KPIS && (
          <Col span={24}>
            <DataInsightSummary
              chartFilter={chartFilter}
              onScrollToChart={handleScrollToChart}
            />
          </Col>
        )}

        {/* Do not show KPIChart for app analytics */}
        {tab !== DataInsightTabs.APP_ANALYTICS && (
          <Col span={24}>
            <KPIChart
              chartFilter={chartFilter}
              createKPIPermission={createKPIPermission}
              isKpiLoading={isKpiLoading}
              kpiList={kpiList}
              viewKPIPermission={viewKPIPermission}
            />
          </Col>
        )}
        {activeTab === DataInsightTabs.DATA_ASSETS && (
          <>
            <Col span={24}>
              <TotalEntityInsight
                chartFilter={chartFilter}
                selectedDays={selectedDaysFilter}
              />
            </Col>
            <Col span={24}>
              <DescriptionInsight
                chartFilter={chartFilter}
                dataInsightChartName={
                  DataInsightChartType.PercentageOfEntitiesWithDescriptionByType
                }
                header={t('label.data-insight-description-summary-type', {
                  type: t('label.data-asset'),
                })}
                kpi={descriptionKpi}
                selectedDays={selectedDaysFilter}
              />
            </Col>
            <Col span={24}>
              <OwnerInsight
                chartFilter={chartFilter}
                dataInsightChartName={
                  DataInsightChartType.PercentageOfEntitiesWithOwnerByType
                }
                header={t('label.data-insight-owner-summary-type', {
                  type: t('label.data-asset'),
                })}
                kpi={ownerKpi}
                selectedDays={selectedDaysFilter}
              />
            </Col>
            <Col span={24}>
              <DescriptionInsight
                chartFilter={chartFilter}
                dataInsightChartName={
                  DataInsightChartType.PercentageOfServicesWithDescription
                }
                header={t('label.data-insight-description-summary-type', {
                  type: t('label.service'),
                })}
                kpi={descriptionKpi}
                selectedDays={selectedDaysFilter}
              />
            </Col>
            <Col span={24}>
              <OwnerInsight
                chartFilter={chartFilter}
                dataInsightChartName={
                  DataInsightChartType.PercentageOfServicesWithOwner
                }
                header={t('label.data-insight-owner-summary-type', {
                  type: t('label.service'),
                })}
                kpi={ownerKpi}
                selectedDays={selectedDaysFilter}
              />
            </Col>
            <Col span={24}>
              <TierInsight
                chartFilter={chartFilter}
                selectedDays={selectedDaysFilter}
                tierTags={tier}
              />
            </Col>
          </>
        )}
        {activeTab === DataInsightTabs.APP_ANALYTICS && (
          <>
            <Col span={24}>
              <TopViewEntities chartFilter={chartFilter} />
            </Col>
            <Col span={24}>
              <PageViewsByEntitiesChart
                chartFilter={chartFilter}
                selectedDays={selectedDaysFilter}
              />
            </Col>
            <Col span={24}>
              <DailyActiveUsersChart
                chartFilter={chartFilter}
                selectedDays={selectedDaysFilter}
              />
            </Col>
            <Col span={24}>
              <TopActiveUsers chartFilter={chartFilter} />
            </Col>
          </>
        )}

        {activeTab === DataInsightTabs.KPIS && (
          <KPIList viewKPIPermission={viewKPIPermission} />
        )}
      </Row>
    );
  };

  return (
    <PageLayoutV1
      leftPanel={<DataInsightLeftPanel />}
      pageTitle={t('label.data-insight')}>
      {getTabContent()}
    </PageLayoutV1>
  );
};

export default DataInsightPage;
