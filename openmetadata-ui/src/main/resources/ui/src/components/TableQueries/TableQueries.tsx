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

import { isUndefined } from 'lodash';
import React, { FC, HTMLAttributes } from 'react';
import { Table } from '../../generated/entity/data/table';
import { withLoader } from '../../hoc/withLoader';
import QueryCard from './QueryCard';

interface TableQueriesProp extends HTMLAttributes<HTMLDivElement> {
  queries: Table['tableQueries'];
}

const TableQueries: FC<TableQueriesProp> = ({ queries, className }) => {
  return (
    <div className={className}>
      <div className="tw-my-6" data-testid="queries-container">
        {!isUndefined(queries) && queries.length > 0 ? (
          queries.map((query, index) => <QueryCard key={index} query={query} />)
        ) : (
          <div
            className="tw-mt-4 tw-ml-4 tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8"
            data-testid="no-queries">
            <span>No queries data available.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default withLoader<TableQueriesProp>(TableQueries);
