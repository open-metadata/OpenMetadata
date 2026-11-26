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
import {
  Config,
  Field,
  FieldOrGroup,
  ImmutableTree,
  OldJsonTree,
  Utils as QbUtils,
} from '@react-awesome-query-builder/ui';
import '@react-awesome-query-builder/ui/css/styles.css';
import { isEmpty, isEqual, isNil } from 'lodash';
import Qs from 'qs';
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SearchIndex } from '../../../enums/search.enum';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { ExploreSearchIndex } from '../../../interface/discovery/explore.interface';
import type { QueryFilterInterface } from '../../../interface/queryFilter.interface';
import { TabsInfoData } from '../../../pages/ExplorePage/ExplorePage.interface';
import { getAllCustomProperties } from '../../../rest/metadataTypeAPI';
import {
  getTreeConfig,
  processEntityTypeFields,
} from '../../../utils/AdvancedSearchUtils';
import {
  getExploreClearQueryFilterSearchParams,
  getExploreResetFiltersSearchParams,
  parseExploreQueryFilterParam,
} from '../../../utils/ExplorePureUtils';
import {
  getEmptyJsonTree,
  loadExploreQueryFilter,
} from '../../../utils/queryBuilder/tree';
import { elasticSearchFormat } from '../../../utils/QueryBuilderElasticsearchFormatUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { showWarningToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Loader from '../../common/Loader/Loader';
import { UrlParams } from '../ExplorePage.interface';
import {
  AdvanceSearchContext,
  AdvanceSearchProviderProps,
  SearchOutputType,
} from './AdvanceSearchProvider.interface';

const AdvancedSearchModal = lazy(() =>
  import('../AdvanceSearchModal.component').then((m) => ({
    default: m.AdvancedSearchModal,
  }))
);

const AdvancedSearchContext = createContext<AdvanceSearchContext>(
  {} as AdvanceSearchContext
);

const getSearchIndexFromTabInfo = (
  tabsInfo: Record<ExploreSearchIndex, TabsInfoData>,
  tab: string
) => {
  const tabInfo = Object.entries(tabsInfo).find(
    ([, tabInfo]) => tabInfo.path === tab
  );
  if (isNil(tabInfo)) {
    return SearchIndex.DATA_ASSET;
  }

  return tabInfo[0] as SearchIndex;
};

export const AdvanceSearchProvider = ({
  children,
  isExplorePage = true,
  modalProps,
  updateURL = true,
  fieldOverrides = [],
  searchOutputType = SearchOutputType.ElasticSearch,
  entityType,
}: AdvanceSearchProviderProps) => {
  const { t } = useTranslation();
  const tabsInfo = searchClassBase.getTabsInfo();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const { tab } = useRequiredParams<UrlParams>();
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const [customProps, setCustomProps] = useState<Record<string, Field> | null>(
    null
  );

  const [searchIndex, setSearchIndex] = useState<
    SearchIndex | Array<SearchIndex>
  >(getSearchIndexFromTabInfo(tabsInfo, tab));

  const changeSearchIndex = useCallback(
    (index: SearchIndex | Array<SearchIndex>) => {
      // Re-selecting the index the provider is already on must not enter the updating state.
      if (isEqual(searchIndex, index)) {
        return;
      }

      setIsUpdating(true);
      setSearchIndex(index);
    },
    [searchIndex]
  );

  const [config, setConfig] = useState<Config>(
    getTreeConfig({
      searchIndex: searchIndex,
      searchOutputType: searchOutputType,
      isExplorePage,
    })
  );

  const [initialised, setInitialised] = useState(false);

  const defaultTree = useMemo(
    () =>
      QbUtils.Validation.sanitizeTree(
        QbUtils.loadTree(getEmptyJsonTree()),
        config
      ).fixedTree,
    []
  );

  const parsedSearch = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.slice(1)
          : location.search
      ),
    [location.search]
  );

  // Keyed on the filter param alone: paging, sorting or a quick filter must not re-apply the Advanced Search
  // (rebuilding the tree and repeating its warning).
  const rawQueryFilter = parsedSearch.queryFilter;
  const urlFilter = useMemo(
    () => parseExploreQueryFilterParam(rawQueryFilter),
    [rawQueryFilter]
  );
  // A tree from an older link that names a field this config does not have is ignored.
  const isValidUrlTree = (tree: OldJsonTree, treeConfig: Config) =>
    QbUtils.isValidTree(QbUtils.loadTree(tree), treeConfig);

  const [showModal, setShowModal] = useState(false);
  const [treeInternal, setTreeInternal] = useState<ImmutableTree>(() =>
    urlFilter.tree && isValidUrlTree(urlFilter.tree, config)
      ? QbUtils.Validation.sanitizeTree(
          QbUtils.loadTree(urlFilter.tree),
          config
        ).fixedTree
      : defaultTree
  );
  const [queryFilter, setQueryFilter] = useState<
    Record<string, unknown> | undefined
  >();
  const [sqlQuery, setSQLQuery] = useState(
    treeInternal ? QbUtils.sqlFormat(treeInternal, config) ?? '' : ''
  );

  useEffect(() => {
    setConfig(
      getTreeConfig({
        searchIndex: searchIndex,
        searchOutputType: searchOutputType,
        isExplorePage,
      })
    );
  }, [searchIndex, isExplorePage]);

  const handleChange = useCallback(
    (nTree: ImmutableTree, nConfig: Config) => {
      setConfig(nConfig);
      setTreeInternal(nTree);
    },
    [setConfig, setTreeInternal]
  );

  const handleQueryFilterUpdate = useCallback(
    (qFilter?: Partial<QueryFilterInterface>) => {
      navigate({
        pathname: location.pathname,
        search: getExploreClearQueryFilterSearchParams(parsedSearch, qFilter),
      });
    },
    [navigate, parsedSearch, location.pathname]
  );

  const toggleModal = (show: boolean) => {
    setShowModal(show);
  };

  const handleReset = useCallback(() => {
    setTreeInternal(
      QbUtils.checkTree(QbUtils.loadTree(getEmptyJsonTree()), config)
    );

    setQueryFilter(undefined);
    setSQLQuery('');
  }, [config]);

  const handleResetQueryFilter = useCallback(() => {
    handleReset();
    handleQueryFilterUpdate();
  }, [handleReset, handleQueryFilterUpdate]);

  // Reset all filters, quick filter and query filter
  const handleResetAllFilters = useCallback(() => {
    setQueryFilter(undefined);
    setSQLQuery('');
    navigate({
      pathname: location.pathname,
      search: getExploreResetFiltersSearchParams(parsedSearch),
    });
  }, [navigate, parsedSearch, location.pathname]);

  const fetchCustomPropertyType = async () => {
    const subfields: Record<string, FieldOrGroup> = {};

    try {
      const res = await getAllCustomProperties();

      Object.entries(res).forEach(([resEntityType, fields]) => {
        processEntityTypeFields(
          resEntityType,
          fields,
          subfields,
          entityType,
          searchOutputType
        );
      });
    } catch {
      return subfields;
    }

    return subfields;
  };

  const loadData = async (isCancelled: () => boolean) => {
    const actualConfig = getTreeConfig({
      searchIndex: searchIndex,
      searchOutputType: searchOutputType,
      isExplorePage,
    });

    let extensionSubField = customProps;
    if (extensionSubField === null) {
      extensionSubField = await fetchCustomPropertyType();
      // Ignore responses from an earlier index or an effect that was unmounted.
      // Otherwise they can remove fields from a workflow's active condition tree.
      if (isCancelled()) {
        return;
      }
      setCustomProps(extensionSubField);
    }

    if (
      !isEmpty(extensionSubField) &&
      'subfields' in actualConfig.fields.extension
    ) {
      actualConfig.fields.extension.subfields = extensionSubField;
    }

    // Update field type if field override is provided For example type of extension is group but it is required as
    // struct in some cases
    fieldOverrides.forEach((fieldOverride: { field: string; type: string }) => {
      if (actualConfig.fields[fieldOverride.field]) {
        actualConfig.fields[fieldOverride.field].type = fieldOverride.type;
      }
    });

    setConfig(actualConfig);
    setInitialised(true);
    setIsUpdating(false);
  };

  const loadTree = useCallback(
    async (treeObj: OldJsonTree) => {
      const updatedConfig = config;
      const tree = QbUtils.checkTree(QbUtils.loadTree(treeObj), updatedConfig);

      setTreeInternal(tree);
      const qFilter = {
        query: elasticSearchFormat(tree, updatedConfig),
      };
      if (isEqual(qFilter, queryFilter)) {
        return;
      }

      setQueryFilter(qFilter);
      setSQLQuery(QbUtils.sqlFormat(tree, updatedConfig) ?? '');
    },
    [config, queryFilter]
  );

  useEffect(() => {
    setSearchIndex(getSearchIndexFromTabInfo(tabsInfo, tab));
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    void loadData(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [searchOutputType, searchIndex]);

  const applyUrlFilter = () => {
    if (urlFilter.tree && isValidUrlTree(urlFilter.tree, config)) {
      loadTree(urlFilter.tree);

      return;
    }
    if (!urlFilter.queryFilter) {
      handleReset();

      return;
    }

    const { tree, isComplete } = loadExploreQueryFilter(
      urlFilter.queryFilter,
      config
    );
    const qFilter = { query: urlFilter.queryFilter.query };

    setTreeInternal(tree);
    setSQLQuery(QbUtils.sqlFormat(tree, config) ?? '');
    // Applying the modal writes this same filter to the URL; keep the current object so the page does not search twice.
    setQueryFilter((current) =>
      isEqual(current, qFilter) ? current : qFilter
    );

    if (!isComplete) {
      showWarningToast(t('message.explore-filter-partially-shown'));
    }
  };
  // Read through a ref so the URL is applied when it changes and once the config has loaded — after custom properties,
  // which a property's rule is matched to — and not again whenever the config or a handler changes identity, which
  // would reload the URL's tree over the user's edits.
  const applyUrlFilterRef = useRef(applyUrlFilter);
  applyUrlFilterRef.current = applyUrlFilter;

  useEffect(() => {
    if (!initialised) {
      return;
    }
    applyUrlFilterRef.current();
    setLoading(false);
  }, [urlFilter, initialised]);

  const handleSubmit = useCallback(() => {
    const qFilter = {
      query: elasticSearchFormat(treeInternal, config),
    };
    setQueryFilter(qFilter);
    const val = QbUtils.sqlFormat(treeInternal, config);
    setSQLQuery(treeInternal ? val ?? '' : '');

    updateURL && handleQueryFilterUpdate(qFilter);
    setShowModal(false);
  }, [treeInternal, config, handleQueryFilterUpdate, updateURL]);

  const contextValues = useMemo(
    () => ({
      queryFilter,
      sqlQuery,
      onTreeUpdate: handleChange,
      toggleModal,
      treeInternal,
      config,
      isUpdating,
      searchIndex,
      onReset: handleReset,
      onResetQueryFilter: handleResetQueryFilter,
      onResetAllFilters: handleResetAllFilters,
      onChangeSearchIndex: changeSearchIndex,
      onSubmit: handleSubmit,
      modalProps,
    }),
    [
      queryFilter,
      sqlQuery,
      handleChange,
      toggleModal,
      treeInternal,
      config,
      isUpdating,
      searchIndex,
      handleReset,
      handleResetQueryFilter,
      handleResetAllFilters,
      changeSearchIndex,
      handleSubmit,
      modalProps,
    ]
  );

  return (
    <AdvancedSearchContext.Provider value={contextValues}>
      {loading ? <Loader /> : children}
      {showModal && (
        <Suspense fallback={null}>
          <AdvancedSearchModal
            visible={showModal}
            onCancel={() => setShowModal(false)}
            onSubmit={handleSubmit}
          />
        </Suspense>
      )}
    </AdvancedSearchContext.Provider>
  );
};

export const useAdvanceSearch = () => useContext(AdvancedSearchContext);
