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
  Config,
  Field,
  ImmutableTree,
  OldJsonTree,
  Utils as QbUtils,
  ValueSource,
} from '@react-awesome-query-builder/antd';
import { isEmpty, isEqual, isNil, isString } from 'lodash';
import Qs from 'qs';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIndex } from '../../../enums/search.enum';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { TabsInfoData } from '../../../pages/ExplorePage/ExplorePage.interface';
import { getAllCustomProperties } from '../../../rest/metadataTypeAPI';
import advancedSearchClassBase from '../../../utils/AdvancedSearchClassBase';
import {
  getEmptyJsonTree,
  getTierOptions,
  getTreeConfig,
} from '../../../utils/AdvancedSearchUtils';
import { elasticSearchFormat } from '../../../utils/QueryBuilderElasticsearchFormatUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Loader from '../../common/Loader/Loader';
import { AdvancedSearchModal } from '../AdvanceSearchModal.component';
import { ExploreSearchIndex, UrlParams } from '../ExplorePage.interface';
import {
  AdvanceSearchContext,
  AdvanceSearchProviderProps,
  SearchOutputType,
} from './AdvanceSearchProvider.interface';

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
}: AdvanceSearchProviderProps) => {
  const tabsInfo = searchClassBase.getTabsInfo();
  const tierOptions = useMemo(getTierOptions, []);
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
      setIsUpdating(true);
      setSearchIndex(index);
    },
    []
  );

  const [config, setConfig] = useState<Config>(
    getTreeConfig({
      searchIndex: searchIndex,
      searchOutputType: searchOutputType,
      isExplorePage,
      tierOptions,
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

  const jsonTree = useMemo(() => {
    if (!isString(parsedSearch.queryFilter)) {
      return undefined;
    }

    try {
      const filter: OldJsonTree = JSON.parse(parsedSearch.queryFilter);
      const immutableTree = QbUtils.loadTree(filter);
      if (QbUtils.isValidTree(immutableTree, config)) {
        return filter;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }, [parsedSearch]);

  const [showModal, setShowModal] = useState(false);
  const [treeInternal, setTreeInternal] = useState<ImmutableTree>(
    jsonTree
      ? QbUtils.Validation.sanitizeTree(QbUtils.loadTree(jsonTree), config)
          .fixedTree
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
        tierOptions,
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

  const handleTreeUpdate = useCallback(
    (tree?: ImmutableTree) => {
      navigate({
        pathname: location.pathname,
        search: Qs.stringify({
          ...parsedSearch,
          queryFilter: tree ? JSON.stringify(tree) : undefined,
          page: 1,
        }),
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

  // Reset all filters, quick filter and query filter
  const handleResetAllFilters = useCallback(() => {
    setQueryFilter(undefined);
    setSQLQuery('');
    navigate({
      pathname: location.pathname,
      search: Qs.stringify({
        quickFilter: undefined,
        queryFilter: undefined,
        page: 1,
      }),
    });
  }, [navigate, location.pathname]);

  const fetchCustomPropertyType = async () => {
    const subfields: Record<string, Field> = {};

    try {
      const res = await getAllCustomProperties();

      Object.entries(res).forEach(([entityType, fields]) => {
        if (Array.isArray(fields) && fields.length > 0) {
          // Create nested subfields for each entity type (e.g., table, database, etc.)
          const entitySubfields: Record<string, Field> = {};

          fields.forEach((field) => {
            if (field.name && field.type) {
              const { subfieldsKey, dataObject } =
                advancedSearchClassBase.getCustomPropertiesSubFields(field);

              entitySubfields[subfieldsKey] = {
                ...dataObject,
                valueSources: dataObject.valueSources as ValueSource[],
              };
            }
          });

          // Only create the entity type field if it has custom properties
          if (!isEmpty(entitySubfields)) {
            subfields[entityType] = {
              label: entityType.charAt(0).toUpperCase() + entityType.slice(1),
              type: '!group',
              subfields: entitySubfields,
            } as Field;
          }
        }
      });
    } catch {
      return subfields;
    }

    return subfields;
  };

  const loadData = async () => {
    const actualConfig = getTreeConfig({
      searchIndex: searchIndex,
      searchOutputType: searchOutputType,
      isExplorePage,
      tierOptions,
    });

    let extensionSubField = customProps;
    if (extensionSubField === null) {
      extensionSubField = await fetchCustomPropertyType();
      setCustomProps(extensionSubField);
    }

    if (
      !isEmpty(extensionSubField) &&
      'subfields' in actualConfig.fields.extension
    ) {
      actualConfig.fields.extension.subfields = extensionSubField;
    }

    // Update field type if field override is provided
    // For example type of extension is group but it is required as struct in some cases
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
    loadData();
  }, [searchOutputType, searchIndex]);

  useEffect(() => {
    if (!initialised) {
      return;
    }
    if (jsonTree) {
      loadTree(jsonTree);
    } else {
      handleReset();
    }

    setLoading(false);
  }, [jsonTree, initialised]);

  const handleSubmit = useCallback(() => {
    const qFilter = {
      query: elasticSearchFormat(treeInternal, config),
    };
    setQueryFilter(qFilter);
    setSQLQuery(
      treeInternal ? QbUtils.sqlFormat(treeInternal, config) ?? '' : ''
    );

    updateURL && handleTreeUpdate(treeInternal);
    setShowModal(false);
  }, [treeInternal, config, handleTreeUpdate, updateURL]);

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
      handleResetAllFilters,
      changeSearchIndex,
      handleSubmit,
      modalProps,
    ]
  );

  return (
    <AdvancedSearchContext.Provider value={contextValues}>
      {loading ? <Loader /> : children}
      <AdvancedSearchModal
        visible={showModal}
        onCancel={() => setShowModal(false)}
        onSubmit={handleSubmit}
      />
    </AdvancedSearchContext.Provider>
  );
};

export const useAdvanceSearch = () => useContext(AdvancedSearchContext);
