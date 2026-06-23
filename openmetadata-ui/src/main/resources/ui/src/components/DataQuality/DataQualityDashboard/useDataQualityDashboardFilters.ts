/*
 *  Copyright 2026 Collate.
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
import { isEmpty, isEqual, omit, uniqBy } from 'lodash';
import { DateRangeObject } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchDropdownOption } from '../../../components/SearchDropdown/SearchDropdown.interface';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE_BASE } from '../../../constants/constants';
import { DQ_FILTER_KEYS } from '../../../constants/DataQuality.constants';
import { PROFILER_FILTER_RANGE } from '../../../constants/profiler.constant';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { searchQuery } from '../../../rest/searchAPI';
import {
  getCurrentMillis,
  getEndOfDayInMillis,
  getEpochMillisForPastDays,
  getStartOfDayInMillis,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { DqDashboardChartFilters } from './DataQualityDashboard.interface';

export type DqHiddenFilter =
  | 'owner'
  | 'tier'
  | 'certification'
  | 'tags'
  | 'glossaryTerms'
  | 'dataProducts';

export type DqSearchFilterKey =
  | 'tier'
  | 'certification'
  | 'tag'
  | 'glossaryTerm'
  | 'dataProduct';

/**
 * Props shared with the OSS `SearchDropdown` and the AI filter renderer.
 * Both consume the same handlers so behavior stays identical across modes.
 */
export interface DqSearchFilterProps {
  options: SearchDropdownOption[];
  selectedKeys: SearchDropdownOption[];
  onChange: (options: SearchDropdownOption[]) => void;
  onGetInitialOptions: () => void;
  onSearch: (query: string) => void;
  isSuggestionsLoading: boolean;
}

export interface DqOwnerKey {
  key: string;
  label: string;
}

/**
 * Normalized, render-agnostic description of a single dashboard filter. The
 * hook emits an ordered, visibility-filtered list of these so every renderer
 * (OSS antd + AI core-components) draws the same set of filters. Adding a new
 * filter here makes it appear in BOTH modes automatically; the discriminated
 * `type` forces each renderer's exhaustive switch to handle it.
 */
export type DqFilterDescriptor =
  | {
      key: 'owner';
      type: 'owner';
      label: string;
      selectedOwners?: EntityReference[];
      selectedOwnerKeys: DqOwnerKey[];
      onChange: (owners?: EntityReference[]) => void;
    }
  | {
      key: DqSearchFilterKey;
      type: 'search';
      label: string;
      /** The `searchKey` the OSS SearchDropdown expects (also used as test id). */
      searchKey: string;
      searchProps: DqSearchFilterProps;
    };

export interface UseDataQualityDashboardFiltersProps {
  initialFilters?: DqDashboardChartFilters;
  hideFilterBar?: boolean;
  hiddenFilters?: DqHiddenFilter[];
}

interface OptionState {
  defaultOptions: SearchDropdownOption[];
  options: SearchDropdownOption[];
}

const EMPTY_OPTION_STATE: OptionState = { defaultOptions: [], options: [] };

export interface UseDataQualityDashboardFiltersReturn {
  chartFilter: DqDashboardChartFilters;
  defaultFilters: DqDashboardChartFilters;
  pieChartFilters: DqDashboardChartFilters;
  defaultRange: DateRangeObject;
  dateRange: { startTs?: number; endTs?: number };
  onDateRangeChange: (value: DateRangeObject) => void;
  filters: DqFilterDescriptor[];
  showFilterBar: boolean;
  hasVisibleFilters: boolean;
  /** True when any entity filter (owner/tier/tag/…) currently has a selection. */
  hasActiveFilters: boolean;
  /** Clears every entity filter selection at once, preserving the date range. */
  clearAll: () => void;
}

export const useDataQualityDashboardFilters = ({
  initialFilters,
  hideFilterBar = false,
  hiddenFilters = [],
}: UseDataQualityDashboardFiltersProps): UseDataQualityDashboardFiltersReturn => {
  const { t } = useTranslation();

  const DEFAULT_RANGE_DATA = useMemo<DateRangeObject>(() => {
    return {
      startTs: getStartOfDayInMillis(
        getEpochMillisForPastDays(PROFILER_FILTER_RANGE.last30days.days)
      ),
      endTs: getEndOfDayInMillis(getCurrentMillis()),
      key: 'last30days',
    };
  }, []);

  const [glossaryTermOptions, setGlossaryTermOptions] =
    useState<OptionState>(EMPTY_OPTION_STATE);
  const [isGlossaryTermLoading, setIsGlossaryTermLoading] = useState(false);
  const [tagOptions, setTagOptions] = useState<OptionState>(EMPTY_OPTION_STATE);
  const [isTagLoading, setIsTagLoading] = useState(false);
  const [dataProductOptions, setDataProductOptions] =
    useState<OptionState>(EMPTY_OPTION_STATE);
  const [isDataProductLoading, setIsDataProductLoading] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<
    SearchDropdownOption[]
  >([]);
  const [selectedDataProductFilter, setSelectedDataProductFilter] = useState<
    SearchDropdownOption[]
  >([]);
  const [selectedGlossaryTermFilter, setSelectedGlossaryTermFilter] = useState<
    SearchDropdownOption[]
  >([]);
  const [selectedTierFilter, setSelectedTierFilter] = useState<
    SearchDropdownOption[]
  >([]);
  const [selectedCertificationFilter, setSelectedCertificationFilter] =
    useState<SearchDropdownOption[]>([]);
  const [certificationOptions, setCertificationOptions] =
    useState<OptionState>(EMPTY_OPTION_STATE);
  const [isCertificationLoading, setIsCertificationLoading] = useState(false);
  const [selectedOwnerFilter, setSelectedOwnerFilter] =
    useState<EntityReference[]>();
  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);
  const [tierOptions, setTierOptions] =
    useState<OptionState>(EMPTY_OPTION_STATE);
  const [isTierLoading, setIsTierLoading] = useState(false);
  const [chartFilter, setChartFilter] = useState<DqDashboardChartFilters>({
    startTs: DEFAULT_RANGE_DATA.startTs,
    endTs: DEFAULT_RANGE_DATA.endTs,
    ...initialFilters,
  });

  const defaultFilters = useMemo(() => {
    const tags = [
      ...(chartFilter.tags ?? []),
      ...(chartFilter.glossaryTerms ?? []),
    ];

    return {
      ...omit(chartFilter, 'glossaryTerms'),
      tags: isEmpty(tags) ? undefined : tags,
    };
  }, [chartFilter]);

  const pieChartFilters = useMemo(() => {
    return {
      ownerFqn: defaultFilters.ownerFqn,
      tags: defaultFilters.tags,
      tier: defaultFilters.tier,
      certification: defaultFilters.certification,
      dataProductFqns: defaultFilters.dataProductFqns,
      startTs: defaultFilters.startTs,
      endTs: defaultFilters.endTs,
      domainFqn: defaultFilters.domainFqn,
    };
  }, [
    defaultFilters.ownerFqn,
    defaultFilters.tier,
    defaultFilters.certification,
    defaultFilters.tags,
    defaultFilters.dataProductFqns,
    defaultFilters.startTs,
    defaultFilters.endTs,
    defaultFilters.domainFqn,
  ]);

  const selectedOwnerKeys = useMemo<DqOwnerKey[]>(() => {
    return (
      selectedOwnerFilter?.map((owner) => ({
        key: owner.id,
        label: getEntityName(owner),
      })) ?? []
    );
  }, [selectedOwnerFilter]);

  const handleTierChange = (tiers: SearchDropdownOption[] = []) => {
    setSelectedTierFilter(tiers);
    setChartFilter((prev) => ({
      ...prev,
      tier: tiers.map((tag) => tag.key),
    }));
  };

  const handleCertificationChange = (
    certifications: SearchDropdownOption[] = []
  ) => {
    setSelectedCertificationFilter(certifications);
    setChartFilter((prev) => ({
      ...prev,
      certification: certifications.map((tag) => tag.key),
    }));
  };

  const handleDateRangeChange = (value: DateRangeObject) => {
    if (!isEqual(value, dateRangeObject)) {
      const dateRange = {
        startTs: getStartOfDayInMillis(value.startTs),
        endTs: getEndOfDayInMillis(value.endTs),
      };
      setDateRangeObject(dateRange);

      setChartFilter((prev) => ({
        ...prev,
        ...dateRange,
      }));
    }
  };

  const handleTagChange = (tags: SearchDropdownOption[] = []) => {
    setSelectedTagFilter(tags);
    setChartFilter((prev) => ({
      ...prev,
      tags: tags.map((tag) => tag.key),
    }));
  };

  const handleDataProductChange = (
    dataProducts: SearchDropdownOption[] = []
  ) => {
    setSelectedDataProductFilter(dataProducts);
    setChartFilter((prev) => ({
      ...prev,
      dataProductFqns: dataProducts.map((dp) => dp.key),
    }));
  };

  const fetchTagOptions = async (query = WILD_CARD_CHAR) => {
    const response = await searchQuery({
      searchIndex: SearchIndex.TAG,
      query: query === WILD_CARD_CHAR ? query : `*${query}*`,
      filters:
        'disabled:false AND !classification.name:Tier AND !classification.name:Certification',
      pageSize: PAGE_SIZE_BASE,
    });
    const hits = response.hits.hits;
    const tagFilterOptions = hits.map((hit) => {
      const source = hit._source;

      return {
        key: source.fullyQualifiedName ?? source.name,
        label: `${source.classification?.name}.${source.name}`,
      };
    });

    return tagFilterOptions;
  };

  const fetchDataProductOptions = async (query = WILD_CARD_CHAR) => {
    const response = await searchQuery({
      searchIndex: SearchIndex.DATA_PRODUCT,
      query: query === WILD_CARD_CHAR ? query : `*${query}*`,
      pageSize: PAGE_SIZE_BASE,
    });
    const hits = response.hits.hits;
    const dataProductFilterOptions = hits.map((hit) => {
      const source = hit._source;

      return {
        key: source.fullyQualifiedName ?? source.name,
        label: source.displayName ?? source.fullyQualifiedName ?? source.name,
      };
    });

    return dataProductFilterOptions;
  };

  const handleTagSearch = async (query: string) => {
    if (isEmpty(query)) {
      setTagOptions((prev) => ({
        ...prev,
        options: prev.defaultOptions,
      }));
    } else {
      setIsTagLoading(true);
      try {
        const response = await fetchTagOptions(query);
        setTagOptions((prev) => ({
          ...prev,
          options: response,
        }));
      } catch {
        // we will not show the toast error message for suggestion API
      } finally {
        setIsTagLoading(false);
      }
    }
  };

  const handleGlossaryTermChange = (
    glossaryTerms: SearchDropdownOption[] = []
  ) => {
    setSelectedGlossaryTermFilter(glossaryTerms);
    setChartFilter((prev) => ({
      ...prev,
      glossaryTerms: glossaryTerms.map((term) => term.key),
    }));
  };

  const fetchGlossaryTermOptions = async (query = WILD_CARD_CHAR) => {
    const response = await searchQuery({
      searchIndex: SearchIndex.GLOSSARY_TERM,
      query: query === WILD_CARD_CHAR ? query : `*${query}*`,
      pageSize: PAGE_SIZE_BASE,
    });
    const hits = response.hits.hits;
    const glossaryTermFilterOptions = hits.map((hit) => {
      const source = hit._source;

      return {
        key: source.fullyQualifiedName ?? source.name,
        label: source.fullyQualifiedName ?? source.name,
      };
    });

    return glossaryTermFilterOptions;
  };

  const handleGlossaryTermSearch = async (query: string) => {
    if (isEmpty(query)) {
      setGlossaryTermOptions((prev) => ({
        ...prev,
        options: prev.defaultOptions,
      }));
    } else {
      setIsGlossaryTermLoading(true);
      try {
        const response = await fetchGlossaryTermOptions(query);
        setGlossaryTermOptions((prev) => ({
          ...prev,
          options: response,
        }));
      } catch {
        // we will not show the toast error message for suggestion API
      } finally {
        setIsGlossaryTermLoading(false);
      }
    }
  };

  const fetchTierOptions = async (query = WILD_CARD_CHAR) => {
    const response = await searchQuery({
      searchIndex: SearchIndex.TAG,
      query: query === WILD_CARD_CHAR ? query : `*${query}*`,
      filters: 'disabled:false AND classification.name:Tier',
      pageSize: PAGE_SIZE_BASE,
    });
    const hits = response.hits.hits;
    const tierFilterOptions = hits.map((hit) => {
      const source = hit._source;

      return {
        key: source.fullyQualifiedName ?? source.name,
        label: getEntityName(source),
      };
    });

    return tierFilterOptions;
  };

  const handleTierSearch = async (query: string) => {
    if (isEmpty(query)) {
      setTierOptions((prev) => ({
        ...prev,
        options: [...selectedTierFilter, ...prev.defaultOptions],
      }));
    } else {
      setIsTierLoading(true);
      try {
        const response = await fetchTierOptions(query);
        setTierOptions((prev) => ({
          ...prev,
          options: response,
        }));
      } catch {
        // we will not show the toast error message for suggestion API
      } finally {
        setIsTierLoading(false);
      }
    }
  };

  const fetchCertificationOptions = async (query = WILD_CARD_CHAR) => {
    const response = await searchQuery({
      searchIndex: SearchIndex.TAG,
      query: query === WILD_CARD_CHAR ? query : `*${query}*`,
      filters: 'disabled:false AND classification.name:Certification',
      pageSize: PAGE_SIZE_BASE,
    });
    const hits = response.hits.hits;
    const certificationFilterOptions = hits.map((hit) => {
      const source = hit._source;

      return {
        key: source.fullyQualifiedName ?? source.name,
        label: getEntityName(source),
      };
    });

    return certificationFilterOptions;
  };

  const handleCertificationSearch = async (query: string) => {
    if (isEmpty(query)) {
      setCertificationOptions((prev) => ({
        ...prev,
        options: [...selectedCertificationFilter, ...prev.defaultOptions],
      }));
    } else {
      setIsCertificationLoading(true);
      try {
        const response = await fetchCertificationOptions(query);
        setCertificationOptions((prev) => ({
          ...prev,
          options: response,
        }));
      } catch {
        // we will not show the toast error message for suggestion API
      } finally {
        setIsCertificationLoading(false);
      }
    }
  };

  const fetchDefaultTagOptions = async () => {
    if (tagOptions.defaultOptions.length) {
      setTagOptions((prev) => ({
        ...prev,
        options: [...selectedTagFilter, ...prev.defaultOptions],
      }));

      return;
    }

    try {
      setIsTagLoading(true);
      const response = await fetchTagOptions();
      setTagOptions((prev) => ({
        ...prev,
        defaultOptions: response,
        options: response,
      }));
    } catch {
      // we will not show the toast error message for search API
    } finally {
      setIsTagLoading(false);
    }
  };

  const handleDataProductSearch = async (query: string) => {
    if (isEmpty(query)) {
      setDataProductOptions((prev) => ({
        ...prev,
        options: prev.defaultOptions,
      }));
    } else {
      setIsDataProductLoading(true);
      try {
        const response = await fetchDataProductOptions(query);
        setDataProductOptions((prev) => ({
          ...prev,
          options: response,
        }));
      } catch {
        // we will not show the toast error message for suggestion API
      } finally {
        setIsDataProductLoading(false);
      }
    }
  };

  const fetchDefaultGlossaryTermOptions = async () => {
    if (glossaryTermOptions.defaultOptions.length) {
      setGlossaryTermOptions((prev) => ({
        ...prev,
        options: [...selectedGlossaryTermFilter, ...prev.defaultOptions],
      }));

      return;
    }

    try {
      setIsGlossaryTermLoading(true);
      const response = await fetchGlossaryTermOptions();
      setGlossaryTermOptions((prev) => ({
        ...prev,
        defaultOptions: response,
        options: response,
      }));
    } catch {
      // we will not show the toast error message for search API
    } finally {
      setIsGlossaryTermLoading(false);
    }
  };

  const fetchDefaultDataProductOptions = async () => {
    if (dataProductOptions.defaultOptions.length) {
      setDataProductOptions((prev) => ({
        ...prev,
        options: [...selectedDataProductFilter, ...prev.defaultOptions],
      }));

      return;
    }

    try {
      setIsDataProductLoading(true);
      const response = await fetchDataProductOptions();
      setDataProductOptions((prev) => ({
        ...prev,
        defaultOptions: response,
        options: response,
      }));
    } catch {
      // we will not show the toast error message for search API
    } finally {
      setIsDataProductLoading(false);
    }
  };

  const fetchDefaultTierOptions = async () => {
    if (tierOptions.defaultOptions.length) {
      setTierOptions((prev) => ({
        ...prev,
        options: [...selectedTierFilter, ...prev.defaultOptions],
      }));

      return;
    }

    try {
      setIsTierLoading(true);
      const response = await fetchTierOptions();
      setTierOptions((prev) => ({
        ...prev,
        defaultOptions: response,
        options: response,
      }));
    } catch {
      // we will not show the toast error message for search API
    } finally {
      setIsTierLoading(false);
    }
  };

  const fetchDefaultCertificationOptions = async () => {
    if (certificationOptions.defaultOptions.length) {
      setCertificationOptions((prev) => ({
        ...prev,
        options: [...selectedCertificationFilter, ...prev.defaultOptions],
      }));

      return;
    }

    try {
      setIsCertificationLoading(true);
      const response = await fetchCertificationOptions();
      setCertificationOptions((prev) => ({
        ...prev,
        defaultOptions: response,
        options: response,
      }));
    } catch {
      // we will not show the toast error message for search API
    } finally {
      setIsCertificationLoading(false);
    }
  };

  const handleOwnerChange = (owners: EntityReference[] = []) => {
    setSelectedOwnerFilter(owners);
    setChartFilter((prev) => ({
      ...prev,
      ownerFqn: isEmpty(owners)
        ? undefined
        : owners[0].name ?? owners[0].fullyQualifiedName,
    }));
  };

  // Stable string derived from the array so the effect doesn't re-run on every
  // render due to a new array reference (e.g. hiddenFilters={['tags']} literal).
  const hiddenFiltersKey = hiddenFilters.join(',');

  const showOwnerFilter = !hiddenFilters.includes(DQ_FILTER_KEYS.OWNER);
  const showTierFilter = !hiddenFilters.includes(DQ_FILTER_KEYS.TIER);
  const showCertificationFilter = !hiddenFilters.includes(
    DQ_FILTER_KEYS.CERTIFICATION
  );
  const showTagsFilter = !hiddenFilters.includes(DQ_FILTER_KEYS.TAGS);
  const showGlossaryTermsFilter = !hiddenFilters.includes(
    DQ_FILTER_KEYS.GLOSSARY_TERMS
  );
  const showDataProductsFilter = !hiddenFilters.includes(
    DQ_FILTER_KEYS.DATA_PRODUCTS
  );

  useEffect(() => {
    if (hideFilterBar) {
      return;
    }
    if (showTierFilter) {
      fetchDefaultTierOptions();
    }
    if (showCertificationFilter) {
      fetchDefaultCertificationOptions();
    }
    if (showTagsFilter) {
      fetchDefaultTagOptions();
    }
    if (showGlossaryTermsFilter) {
      fetchDefaultGlossaryTermOptions();
    }
    if (showDataProductsFilter) {
      fetchDefaultDataProductOptions();
    }
  }, [hideFilterBar, hiddenFiltersKey]);

  const tags = useMemo<DqSearchFilterProps>(
    () => ({
      options: uniqBy(tagOptions.options, 'key'),
      selectedKeys: selectedTagFilter,
      onChange: handleTagChange,
      onGetInitialOptions: fetchDefaultTagOptions,
      onSearch: handleTagSearch,
      isSuggestionsLoading: isTagLoading,
    }),
    [isTagLoading, tagOptions, selectedTagFilter]
  );

  const glossaryTerms = useMemo<DqSearchFilterProps>(
    () => ({
      options: uniqBy(glossaryTermOptions.options, 'key'),
      selectedKeys: selectedGlossaryTermFilter,
      onChange: handleGlossaryTermChange,
      onGetInitialOptions: fetchDefaultGlossaryTermOptions,
      onSearch: handleGlossaryTermSearch,
      isSuggestionsLoading: isGlossaryTermLoading,
    }),
    [
      isGlossaryTermLoading,
      glossaryTermOptions,
      selectedGlossaryTermFilter,
      handleGlossaryTermChange,
    ]
  );

  const tierFilter = useMemo<DqSearchFilterProps>(
    () => ({
      options: uniqBy(tierOptions.options, 'key'),
      selectedKeys: selectedTierFilter,
      onChange: handleTierChange,
      onGetInitialOptions: fetchDefaultTierOptions,
      onSearch: handleTierSearch,
      isSuggestionsLoading: isTierLoading,
    }),
    [isTierLoading, tierOptions, selectedTierFilter]
  );

  const certificationFilter = useMemo<DqSearchFilterProps>(
    () => ({
      options: uniqBy(certificationOptions.options, 'key'),
      selectedKeys: selectedCertificationFilter,
      onChange: handleCertificationChange,
      onGetInitialOptions: fetchDefaultCertificationOptions,
      onSearch: handleCertificationSearch,
      isSuggestionsLoading: isCertificationLoading,
    }),
    [isCertificationLoading, certificationOptions, selectedCertificationFilter]
  );

  const dataProducts = useMemo<DqSearchFilterProps>(
    () => ({
      options: uniqBy(dataProductOptions.options, 'key'),
      selectedKeys: selectedDataProductFilter,
      onChange: handleDataProductChange,
      onGetInitialOptions: fetchDefaultDataProductOptions,
      onSearch: handleDataProductSearch,
      isSuggestionsLoading: isDataProductLoading,
    }),
    [isDataProductLoading, dataProductOptions, selectedDataProductFilter]
  );

  const showFilterBar = !hideFilterBar;
  const hasVisibleFilters =
    showOwnerFilter ||
    showTierFilter ||
    showCertificationFilter ||
    showTagsFilter ||
    showGlossaryTermsFilter ||
    showDataProductsFilter;

  const hasActiveFilters =
    !isEmpty(selectedTierFilter) ||
    !isEmpty(selectedCertificationFilter) ||
    !isEmpty(selectedTagFilter) ||
    !isEmpty(selectedGlossaryTermFilter) ||
    !isEmpty(selectedDataProductFilter) ||
    !isEmpty(selectedOwnerFilter);

  const clearAll = () => {
    setSelectedTierFilter([]);
    setSelectedCertificationFilter([]);
    setSelectedTagFilter([]);
    setSelectedGlossaryTermFilter([]);
    setSelectedDataProductFilter([]);
    setSelectedOwnerFilter(undefined);
    setChartFilter((prev) => ({
      ...initialFilters,
      startTs: prev.startTs,
      endTs: prev.endTs,
    }));
  };

  const filters = useMemo<DqFilterDescriptor[]>(() => {
    const descriptors: DqFilterDescriptor[] = [];

    if (showOwnerFilter) {
      descriptors.push({
        key: 'owner',
        type: 'owner',
        label: t('label.owner'),
        selectedOwners: selectedOwnerFilter,
        selectedOwnerKeys,
        onChange: handleOwnerChange,
      });
    }
    if (showTierFilter) {
      descriptors.push({
        key: 'tier',
        type: 'search',
        label: t('label.tier'),
        searchKey: 'tier',
        searchProps: tierFilter,
      });
    }
    if (showCertificationFilter) {
      descriptors.push({
        key: 'certification',
        type: 'search',
        label: t('label.certification'),
        searchKey: 'certification',
        searchProps: certificationFilter,
      });
    }
    if (showTagsFilter) {
      descriptors.push({
        key: 'tag',
        type: 'search',
        label: t('label.tag'),
        searchKey: 'tag',
        searchProps: tags,
      });
    }
    if (showGlossaryTermsFilter) {
      descriptors.push({
        key: 'glossaryTerm',
        type: 'search',
        label: t('label.glossary-term'),
        searchKey: 'glossaryTerms',
        searchProps: glossaryTerms,
      });
    }
    if (showDataProductsFilter) {
      descriptors.push({
        key: 'dataProduct',
        type: 'search',
        label: t('label.data-product'),
        searchKey: 'dataProduct',
        searchProps: dataProducts,
      });
    }

    return descriptors;
  }, [
    t,
    showOwnerFilter,
    showTierFilter,
    showCertificationFilter,
    showTagsFilter,
    showGlossaryTermsFilter,
    showDataProductsFilter,
    selectedOwnerFilter,
    selectedOwnerKeys,
    tierFilter,
    certificationFilter,
    tags,
    glossaryTerms,
    dataProducts,
  ]);

  return {
    chartFilter,
    defaultFilters,
    pieChartFilters,
    defaultRange: DEFAULT_RANGE_DATA,
    dateRange: { startTs: chartFilter.startTs, endTs: chartFilter.endTs },
    onDateRangeChange: handleDateRangeChange,
    filters,
    showFilterBar,
    hasVisibleFilters,
    hasActiveFilters,
    clearAll,
  };
};
