/*
 *  Copyright 2021 Collate
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

import { isEmpty, isUndefined } from 'lodash';
import { FormatedTableData } from 'Models';
import PropTypes from 'prop-types';
import React, { ReactNode } from 'react';
import { PAGE_SIZE } from '../../constants/constants';
import { pluralize } from '../../utils/CommonUtils';
import {
  getOwnerFromId,
  getTierFromSearchTableTags,
} from '../../utils/TableUtils';
import ErrorPlaceHolderES from '../common/error-with-placeholder/ErrorPlaceHolderES';
import TableDataCard from '../common/table-data-card/TableDataCard';
import Loader from '../Loader/Loader';
import Onboarding from '../onboarding/Onboarding';
import Pagination from '../Pagination';
type SearchedDataProp = {
  children?: ReactNode;
  data: Array<FormatedTableData>;
  currentPage: number;
  isLoading?: boolean;
  paginate: (value: number) => void;
  totalValue: number;
  fetchLeftPanel?: () => ReactNode;
  showResultCount?: boolean;
  searchText?: string;
  showOnboardingTemplate?: boolean;
  showOnlyChildren?: boolean;
};

const ASSETS_NAME = [
  'table_name',
  'topic_name',
  'dashboard_name',
  'pipeline_name',
  'dbt_model_name',
];

const SearchedData: React.FC<SearchedDataProp> = ({
  children,
  data,
  currentPage,
  isLoading = false,
  paginate,
  showResultCount = false,
  showOnboardingTemplate = false,
  showOnlyChildren = false,
  searchText,
  totalValue,
}: SearchedDataProp) => {
  const highlightSearchResult = () => {
    return data.map((table, index) => {
      let tDesc = table.description;
      const highLightedTexts = !isEmpty(table.highlight?.description)
        ? table.highlight?.description.join(' ') || ''
        : '';
      const highlightTxtMatch = highLightedTexts.match(
        /<span(.*?)>(.*?)<\/span>/g
      );
      if (highlightTxtMatch) {
        const matchTextArr = highlightTxtMatch.map((val) =>
          val.replace(/<\/?span(.*?)>/g, '')
        );
        matchTextArr.forEach((text) => {
          const regEx = new RegExp(`\\b${text}\\b`, 'g');
          tDesc = tDesc.replace(
            regEx,
            `<span class="text-highlighter">${text}</span>`
          );
        });
      }

      let name = table.name;
      if (!isUndefined(table.highlight)) {
        const [assetName] = Object.keys(table.highlight).filter((name) =>
          ASSETS_NAME.includes(name)
        );
        name = !isEmpty(
          table.highlight?.[assetName as keyof FormatedTableData['highlight']]
        )
          ? (
              table.highlight?.[
                assetName as keyof FormatedTableData['highlight']
              ] as string[]
            ).join(' ')
          : name;
      }

      const matches = table.highlight
        ? Object.entries(table.highlight)
            .map((d) => ({
              key: d[0],
              value: d[1].length,
            }))
            .filter((d) => !ASSETS_NAME.includes(d.key))
        : [];

      return (
        <div className="tw-mb-3" key={index}>
          <TableDataCard
            description={tDesc}
            fullyQualifiedName={table.fullyQualifiedName}
            indexType={table.index}
            matches={matches}
            name={name}
            owner={getOwnerFromId(table.owner)?.name}
            serviceType={table.serviceType || '--'}
            tableType={table.tableType}
            tags={table.tags}
            tier={
              (table.tier || getTierFromSearchTableTags(table.tags))?.split(
                '.'
              )[1]
            }
            usage={table.weeklyPercentileRank}
          />
        </div>
      );
    });
  };

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <div data-testid="search-container">
          {totalValue > 0 || showOnboardingTemplate || showOnlyChildren ? (
            <>
              {children}
              {!showOnlyChildren ? (
                <>
                  {showResultCount && searchText ? (
                    <div className="tw-mb-1">
                      {pluralize(totalValue, 'result')}
                    </div>
                  ) : null}
                  {data.length > 0 ? (
                    <div
                      className="tw-grid tw-grid-rows-1 tw-grid-cols-1"
                      data-testid="search-results">
                      {highlightSearchResult()}
                      {totalValue > PAGE_SIZE && data.length > 0 && (
                        <Pagination
                          currentPage={currentPage}
                          paginate={paginate}
                          sizePerPage={PAGE_SIZE}
                          totalNumberOfValues={totalValue}
                        />
                      )}
                    </div>
                  ) : (
                    <Onboarding />
                  )}
                </>
              ) : null}
            </>
          ) : (
            <>
              {children}
              <ErrorPlaceHolderES query={searchText} type="noData" />
            </>
          )}
        </div>
      )}
    </>
  );
};

SearchedData.propTypes = {
  children: PropTypes.element,
  data: PropTypes.array.isRequired,
  currentPage: PropTypes.number.isRequired,
  isLoading: PropTypes.bool,
  paginate: PropTypes.func.isRequired,
  showResultCount: PropTypes.bool,
  showOnboardingTemplate: PropTypes.bool,
  searchText: PropTypes.string,
  totalValue: PropTypes.number.isRequired,
  fetchLeftPanel: PropTypes.func,
};

export default SearchedData;
