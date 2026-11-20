/*
 *  Copyright 2024 Collate.
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
import { SearchIndex } from '../enums/search.enum';
import { Table, TableType } from '../generated/entity/data/table';
import { TableSharding } from '../generated/type/tableSharding';
import { searchQuery } from '../rest/searchAPI';
import { getTableDetailsByFQN } from '../rest/tableAPI';
import Fqn from './Fqn';

export const isShardedTable = (table?: Table): boolean =>
  table?.tableType === TableType.Sharded;

export const getTableSharding = (table?: Table): TableSharding | undefined =>
  table?.tableType === TableType.Sharded ? table.tableSharding : undefined;

export const parseShardName = (
  name: string
): { prefix: string; date: string; logicalName: string } | undefined => {
  const base = name.replace(/\$[0-9]{8}$/, '');
  if (base.includes('$')) {
    return undefined;
  }
  const match = /^(.*[^0-9])?([0-9]{4})([0-9]{2})([0-9]{2})$/.exec(base);
  if (!match) {
    return undefined;
  }
  const [, prefix = '', year, month, day] = match;
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    Number(year) === 0 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return undefined;
  }

  return { prefix, date, logicalName: `${prefix}yyyymmdd` };
};

export const getBigQuerySourceLink = (sharding: TableSharding): string => {
  const { databaseName, schemaName, tableName } = sharding.representative;

  return `https://console.cloud.google.com/bigquery?project=${encodeURIComponent(
    databaseName
  )}&p=${encodeURIComponent(databaseName)}&d=${encodeURIComponent(
    schemaName
  )}&t=${encodeURIComponent(tableName)}&page=table`;
};

export const findShardedFamilies = async (
  query: string,
  queryFilter?: Record<string, unknown>,
  postFilter?: Record<string, unknown>,
  includeDeleted = false,
  signal?: AbortSignal
): Promise<Table[]> => {
  if (
    !/^(?:"[^"\n]+"|[a-zA-Z0-9_$-]+)(?:\.(?:"[^"\n]+"|[a-zA-Z0-9_$-]+)){0,3}$/.test(
      query
    )
  ) {
    return [];
  }
  const parts = Fqn.split(query).map((part) => Fqn.unquoteName(part));
  const candidate = parseShardName(parts[parts.length - 1]);
  if (!candidate) {
    return [];
  }
  const qualifiers = [
    'service.name',
    'database.name',
    'databaseSchema.name',
  ].slice(4 - parts.length);
  const terms = [
    { term: { serviceType: 'BigQuery' } },
    { term: { tableType: 'Sharded' } },
    { term: { 'name.keyword': candidate.logicalName } },
    ...parts
      .slice(0, -1)
      .map((value, index) => ({ term: { [qualifiers[index]]: value } })),
  ];
  const response = await searchQuery({
    query: '',
    searchIndex: SearchIndex.TABLE,
    pageNumber: 1,
    pageSize: 10,
    includeDeleted,
    signal,
    queryFilter: {
      query: {
        bool: {
          must: [...(queryFilter?.query ? [queryFilter.query] : []), ...terms],
        },
      },
    },
    postFilter,
  });
  const tables = await Promise.all(
    response.hits.hits.slice(0, 10).map(async (hit) => {
      try {
        const name = hit._source.fullyQualifiedName;
        if (!name) {
          return undefined;
        }
        const table = await getTableDetailsByFQN(name, undefined, signal);
        const descriptor = getTableSharding(table);

        return descriptor?.prefix === candidate.prefix &&
          (!table.deleted || includeDeleted)
          ? table
          : undefined;
      } catch {
        return undefined;
      }
    })
  );

  return Array.from(
    new Map(
      tables
        .filter((table): table is Table => Boolean(table))
        .map((table) => [table.id, table])
    ).values()
  );
};
