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
import {
  emptyJsonTree,
  getQbConfigs,
} from 'constants/AdvancedSearch.constants';
import { tabsInfo } from 'constants/explore.constants';
import { SearchIndex } from 'enums/search.enum';
import { isNil, isString } from 'lodash';
import Qs from 'qs';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Config,
  ImmutableTree,
  JsonTree,
  Utils as QbUtils,
} from 'react-awesome-query-builder';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { elasticSearchFormat } from '../../../utils/QueryBuilderElasticsearchFormatUtils';
import { AdvancedSearchModal } from '../AdvanceSearchModal.component';
import { ExploreSearchIndex, UrlParams } from '../explore.interface';
import {
  AdvanceSearchContext,
  AdvanceSearchProviderProps,
} from './AdvanceSearchProvider.interface';

const AdvancedSearchContext = React.createContext<AdvanceSearchContext>(
  {} as AdvanceSearchContext
);

export const AdvanceSearchProvider = ({
  children,
}: AdvanceSearchProviderProps) => {
  const location = useLocation();
  const history = useHistory();
  const { tab } = useParams<UrlParams>();

  const searchIndex = useMemo(() => {
    const tabInfo = Object.entries(tabsInfo).find(
      ([, tabInfo]) => tabInfo.path === tab
    );
    if (isNil(tabInfo)) {
      return SearchIndex.TABLE;
    }

    return tabInfo[0] as ExploreSearchIndex;
  }, [tab]);

  const parsedSearch = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.substr(1)
          : location.search
      ),
    [location.search]
  );

  const jsonTree = useMemo(() => {
    if (!isString(parsedSearch.queryFilter)) {
      return emptyJsonTree;
    }

    try {
      const filter = JSON.parse(parsedSearch.queryFilter);
      const immutableTree = QbUtils.loadTree(filter as JsonTree);
      if (QbUtils.isValidTree(immutableTree)) {
        return filter as JsonTree;
      }
    } catch {
      return emptyJsonTree;
    }

    return emptyJsonTree;
  }, [parsedSearch]);

  const [config, setConfig] = useState<Config>(getQbConfigs(searchIndex));
  const [treeInternal, setTreeInternal] = useState<ImmutableTree>(
    QbUtils.checkTree(QbUtils.loadTree(jsonTree), config)
  );
  const [queryFilter, setQueryFilter] = useState<
    Record<string, unknown> | undefined
  >({
    query: elasticSearchFormat(treeInternal, config),
  });
  const [sqlQuery, setSQLQuery] = useState(
    treeInternal ? QbUtils.sqlFormat(treeInternal, config) ?? '' : ''
  );
  const [showModal, setShowModal] = useState(false);

  useEffect(() => setConfig(getQbConfigs(searchIndex)), [searchIndex]);

  const handleChange = useCallback(
    (nTree, nConfig) => {
      setConfig(nConfig);
      setTreeInternal(nTree);
    },
    [setConfig]
  );

  const handleTreeUpdate = useCallback(
    (tree?: ImmutableTree) => {
      history.push({
        pathname: location.pathname,
        search: Qs.stringify({
          ...parsedSearch,
          queryFilter: tree ? JSON.stringify(tree) : undefined,
          page: 1,
        }),
      });
    },
    [history, parsedSearch]
  );

  const toggleModal = (show: boolean) => {
    setShowModal(show);
  };

  const handleReset = useCallback(() => {
    setTreeInternal(QbUtils.checkTree(QbUtils.loadTree(emptyJsonTree), config));
  }, []);

  const handleSubmit = useCallback(() => {
    const qFilter = {
      query: elasticSearchFormat(treeInternal, config),
    };
    setQueryFilter(qFilter);
    setSQLQuery(
      treeInternal ? QbUtils.sqlFormat(treeInternal, config) ?? '' : ''
    );
    handleTreeUpdate(treeInternal);
    setShowModal(false);
  }, [treeInternal, config, handleTreeUpdate]);

  return (
    <AdvancedSearchContext.Provider
      value={{
        queryFilter,
        sqlQuery,
        onTreeUpdate: handleChange,
        toggleModal,
        treeInternal,
        config,
        onReset: handleReset,
      }}>
      {children}
      <AdvancedSearchModal
        jsonTree={jsonTree}
        searchIndex={searchIndex}
        visible={showModal}
        onCancel={() => setShowModal(false)}
        onSubmit={handleSubmit}
      />
    </AdvancedSearchContext.Provider>
  );
};

export const useAdvanceSearch = () => useContext(AdvancedSearchContext);
