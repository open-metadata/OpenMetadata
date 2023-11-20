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
import { isEmpty, isEqual } from 'lodash';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ListItem } from 'react-awesome-query-builder';
import Loader from '../../components/Loader/Loader';
import { DateRangeObject } from '../../components/ProfilerDashboard/component/TestSummary';
import { SearchDropdownOption } from '../../components/SearchDropdown/SearchDropdown.interface';
import { autocomplete } from '../../constants/AdvancedSearch.constants';
import { PAGE_SIZE } from '../../constants/constants';
import { INITIAL_CHART_FILTER } from '../../constants/DataInsight.constants';
import {
  DEFAULT_RANGE_DATA,
  DEFAULT_SELECTED_RANGE,
} from '../../constants/profiler.constant';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { Tag } from '../../generated/entity/classification/tag';
import { ChartFilter } from '../../interface/data-insight.interface';
import { getListKPIs } from '../../rest/KpiAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getTags } from '../../rest/tagAPI';
import { getTeamFilter } from '../../utils/DataInsightUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  DataInsightContextType,
  DataInsightProviderProps,
  TeamStateType,
  TierStateType,
} from './DataInsight.interface';

export const DataInsightContext = createContext<DataInsightContextType>(
  {} as DataInsightContextType
);
const fetchTeamSuggestions = autocomplete({
  searchIndex: SearchIndex.TEAM,
  entityField: EntityFields.OWNER,
});

const DataInsightProvider = ({ children }: DataInsightProviderProps) => {
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

  const dataInsightHeaderProps = useMemo(
    () => ({
      chartFilter: chartFilter,
      selectedDaysFilter,
      onChartFilterChange: handleDateRangeChange,
      kpi: {
        isLoading: isKpiLoading,
        data: kpiList,
      },
      teamFilter: {
        options: teamsOptions.options,
        selectedKeys: teamsOptions.selectedOptions,
        onChange: handleTeamChange,
        onGetInitialOptions: fetchDefaultTeamOptions,
        onSearch: handleTeamSearch,
      },
      tierFilter: {
        options: tierOptions.options,
        selectedKeys: tierOptions.selectedOptions,
        onChange: handleTierChange,
        onGetInitialOptions: fetchDefaultTierOptions,
        onSearch: handleTierSearch,
      },
      tierTag: tier,
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

  useEffect(() => {
    getTierTag();
    fetchDefaultTeamOptions();
    fetchKpiList();
    setChartFilter(INITIAL_CHART_FILTER);
  }, []);

  return (
    <DataInsightContext.Provider value={dataInsightHeaderProps}>
      {isKpiLoading ? <Loader /> : children}
    </DataInsightContext.Provider>
  );
};

export const useDataInsightProvider = () => useContext(DataInsightContext);

export default DataInsightProvider;
