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
import { Query } from 'generated/entity/data/query';
import { isEmpty } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { getQueriesList } from 'rest/queryAPI';
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
  const [tableQueries, setTableQueries] = useState<Query[]>([]);
  const [isQueriesLoading, setIsQueriesLoading] = useState(true);
  const [selectedQuery, setSelectedQuery] = useState<Query>();

  const fetchTableQuery = async () => {
    try {
      const queries = await getQueriesList({ entityId: tableId });
      setTableQueries(queries.data);
      setSelectedQuery(queries.data[0]);
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
        <>
          <Col span={18}>
            <div className="m-y-lg" data-testid="queries-container">
              {tableQueries.map((query, index) => (
                <QueryCard key={index} query={query} />
              ))}
            </div>
          </Col>
          <Col className="bg-white" span={6}>
            {selectedQuery?.query}
          </Col>
        </>
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

export default TableQueries;
