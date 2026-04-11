/*
 *  Copyright 2024 Collate.
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
  Card,
  Grid,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEmpty, isEqual, omit, uniqBy } from 'lodash';
import { DateRangeObject } from 'Models';
import QueryString from 'qs';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DropDownIcon } from '../../../assets/svg/drop-down.svg';
import DatePickerMenu from '../../../components/common/DatePickerMenu/DatePickerMenu.component';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import SearchDropdown from '../../../components/SearchDropdown/SearchDropdown';
import { SearchDropdownOption } from '../../../components/SearchDropdown/SearchDropdown.interface';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import {
  ABORTED_CHART_COLOR_SCHEME,
  FAILED_CHART_COLOR_SCHEME,
  SUCCESS_CHART_COLOR_SCHEME,
} from '../../../constants/Chart.constants';
import { PAGE_SIZE_BASE, ROUTES } from '../../../constants/constants';
import {
  DATA_QUALITY_DASHBOARD_HEADER,
  DQ_FILTER_KEYS,
} from '../../../constants/DataQuality.constants';
import { PROFILER_FILTER_RANGE } from '../../../constants/profiler.constant';
import { SearchIndex } from '../../../enums/search.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { TestCaseStatus } from '../../../generated/tests/testCase';
import { TestCaseResolutionStatusTypes } from '../../../generated/tests/testCaseResolutionStatus';
import { EntityReference } from '../../../generated/type/entityReference';
import { DataQualityPageTabs } from '../../../pages/DataQuality/DataQualityPage.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getTags } from '../../../rest/tagAPI';
import { getSelectedOptionLabelString } from '../../../utils/AdvancedSearchUtils';
import {
  formatDate,
  getCurrentMillis,
  getEndOfDayInMillis,
  getEpochMillisForPastDays,
  getStartOfDayInMillis,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDataQualityPagePath } from '../../../utils/RouterUtils';
import DataAssetsCoveragePieChartWidget from '../ChartWidgets/DataAssetsCoveragePieChartWidget/DataAssetsCoveragePieChartWidget.component';
import EntityHealthStatusPieChartWidget from '../ChartWidgets/EntityHealthStatusPieChartWidget/EntityHealthStatusPieChartWidget.component';
import IncidentTimeChartWidget from '../ChartWidgets/IncidentTimeChartWidget/IncidentTimeChartWidget.component';
import IncidentTypeAreaChartWidget from '../ChartWidgets/IncidentTypeAreaChartWidget/IncidentTypeAreaChartWidget.component';
import StatusByDimensionCardWidget from '../ChartWidgets/StatusByDimensionCardWidget/StatusByDimensionCardWidget.component';
import TestCaseStatusAreaChartWidget from '../ChartWidgets/TestCaseStatusAreaChartWidget/TestCaseStatusAreaChartWidget.component';
import TestCaseStatusPieChartWidget from '../ChartWidgets/TestCaseStatusPieChartWidget/TestCaseStatusPieChartWidget.component';
import { IncidentTimeMetricsType } from '../DataQuality.interface';
import './data-quality-dashboard.style.less';
import { DqDashboardChartFilters } from './DataQualityDashboard.interface';

const DataQualityDashboard = ({
  initialFilters,
  hideFilterBar = false,
  hiddenFilters = [],
  isGovernanceView = false,
  className,
}: {
  initialFilters?: DqDashboardChartFilters;
  hideFilterBar?: boolean;
  hiddenFilters?: Array<
    'owner' | 'tier' | 'tags' | 'glossaryTerms' | 'dataProducts'
  >;
  isGovernanceView?: boolean;
  className?: string;
}) => {
  const { t } = useTranslation();

  const { dataHealth, dataDimensions, testCasesStatus, incidentMetrics } =
    DATA_QUALITY_DASHBOARD_HEADER;

  const translatedHeaders = useMemo(
    () => ({
      dataHealth: {
        header: t(dataHealth.header),
        subHeader: t(dataHealth.subHeader),
      },
      dataDimensions: {
        header: t(dataDimensions.header),
        subHeader: t(dataDimensions.subHeader),
      },
      testCasesStatus: {
        header: t(testCasesStatus.header),
        subHeader: t(testCasesStatus.subHeader),
      },
      incidentMetrics: {
        header: t(incidentMetrics.header),
        subHeader: t(incidentMetrics.subHeader),
      },
    }),
    [t, dataHealth, dataDimensions, testCasesStatus, incidentMetrics]
  );

  const DEFAULT_RANGE_DATA = useMemo(() => {
    return {
      startTs: getStartOfDayInMillis(
        getEpochMillisForPastDays(PROFILER_FILTER_RANGE.last30days.days)
      ),
      endTs: getEndOfDayInMillis(getCurrentMillis()),
      key: 'last30days',
    };
  }, []);

  const [glossaryTermOptions, setGlossaryTermOptions] = useState<{
    defaultOptions: SearchDropdownOption[];
    options: SearchDropdownOption[];
  }>({
    defaultOptions: [],
    options: [],
  });
  const [isGlossaryTermLoading, setIsGlossaryTermLoading] = useState(false);

  const [tagOptions, setTagOptions] = useState<{
    defaultOptions: SearchDropdownOption[];
    options: SearchDropdownOption[];
  }>({
    defaultOptions: [],
    options: [],
  });
  const [isTagLoading, setIsTagLoading] = useState(false);
  const [dataProductOptions, setDataProductOptions] = useState<{
    defaultOptions: SearchDropdownOption[];
    options: SearchDropdownOption[];
  }>({
    defaultOptions: [],
    options: [],
  });
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
  const [selectedOwnerFilter, setSelectedOwnerFilter] =
    useState<EntityReference[]>();

  const [dateRangeObject, setDateRangeObject] =
    useState<DateRangeObject>(DEFAULT_RANGE_DATA);
  const [tier, setTier] = useState<{
    tags: Tag[];
    isLoading: boolean;
    options: SearchDropdownOption[];
  }>({
    tags: [],
    isLoading: true,
    options: [],
  });
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
      dataProductFqns: defaultFilters.dataProductFqns,
      startTs: defaultFilters.startTs,
      endTs: defaultFilters.endTs,
      domainFqn: defaultFilters.domainFqn,
    };
  }, [
    defaultFilters.ownerFqn,
    defaultFilters.tier,
    defaultFilters.tags,
    defaultFilters.dataProductFqns,
    defaultFilters.startTs,
    defaultFilters.endTs,
    defaultFilters.domainFqn,
  ]);

  const selectedOwnerKeys = useMemo(() => {
    return (
      selectedOwnerFilter?.map((owner) => ({
        key: owner.id,
        label: getEntityName(owner),
      })) ?? []
    );
  }, [selectedOwnerFilter]);

  const defaultTierOptions = useMemo(() => {
    return tier.tags.map((op) => ({
      key: op.fullyQualifiedName ?? op.name,
      label: getEntityName(op),
    }));
  }, [tier]);

  const handleTierChange = (tiers: SearchDropdownOption[] = []) => {
    setSelectedTierFilter(tiers);
    setChartFilter((prev) => ({
      ...prev,
      tier: tiers.map((tag) => tag.key),
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
      filters: 'disabled:false AND !classification.name:Tier',
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

  const handleTierSearch = async (query: string) => {
    if (query) {
      setTier((prev) => ({
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
      setTier((prev) => ({
        ...prev,
        options: defaultTierOptions,
      }));
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

  const getTierTag = async () => {
    setTier((prev) => ({ ...prev, isLoading: true }));
    try {
      const { data } = await getTags({
        parent: 'Tier',
      });

      setTier((prev) => ({
        ...prev,
        tags: data,
        options: data.map((op) => ({
          key: op.fullyQualifiedName ?? op.name,
          label: getEntityName(op),
        })),
      }));
    } catch {
      // error
    } finally {
      setTier((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const fetchDefaultTierOptions = () => {
    setTier((prev) => ({
      ...prev,
      options: defaultTierOptions,
    }));
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
      getTierTag();
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

  const tags = useMemo(
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

  const glossaryTerms = useMemo(
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

  const tierFilter = useMemo(
    () => ({
      options: tier.options,
      selectedKeys: selectedTierFilter,
      onChange: handleTierChange,
      onGetInitialOptions: fetchDefaultTierOptions,
      onSearch: handleTierSearch,
      isSuggestionsLoading: tier.isLoading,
    }),
    [selectedTierFilter, tier]
  );

  const dataProducts = useMemo(
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
    showTagsFilter ||
    showGlossaryTermsFilter ||
    showDataProductsFilter;

  const cardClassName = classNames('data-quality-dashboard-card-section', {
    'tw:ring-0': isGovernanceView,
    'tw:shadow-none': isGovernanceView,
  });

  const cardBodyClass = isGovernanceView ? 'tw:py-6' : 'tw:p-6';

  const filterBarContent = (
    <div
      className={classNames(
        'tw:flex tw:items-center tw:w-full',
        showFilterBar && hasVisibleFilters
          ? 'tw:justify-between'
          : 'tw:justify-end'
      )}>
      {showFilterBar && hasVisibleFilters && (
        <div className="tw:flex tw:items-center tw:gap-4 tw:w-full">
          {showOwnerFilter && (
            <Tooltip
              isDisabled={selectedOwnerKeys.length === 0}
              placement="top"
              title={getSelectedOptionLabelString(selectedOwnerKeys, true)}>
              <TooltipTrigger>
                <UserTeamSelectableList
                  hasPermission
                  owner={selectedOwnerFilter}
                  popoverProps={{ placement: 'bottomLeft' }}
                  onUpdate={handleOwnerChange}>
                  <div
                    className="tw:flex tw:items-center tw:gap-1  tw:rounded-md quick-filter-dropdown-trigger-btn"
                    data-testid="search-dropdown-owner"
                    title={
                      selectedOwnerKeys.length > 0
                        ? getSelectedOptionLabelString(selectedOwnerKeys, true)
                        : undefined
                    }>
                    <div className="tw:flex tw:items-center tw:gap-0">
                      <span>{t('label.owner')}</span>
                      {selectedOwnerKeys.length > 0 && (
                        <span>
                          {': '}
                          <span className="text-primary font-medium">
                            {getSelectedOptionLabelString(selectedOwnerKeys)}
                          </span>
                        </span>
                      )}
                    </div>
                    <DropDownIcon
                      className="flex self-center"
                      height={12}
                      width={12}
                    />
                  </div>
                </UserTeamSelectableList>
              </TooltipTrigger>
            </Tooltip>
          )}

          {showTierFilter && (
            <SearchDropdown
              hideCounts
              label={t('label.tier')}
              searchKey="tier"
              triggerButtonSize="middle"
              {...tierFilter}
            />
          )}

          {showTagsFilter && (
            <SearchDropdown
              hideCounts
              label={t('label.tag')}
              searchKey="tag"
              triggerButtonSize="middle"
              {...tags}
            />
          )}

          {showGlossaryTermsFilter && (
            <SearchDropdown
              hideCounts
              label={t('label.glossary-term')}
              searchKey="glossaryTerms"
              triggerButtonSize="middle"
              {...glossaryTerms}
            />
          )}

          {showDataProductsFilter && (
            <SearchDropdown
              hideCounts
              label={t('label.data-product')}
              searchKey="dataProduct"
              triggerButtonSize="middle"
              {...dataProducts}
            />
          )}
        </div>
      )}
      <div
        className={classNames(
          { 'tw:mr-1': !showFilterBar },
          'tw:flex tw:shrink-0 tw:items-center tw:gap-4'
        )}>
        <span className="data-insight-label-text text-xs tw:whitespace-nowrap">
          {`${formatDate(chartFilter.startTs, true)} - ${formatDate(
            chartFilter.endTs,
            true
          )}`}
        </span>
        <DatePickerMenu
          defaultDateRange={DEFAULT_RANGE_DATA}
          handleDateRangeChange={handleDateRangeChange}
          showSelectedCustomRange={false}
        />
      </div>
    </div>
  );

  const chartCards = (
    <>
      <Grid.Item className="export-pdf-container" span={24}>
        <Card className={cardClassName}>
          <div className={cardBodyClass}>
            <PageHeader data={translatedHeaders.dataHealth} />
            <Grid colGap="6">
              <Grid.Item span={8}>
                <DataAssetsCoveragePieChartWidget
                  chartFilter={pieChartFilters}
                  className="data-quality-dashboard-pie-chart"
                />
              </Grid.Item>
              <Grid.Item span={8}>
                <EntityHealthStatusPieChartWidget
                  chartFilter={pieChartFilters}
                  className="data-quality-dashboard-pie-chart"
                />
              </Grid.Item>
              <Grid.Item span={8}>
                <TestCaseStatusPieChartWidget
                  chartFilter={pieChartFilters}
                  className="data-quality-dashboard-pie-chart"
                />
              </Grid.Item>
            </Grid>
          </div>
        </Card>
      </Grid.Item>

      <Grid.Item className="export-pdf-container" span={24}>
        <Card className={cardClassName}>
          <div className={cardBodyClass}>
            <PageHeader data={translatedHeaders.dataDimensions} />
            <StatusByDimensionCardWidget chartFilter={pieChartFilters} />
          </div>
        </Card>
      </Grid.Item>

      <Grid.Item className="export-pdf-container" span={24}>
        <Card className={cardClassName}>
          <div className={cardBodyClass}>
            <PageHeader data={translatedHeaders.testCasesStatus} />
            <Grid colGap="6">
              <Grid.Item span={8}>
                <TestCaseStatusAreaChartWidget
                  chartColorScheme={SUCCESS_CHART_COLOR_SCHEME}
                  chartFilter={defaultFilters}
                  name="success"
                  redirectPath={{
                    pathname: getDataQualityPagePath(
                      DataQualityPageTabs.TEST_CASES
                    ),
                    search: QueryString.stringify({
                      testCaseStatus: TestCaseStatus.Success,
                    }),
                  }}
                  testCaseStatus={TestCaseStatus.Success}
                  title={t('label.success')}
                />
              </Grid.Item>
              <Grid.Item span={8}>
                <TestCaseStatusAreaChartWidget
                  chartColorScheme={ABORTED_CHART_COLOR_SCHEME}
                  chartFilter={defaultFilters}
                  name="aborted"
                  redirectPath={{
                    pathname: getDataQualityPagePath(
                      DataQualityPageTabs.TEST_CASES
                    ),
                    search: QueryString.stringify({
                      testCaseStatus: TestCaseStatus.Aborted,
                    }),
                  }}
                  testCaseStatus={TestCaseStatus.Aborted}
                  title={t('label.aborted')}
                />
              </Grid.Item>
              <Grid.Item span={8}>
                <TestCaseStatusAreaChartWidget
                  chartColorScheme={FAILED_CHART_COLOR_SCHEME}
                  chartFilter={defaultFilters}
                  name="failed"
                  redirectPath={{
                    pathname: getDataQualityPagePath(
                      DataQualityPageTabs.TEST_CASES
                    ),
                    search: QueryString.stringify({
                      testCaseStatus: TestCaseStatus.Failed,
                    }),
                  }}
                  testCaseStatus={TestCaseStatus.Failed}
                  title={t('label.failed')}
                />
              </Grid.Item>
            </Grid>
          </div>
        </Card>
      </Grid.Item>

      <Grid.Item className="export-pdf-container" span={24}>
        <Card className={cardClassName}>
          <div className={cardBodyClass}>
            <PageHeader data={translatedHeaders.incidentMetrics} />
            <Grid colGap="6">
              <Grid.Item span={6}>
                <IncidentTypeAreaChartWidget
                  chartFilter={defaultFilters}
                  incidentStatusType={TestCaseResolutionStatusTypes.New}
                  name="open-incident"
                  redirectPath={{
                    pathname: ROUTES.INCIDENT_MANAGER,
                    search: QueryString.stringify({
                      testCaseResolutionStatusType:
                        TestCaseResolutionStatusTypes.New,
                      startTs: chartFilter.startTs,
                      endTs: chartFilter.endTs,
                    }),
                  }}
                  title={t('label.open-incident-plural')}
                />
              </Grid.Item>
              <Grid.Item span={6}>
                <IncidentTypeAreaChartWidget
                  chartFilter={defaultFilters}
                  incidentStatusType={TestCaseResolutionStatusTypes.Resolved}
                  name="resolved-incident"
                  redirectPath={{
                    pathname: ROUTES.INCIDENT_MANAGER,
                    search: QueryString.stringify({
                      testCaseResolutionStatusType:
                        TestCaseResolutionStatusTypes.Resolved,
                      startTs: chartFilter.startTs,
                      endTs: chartFilter.endTs,
                    }),
                  }}
                  title={t('label.resolved-incident-plural')}
                />
              </Grid.Item>
              <Grid.Item span={6}>
                <IncidentTimeChartWidget
                  chartFilter={defaultFilters}
                  incidentMetricType={IncidentTimeMetricsType.TIME_TO_RESPONSE}
                  name="response-time"
                  title={t('label.response-time')}
                />
              </Grid.Item>
              <Grid.Item span={6}>
                <IncidentTimeChartWidget
                  chartFilter={defaultFilters}
                  incidentMetricType={
                    IncidentTimeMetricsType.TIME_TO_RESOLUTION
                  }
                  name="resolution-time"
                  title={t('label.resolution-time')}
                />
              </Grid.Item>
            </Grid>
          </div>
        </Card>
      </Grid.Item>
    </>
  );

  if (isGovernanceView) {
    return (
      <div
        className={classNames('data-quality-governance-layout', className)}
        data-testid="dq-dashboard-container">
        <div className="data-quality-governance-filter-bar">
          {filterBarContent}
        </div>
        <div className="data-quality-governance-charts">
          <Grid rowGap="6">{chartCards}</Grid>
        </div>
      </div>
    );
  }

  return (
    <Grid
      className={classNames('m-b-md', className)}
      data-testid="dq-dashboard-container"
      rowGap="6">
      <Grid.Item span={24}>{filterBarContent}</Grid.Item>
      {chartCards}
    </Grid>
  );
};

export default DataQualityDashboard;
