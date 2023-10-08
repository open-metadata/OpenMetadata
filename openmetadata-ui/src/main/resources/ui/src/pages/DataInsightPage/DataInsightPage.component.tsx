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

import { Col, Row } from 'antd';
import { t } from 'i18next';
import { isEmpty, isEqual } from 'lodash';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ListItem } from 'react-awesome-query-builder';
import {
  Redirect,
  Route,
  Switch,
  useHistory,
  useParams,
} from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import AppAnalyticsTab from '../../components/DataInsightDetail/AppAnalyticsTab/AppAnalyticsTab.component';
import DataAssetsTab from '../../components/DataInsightDetail/DataAssetsTab/DataAssetsTab.component';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../components/PermissionProvider/PermissionProvider.interface';
import { DateRangeObject } from '../../components/ProfilerDashboard/component/TestSummary';
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
import { getEntityName } from '../../utils/EntityUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { TeamStateType, TierStateType } from './DataInsight.interface';
import './DataInsight.less';
import DataInsightHeader from './DataInsightHeader/DataInsightHeader.component';
import DataInsightLeftPanel from './DataInsightLeftPanel/DataInsightLeftPanel';
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
  const isHeaderVisible = useMemo(
    () =>
      [
        DataInsightTabs.DATA_ASSETS,
        DataInsightTabs.KPIS,
        DataInsightTabs.APP_ANALYTICS,
      ].includes(tab),
    [tab]
  );

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

  const [teamsOptions, setTeamOptions] = useState<TeamStateType>({
    defaultOptions: [],
    selectedOptions: [],
    options: [],
  });
  const [tierOptions, setTierOptions] = useState<TierStateType>({
    selectedOptions: [],
    options: [],
  });

  const [chartFilter, setChartFilter] =
    useState<ChartFilter>(INITIAL_CHART_FILTER);
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const [isKpiLoading, setIsKpiLoading] = useState(true);
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

  const dataInsightHeaderProps = useMemo(
    () => ({
      chartFilter: chartFilter,
      onChartFilterChange: handleDateRangeChange,
      kpi: {
        isLoading: isKpiLoading,
        data: kpiList,
      },
      team: {
        options: teamsOptions.options,
        selectedKeys: teamsOptions.selectedOptions,
        onChange: handleTeamChange,
        onGetInitialOptions: fetchDefaultTeamOptions,
        onSearch: handleTeamSearch,
      },
      tier: {
        options: tierOptions.options,
        selectedKeys: tierOptions.selectedOptions,
        onChange: handleTierChange,
        onGetInitialOptions: fetchDefaultTierOptions,
        onSearch: handleTierSearch,
      },
    }),
    [
      handleTeamSearch,
      chartFilter,
      isKpiLoading,
      kpiList,
      handleDateRangeChange,
      handleTierSearch,
      fetchDefaultTierOptions,
      handleTierChange,
      tierOptions,
      fetchDefaultTeamOptions,
      handleTeamChange,
      teamsOptions,
    ]
  );

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
    setChartFilter(INITIAL_CHART_FILTER);
  }, []);

  const { noDataInsightPermission, noKPIPermission, dataInsightTabs } =
    useMemo(() => {
      const data = {
        noDataInsightPermission:
          !viewDataInsightChartPermission &&
          (tab === DataInsightTabs.APP_ANALYTICS ||
            tab === DataInsightTabs.DATA_ASSETS),
        noKPIPermission: !viewKPIPermission && tab === DataInsightTabs.KPIS,
        dataInsightTabs: [
          {
            key: DataInsightTabs.DATA_ASSETS,
            path: getDataInsightPathWithFqn(DataInsightTabs.DATA_ASSETS),
            component: (
              <DataAssetsTab
                chartFilter={chartFilter}
                kpiList={kpiList}
                selectedDaysFilter={selectedDaysFilter}
                tier={tier}
              />
            ),
          },
          {
            key: DataInsightTabs.APP_ANALYTICS,
            path: getDataInsightPathWithFqn(DataInsightTabs.APP_ANALYTICS),
            component: (
              <AppAnalyticsTab
                chartFilter={chartFilter}
                selectedDaysFilter={selectedDaysFilter}
              />
            ),
          },
          {
            key: DataInsightTabs.KPIS,
            path: getDataInsightPathWithFqn(DataInsightTabs.KPIS),
            component: <KPIList viewKPIPermission={viewKPIPermission} />,
          },
        ],
      };

      return data;
    }, [
      viewDataInsightChartPermission,
      viewKPIPermission,
      tab,
      selectedDaysFilter,
      chartFilter,
      kpiList,
      tier,
    ]);

  if (!viewDataInsightChartPermission && !viewKPIPermission) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

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
    <PageLayoutV1
      leftPanel={<DataInsightLeftPanel />}
      pageTitle={t('label.data-insight')}>
      <Row
        className="page-container"
        data-testid="data-insight-container"
        gutter={[16, 16]}>
        {isHeaderVisible && (
          <Col span={24}>
            <DataInsightHeader
              {...dataInsightHeaderProps}
              onScrollToChart={handleScrollToChart}
            />
          </Col>
        )}
        <Col span={24}>
          <Switch>
            {dataInsightTabs.map((tab) => (
              <Route exact key={tab.key} path={tab.path}>
                {tab.component}
              </Route>
            ))}

            <Route exact path={ROUTES.DATA_INSIGHT}>
              <Redirect to={getDataInsightPathWithFqn()} />
            </Route>
          </Switch>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default DataInsightPage;
