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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { getTableQueryByTableId } from 'rest/tableAPI';
import { Table } from '../../generated/entity/data/table';
import { withLoader } from '../../hoc/withLoader';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../Loader/Loader';
import QueryCard from './QueryCard';

interface TableQueriesProp {
  isTableDeleted?: boolean;
  tableId: string;
}

const TableQueries: FC<TableQueriesProp> = ({
  isTableDeleted,
  tableId,
}: TableQueriesProp) => {
  const [tableQueries, setTableQueries] = useState<Table['tableQueries']>([]);
  const [isQueriesLoading, setIsQueriesLoading] = useState(true);

  const fetchTableQuery = async () => {
    try {
      const queries = await getTableQueryByTableId(tableId);
      setTableQueries(queries.tableQueries ?? []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsQueriesLoading(false);
    }
  };

  useEffect(() => {
    setIsQueriesLoading(true);
    if (tableId && !isTableDeleted) {
      fetchTableQuery();
    } else {
      setIsQueriesLoading(false);
    }
  }, [tableId]);

  if (isQueriesLoading) {
    return <Loader />;
  }

  return (
    <Row className="p-xs" gutter={32} id="tablequeries">
      {tableQueries && !isEmpty(tableQueries) ? (
        <Col offset={3} span={18}>
          <div className="m-y-lg" data-testid="queries-container">
            {tableQueries.map((query, index) => (
              <QueryCard key={index} query={query} />
            ))}
          </div>
        </Col>
      ) : (
        <Col className="flex-center font-medium" span={24}>
          <div data-testid="no-queries">
            <ErrorPlaceHolder heading="queries" />
          </div>
        </Col>
      )}
    </Row>
  );
};

export default withLoader<TableQueriesProp>(TableQueries);
