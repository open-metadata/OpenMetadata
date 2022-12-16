/*
 *  Copyright 2021 Collate
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
  Button,
  Card,
  Col,
  Row,
  Select,
  SelectProps,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { t } from 'i18next';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { getListKPIs } from '../../axiosAPIs/KpiAPI';
import { searchQuery } from '../../axiosAPIs/searchAPI';
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
import { autocomplete } from '../../constants/AdvancedSearch.constants';
import { ROUTES } from '../../constants/constants';
import {
  DAY_FILTER,
  DEFAULT_DAYS,
  ENTITIES_CHARTS,
  INITIAL_CHART_FILTER,
  TIER_FILTER,
} from '../../constants/DataInsight.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { SearchIndex } from '../../enums/search.enum';
import { DataInsightChartType } from '../../generated/dataInsight/dataInsightChartResult';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { useAuth } from '../../hooks/authHooks';
import {
  ChartFilter,
  DataInsightTabs,
} from '../../interface/data-insight.interface';
import {
  getDataInsightPathWithFqn,
  getTeamFilter,
} from '../../utils/DataInsightUtils';
import {
  getCurrentDateTimeMillis,
  getFormattedDateFromMilliSeconds,
  getPastDaysDateTimeMillis,
} from '../../utils/TimeUtils';
import './DataInsight.less';
import DataInsightLeftPanel from './DataInsightLeftPanel';
import KPIList from './KPIList';

const fetchTeamSuggestions = autocomplete(SearchIndex.TEAM);

const DataInsightPage = () => {
  const { tab } = useParams<{ tab: DataInsightTabs }>();

  const { isAdminUser } = useAuth();
  const history = useHistory();

  const [teamsOptions, setTeamOptions] = useState<SelectProps['options']>([]);
  const [activeTab, setActiveTab] = useState(DataInsightTabs.DATA_ASSETS);
  const [chartFilter, setChartFilter] =
    useState<ChartFilter>(INITIAL_CHART_FILTER);
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);

  const [selectedChart, setSelectedChart] = useState<DataInsightChartType>();

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

  const handleTierChange = (tiers: string[] = []) => {
    setChartFilter((previous) => ({
      ...previous,
      tier: tiers.length ? tiers.join(',') : undefined,
    }));
  };

  const handleDaysChange = (days: number) => {
    setChartFilter((previous) => ({
      ...previous,
      startTs: getPastDaysDateTimeMillis(days),
      endTs: getCurrentDateTimeMillis(),
    }));
  };

  const handleTeamChange = (teams: string[] = []) => {
    setChartFilter((previous) => ({
      ...previous,
      team: teams.length ? teams.join(',') : undefined,
    }));
  };

  const handleTeamSearch = async (query: string) => {
    if (fetchTeamSuggestions) {
      try {
        const response = await fetchTeamSuggestions(query, 5);
        setTeamOptions(getTeamFilter(response.values));
      } catch (_error) {
        // we will not show the toast error message for suggestion API
      }
    }
  };

  const fetchDefaultTeamOptions = async () => {
    try {
      const response = await searchQuery({
        searchIndex: SearchIndex.TEAM,
        query: '*',
        pageSize: 5,
      });
      const hits = response.hits.hits;
      const teamFilterOptions = hits.map((hit) => {
        const source = hit._source;

        return {
          label: source.displayName || source.name,
          value: source.fullyQualifiedName || source.name,
        };
      });
      setTeamOptions(teamFilterOptions);
    } catch (_error) {
      // we will not show the toast error message for search API
    }
  };

  const fetchKpiList = async () => {
    try {
      const response = await getListKPIs({ fields: 'dataInsightChart' });
      setKpiList(response.data);
    } catch (_err) {
      setKpiList([]);
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
    fetchDefaultTeamOptions();
    fetchKpiList();
  }, []);

  useEffect(() => {
    setChartFilter(INITIAL_CHART_FILTER);
  }, []);

  useEffect(() => {
    setActiveTab(tab ?? DataInsightTabs.DATA_ASSETS);
  }, [tab]);

  return (
    <PageLayoutV1 leftPanel={<DataInsightLeftPanel />}>
      <Row data-testid="data-insight-container" gutter={[16, 16]}>
        <Col span={24}>
          <Space className="w-full justify-between">
            <div data-testid="data-insight-header">
              <Typography.Title level={5}>
                {t('label.data-insight-plural')}
              </Typography.Title>
              <Typography.Text className="data-insight-label-text">
                {t('label.data-insight-subtitle')}
              </Typography.Text>
            </div>
            <Tooltip
              title={
                isAdminUser ? t('label.add-kpi') : NO_PERMISSION_FOR_ACTION
              }>
              <Button
                disabled={!isAdminUser}
                type="primary"
                onClick={handleAddKPI}>
                {t('label.add-kpi')}
              </Button>
            </Tooltip>
          </Space>
        </Col>
        <Col span={24}>
          <Card>
            <Space className="w-full justify-between">
              <Space className="w-full">
                <Select
                  allowClear
                  showArrow
                  className="data-insight-select-dropdown"
                  mode="multiple"
                  notFoundContent={null}
                  options={teamsOptions}
                  placeholder={t('label.select-teams')}
                  onChange={handleTeamChange}
                  onSearch={handleTeamSearch}
                />
                <Select
                  allowClear
                  showArrow
                  className="data-insight-select-dropdown"
                  mode="multiple"
                  notFoundContent={null}
                  options={TIER_FILTER}
                  placeholder={t('label.select-tiers')}
                  onChange={handleTierChange}
                />
              </Space>
              <Space>
                <Typography className="data-insight-label-text text-xs">
                  {getFormattedDateFromMilliSeconds(
                    chartFilter.startTs,
                    'dd MMM yyyy'
                  )}{' '}
                  -{' '}
                  {getFormattedDateFromMilliSeconds(
                    chartFilter.endTs,
                    'dd MMM yyyy'
                  )}
                </Typography>
                <Select
                  className="data-insight-select-dropdown"
                  defaultValue={DEFAULT_DAYS}
                  options={DAY_FILTER}
                  onChange={handleDaysChange}
                />
              </Space>
            </Space>
          </Card>
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
            <KPIChart chartFilter={chartFilter} kpiList={kpiList} />
          </Col>
        )}
        {activeTab === DataInsightTabs.DATA_ASSETS && (
          <>
            <Col span={24}>
              <TotalEntityInsight chartFilter={chartFilter} />
            </Col>
            <Col span={24}>
              <DescriptionInsight
                chartFilter={chartFilter}
                kpi={descriptionKpi}
              />
            </Col>
            <Col span={24}>
              <OwnerInsight chartFilter={chartFilter} kpi={ownerKpi} />
            </Col>
            <Col span={24}>
              <TierInsight chartFilter={chartFilter} />
            </Col>
          </>
        )}
        {activeTab === DataInsightTabs.APP_ANALYTICS && (
          <>
            <Col span={24}>
              <TopViewEntities chartFilter={chartFilter} />
            </Col>
            <Col span={24}>
              <PageViewsByEntitiesChart chartFilter={chartFilter} />
            </Col>
            <Col span={24}>
              <DailyActiveUsersChart chartFilter={chartFilter} />
            </Col>
            <Col span={24}>
              <TopActiveUsers chartFilter={chartFilter} />
            </Col>
          </>
        )}

        {activeTab === DataInsightTabs.KPIS && <KPIList />}
      </Row>
    </PageLayoutV1>
  );
};

export default DataInsightPage;
