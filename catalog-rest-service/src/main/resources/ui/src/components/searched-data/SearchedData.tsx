/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { FormatedTableData } from 'Models';
import PropTypes from 'prop-types';
import React, { ReactNode } from 'react';
import { PAGE_SIZE } from '../../constants/constants';
import { pluralize } from '../../utils/CommonUtils';
import {
  getOwnerFromId,
  getTierFromSearchTableTags,
} from '../../utils/TableUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import TableDataCard from '../common/table-data-card/TableDataCard';
import PageContainer from '../containers/PageContainer';
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
};
const SearchedData: React.FC<SearchedDataProp> = ({
  children,
  data,
  currentPage,
  isLoading = false,
  paginate,
  showResultCount = false,
  showOnboardingTemplate = false,
  searchText,
  totalValue,
  fetchLeftPanel,
}) => {
  return (
    <>
      <PageContainer leftPanelContent={fetchLeftPanel && fetchLeftPanel()}>
        <div className="container-fluid" data-testid="fluid-container">
          {isLoading ? (
            <Loader />
          ) : (
            <>
              {totalValue > 0 || showOnboardingTemplate ? (
                <>
                  {children}
                  {showResultCount && searchText ? (
                    <div className="tw-mb-1">
                      {pluralize(totalValue, 'result')}
                    </div>
                  ) : null}
                  {data.length > 0 ? (
                    <div className="tw-grid tw-grid-rows-1 tw-grid-cols-1">
                      {data.map((table, index) => (
                        <div className="tw-mb-3" key={index}>
                          <TableDataCard
                            description={table.description}
                            fullyQualifiedName={table.fullyQualifiedName}
                            name={table.name}
                            owner={getOwnerFromId(table.owner)?.name}
                            serviceType={table.serviceType || '--'}
                            tableType={table.tableType}
                            tags={table.tags}
                            tier={
                              (
                                table.tier ||
                                getTierFromSearchTableTags(table.tags)
                              )?.split('.')[1]
                            }
                            usage={table.weeklyPercentileRank}
                          />
                        </div>
                      ))}

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
              ) : (
                <ErrorPlaceHolder />
              )}
            </>
          )}
        </div>
      </PageContainer>
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
