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
import { compare } from 'fast-json-patch';
import { Query } from 'generated/entity/data/query';
import { isUndefined } from 'lodash';
import React, { FC, useEffect, useState } from 'react';
import { getQueriesList, patchQueries } from 'rest/queryAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import Loader from '../Loader/Loader';
import QueryCard from './QueryCard';
import TableQueryRightPanel from './TableQueryRightPanel/TableQueryRightPanel.component';

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
      const queries = await getQueriesList({
        entityId: tableId,
        fields: 'owner,vote,tags,queryUsedIn',
      });
      setTableQueries(queries.data);
      setSelectedQuery(queries.data[0]);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsQueriesLoading(false);
    }
  };

  const handleQueryUpdate = async (updatedQuery: Query) => {
    if (isUndefined(selectedQuery)) {
      return;
    }

    const jsonPatch = compare(selectedQuery, updatedQuery);

    try {
      const res = await patchQueries(selectedQuery.id || '', jsonPatch);
      setSelectedQuery(res);
      setTableQueries((pre) => {
        return pre.map((query) => (query.id === updatedQuery.id ? res : query));
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleSelectedQuery = (query: Query) => {
    setSelectedQuery(query);
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
    <Row id="tablequeries">
      {tableQueries.length && !isUndefined(selectedQuery) ? (
        <>
          <Col span={18}>
            <div className="m-y-lg m-r-lg" data-testid="queries-container">
              {tableQueries.map((query, index) => (
                <QueryCard
                  key={index}
                  query={query}
                  onQuerySelection={handleSelectedQuery}
                />
              ))}
            </div>
          </Col>
          <Col className="bg-white" span={6}>
            <div className="sticky top-0">
              <TableQueryRightPanel
                query={selectedQuery}
                onQueryUpdate={handleQueryUpdate}
              />
            </div>
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
