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

import classNames from 'classnames';
import { isNumber } from 'lodash';
import Qs from 'qs';
import { useMemo } from 'react';
import { MAX_RESULT_HITS } from '../../constants/explore.constants';
import { ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { useCurrentUserPreferences } from '../../hooks/currentUserStore/useCurrentUserStore';
import { pluralize } from '../../utils/CommonUtils';
import { highlightEntityNameAndDescription } from '../../utils/EntityUtils';
import ErrorPlaceHolderES from '../common/ErrorWithPlaceholder/ErrorPlaceHolderES';
import Loader from '../common/Loader/Loader';
import ExploreSearchCard from '../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import PaginationComponent from '../PaginationComponent/PaginationComponent';
import { SearchedDataProps } from './SearchedData.interface';

const ASSETS_NAME = [
  'table_name',
  'topic_name',
  'dashboard_name',
  'pipeline_name',
];

const SearchedData: React.FC<SearchedDataProps> = ({
  children,
  data,
  isLoading = false,
  onPaginationChange,
  showResultCount = false,
  totalValue,
  isFilterSelected,
  isSummaryPanelVisible,
  selectedEntityId,
  handleSummaryPanelDisplay,
  filter,
}) => {
  const {
    preferences: { globalPageSize },
  } = useCurrentUserPreferences();

  const searchResultCards = useMemo(() => {
    return data.map(({ _source: table, highlight }, index) => {
      const matches = highlight
        ? Object.entries(highlight)
            .filter(([key]) => !key.includes('.ngram'))
            .map(([key, value]) => ({ key, value: value?.length || 1 }))
            .filter((d) => !ASSETS_NAME.includes(d.key))
        : [];

      const source = highlightEntityNameAndDescription(table, highlight);

      return (
        <div className="m-b-md" key={`tabledatacard${index}`}>
          <ExploreSearchCard
            className={classNames(
              table.id === selectedEntityId && isSummaryPanelVisible
                ? 'highlight-card'
                : ''
            )}
            handleSummaryPanelDisplay={handleSummaryPanelDisplay}
            id={`tabledatacard${index}`}
            matches={matches}
            showTags={false}
            source={source}
          />
        </div>
      );
    });
  }, [
    data,
    isSummaryPanelVisible,
    handleSummaryPanelDisplay,
    selectedEntityId,
  ]);

  const ResultCount = () => {
    if (showResultCount && (isFilterSelected || filter?.quickFilter)) {
      if (MAX_RESULT_HITS === totalValue) {
        return <div>{`About ${totalValue} results`}</div>;
      } else {
        return <div>{pluralize(totalValue, 'result')}</div>;
      }
    } else {
      return null;
    }
  };

  const { page = 1, size = globalPageSize } = useMemo(
    () =>
      Qs.parse(
        location.search.startsWith('?')
          ? location.search.substring(1)
          : location.search
      ),
    [location.search]
  );

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="h-full" data-testid="search-container">
          {totalValue > 0 ? (
            <>
              {children}
              <ResultCount />
              <div data-testid="search-results">
                {searchResultCards}
                <PaginationComponent
                  className="text-center p-b-box"
                  current={isNumber(Number(page)) ? Number(page) : 1}
                  pageSize={
                    size && isNumber(Number(size))
                      ? Number(size)
                      : globalPageSize
                  }
                  total={totalValue}
                  onChange={onPaginationChange}
                />
              </div>
            </>
          ) : (
            <div className="flex-center h-full">
              {children}
              <ErrorPlaceHolderES
                query={filter}
                type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.NO_DATA}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SearchedData;
