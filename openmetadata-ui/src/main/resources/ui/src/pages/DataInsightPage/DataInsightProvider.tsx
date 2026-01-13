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
import { isEmpty, isEqual, uniqBy } from 'lodash';
import { DateRangeObject } from 'Models';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Loader from '../../components/common/Loader/Loader';
import { SearchDropdownOption } from '../../components/SearchDropdown/SearchDropdown.interface';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { PAGE_SIZE_BASE } from '../../constants/constants';
import { INITIAL_CHART_FILTER } from '../../constants/DataInsight.constants';
import {
  DEFAULT_RANGE_DATA,
  DEFAULT_SELECTED_RANGE,
} from '../../constants/profiler.constant';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SystemChartType } from '../../enums/DataInsight.enum';
import { TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { Tag } from '../../generated/entity/classification/tag';
import { ChartFilter } from '../../interface/data-insight.interface';
import { DataInsightCustomChartResult } from '../../rest/DataInsightAPI';
import { getListKPIs } from '../../rest/KpiAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getTags } from '../../rest/tagAPI';
import advancedSearchClassBase from '../../utils/AdvancedSearchClassBase';
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
const fetchTeamSuggestions = advancedSearchClassBase.autocomplete({
  searchIndex: SearchIndex.TEAM,
  entityField: EntityFields.DISPLAY_NAME_KEYWORD,
});

const DataInsightProvider = ({ children }: DataInsightProviderProps) => {
  const [teamsOptions, setTeamsOptions] = useState<TeamStateType>({
    defaultOptions: [],
    selectedOptions: [],
    options: [],
  });
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  const [tierOptions, setTierOptions] = useState<TierStateType>({
    selectedOptions: [],
    options: [],
  });
  const [entitiesChartsSummary, setEntitiesChartsSummary] = useState<
    Record<SystemChartType, DataInsightCustomChartResult>
  >({} as Record<SystemChartType, DataInsightCustomChartResult>);

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
      tier: tiers.length ? tiers.map((tier) => tier.key) : undefined,
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
    setTeamsOptions((prev) => ({
      ...prev,
      selectedOptions: teams,
    }));
    setChartFilter((previous) => ({
      ...previous,
      team: teams.length ? teams.map((team) => team.key) : undefined,
    }));
  };

  const fetchTeamOptions = async (query = WILD_CARD_CHAR) => {
    const response = await searchQuery({
      searchIndex: SearchIndex.TEAM,
      query: query,
      pageSize: PAGE_SIZE_BASE,
    });
    const hits = response.hits.hits;
    const teamFilterOptions = hits.map((hit) => {
      const source = hit._source;

      return {
        key: source.name,
        label: getEntityName(source),
      };
    });

    return teamFilterOptions;
  };

  const handleTeamSearch = async (query: string) => {
    if (fetchTeamSuggestions && !isEmpty(query)) {
      setIsTeamLoading(true);
      try {
        const response = await fetchTeamOptions(query);
        setTeamsOptions((prev) => ({
          ...prev,
          options: response,
        }));
      } catch (_error) {
        // we will not show the toast error message for suggestion API
      } finally {
        setIsTeamLoading(false);
      }
    } else {
      setTeamsOptions((prev) => ({
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
      setTeamsOptions((prev) => ({
        ...prev,
        options: [...prev.selectedOptions, ...prev.defaultOptions],
      }));

      return;
    }

    try {
      setIsTeamLoading(true);
      const response = await fetchTeamOptions();
      setTeamsOptions((prev) => ({
        ...prev,
        defaultOptions: response,
        options: response,
      }));
    } catch (_error) {
      // we will not show the toast error message for search API
    } finally {
      setIsTeamLoading(false);
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
      const response = await getListKPIs({
        fields: TabSpecificField.DATA_INSIGHT_CHART,
      });
      setKpiList(response.data);
    } catch (_err) {
      setKpiList([]);
    } finally {
      setIsKpiLoading(false);
    }
  };

  const kpi = useMemo(() => {
    return {
      isLoading: isKpiLoading,
      data: kpiList,
    };
  }, [isKpiLoading, kpiList]);

  const dataInsightHeaderProps = useMemo(
    () => ({
      chartFilter: chartFilter,
      selectedDaysFilter,
      onChartFilterChange: handleDateRangeChange,
      kpi: kpi,
      teamFilter: {
        options: uniqBy(teamsOptions.options, 'key'),
        selectedKeys: teamsOptions.selectedOptions,
        onChange: handleTeamChange,
        onGetInitialOptions: fetchDefaultTeamOptions,
        onSearch: handleTeamSearch,
        isSuggestionsLoading: isTeamLoading,
      },
      tierFilter: {
        options: tierOptions.options,
        selectedKeys: tierOptions.selectedOptions,
        onChange: handleTierChange,
        onGetInitialOptions: fetchDefaultTierOptions,
        onSearch: handleTierSearch,
      },
      tierTag: tier,
      entitiesSummary: entitiesChartsSummary,
      updateEntitySummary: setEntitiesChartsSummary,
    }),
    [
      handleTeamSearch,
      chartFilter,
      kpi,
      handleDateRangeChange,
      handleTierSearch,
      fetchDefaultTierOptions,
      handleTierChange,
      tierOptions,
      fetchDefaultTeamOptions,
      handleTeamChange,
      teamsOptions,
      isTeamLoading,
      entitiesChartsSummary,
      setEntitiesChartsSummary,
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
