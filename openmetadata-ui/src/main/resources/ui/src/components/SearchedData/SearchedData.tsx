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

import { Badge } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useCallback, useMemo } from 'react';
import { MAX_RESULT_HITS } from '../../constants/explore.constants';
import { ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { pluralize } from '../../utils/StringUtils';
import ErrorPlaceHolderES from '../common/ErrorWithPlaceholder/ErrorPlaceHolderES';
import Loader from '../common/Loader/Loader';
import ExploreSearchCard from '../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import { SearchedDataProps } from './SearchedData.interface';

const ASSETS_NAME = new Set([
  'table_name',
  'topic_name',
  'dashboard_name',
  'pipeline_name',
]);

const SearchedData: React.FC<SearchedDataProps> = ({
  children,
  data,
  isLoading = false,
  showResultCount = false,
  totalValue,
  isFilterSelected,
  isSummaryPanelVisible,
  selectedEntityId,
  handleSummaryPanelDisplay,
  filter,
}) => {
  const searchResultCards = useMemo(() => {
    return data.map(({ _source: table, highlight, _id }) => {
      const matches = highlight
        ? Object.entries(highlight)
            .filter(([key]) => !key.includes('.ngram'))
            .map(([key, value]) => ({ key, value: value?.length || 1 }))
            .filter((d) => !ASSETS_NAME.has(d.key))
        : [];

      return (
        <ExploreSearchCard
          showEntityIcon
          className={classNames(
            table.id === selectedEntityId && isSummaryPanelVisible
              ? 'highlight-card'
              : ''
          )}
          handleSummaryPanelDisplay={handleSummaryPanelDisplay}
          highlight={highlight}
          id={`search-card-${_id}`}
          key={_id}
          matches={matches}
          showTags={false}
          source={table}
        />
      );
    });
  }, [
    data,
    isSummaryPanelVisible,
    handleSummaryPanelDisplay,
    selectedEntityId,
  ]);

  const ResultCount = useCallback(
    (total: number) => {
      if (!showResultCount) {
        return null;
      }
      if (isFilterSelected || filter?.quickFilter) {
        if (MAX_RESULT_HITS === total) {
          return (
            <Badge color="blue" type="color">
              <span data-testid="search-results-count">{`${total} results`}</span>
            </Badge>
          );
        } else {
          return (
            <Badge color="blue" type="color">
              <span data-testid="search-results-count">
                {pluralize(total, 'result')}
              </span>
            </Badge>
          );
        }
      } else {
        return null;
      }
    },
    [isFilterSelected, filter, showResultCount]
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
              <div className="tw:mb-4">{ResultCount(totalValue)}</div>
              <div data-testid="search-results">{searchResultCards}</div>
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
