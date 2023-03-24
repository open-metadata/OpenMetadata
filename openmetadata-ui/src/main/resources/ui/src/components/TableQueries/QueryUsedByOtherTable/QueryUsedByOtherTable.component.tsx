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
import { Popover, Space, Typography } from 'antd';
import { getTableDetailsPath } from 'constants/constants';
import { QUERY_USED_BY_TABLE_VIEW_CAP } from 'constants/Query.constant';
import { slice } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import {
  QueryUsedByOtherTableProps,
  QueryUsedByTable,
} from '../TableQueries.interface';

const { Text, Paragraph } = Typography;

const QueryUsedByOtherTable = ({
  query,
  tableId,
}: QueryUsedByOtherTableProps) => {
  const { t } = useTranslation();
  const { topThreeTable, remainingTable } = useMemo(() => {
    const { queryUsedIn } = query;
    const filterTable =
      queryUsedIn?.filter((table) => table.id !== tableId) || [];
    const data: QueryUsedByTable = {
      topThreeTable: [],
      remainingTable: [],
    };

    if (filterTable.length) {
      // Slice 3 table to display upfront in UI
      data.topThreeTable = slice(filterTable, 0, QUERY_USED_BY_TABLE_VIEW_CAP);
      if (filterTable.length > QUERY_USED_BY_TABLE_VIEW_CAP) {
        // Slice remaining tables to show in "view more"
        data.remainingTable = slice(filterTable, QUERY_USED_BY_TABLE_VIEW_CAP);
      }
    }

    return data;
  }, [query]);

  return (
    <Paragraph className="m-b-0">
      <Text>{`${t('message.query-used-by-other-tables')}: `} </Text>
      {topThreeTable.length
        ? topThreeTable.map((table, index) => (
            <Text className="m-r-xss" key={table.name}>
              <Link to={getTableDetailsPath(table.fullyQualifiedName || '')}>
                {getEntityName(table)}
              </Link>
              {topThreeTable.length - 1 !== index && ','}
            </Text>
          ))
        : '--'}
      {remainingTable.length ? (
        <>
          <Text className="m-r-xss">{t('label.and-lowercase')}</Text>
          <Popover
            content={
              <Space direction="vertical">
                {remainingTable.map((table) => (
                  <Link
                    key={table.name}
                    to={getTableDetailsPath(table.fullyQualifiedName || '')}>
                    {getEntityName(table)}
                  </Link>
                ))}
              </Space>
            }
            placement="bottom"
            trigger="click">
            <Text className="show-more">
              {`${remainingTable.length} ${t('label.more-lowercase')}`}
            </Text>
          </Popover>
        </>
      ) : null}
    </Paragraph>
  );
};

export default QueryUsedByOtherTable;
