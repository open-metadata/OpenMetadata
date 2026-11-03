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
import { Table, TableType } from '../generated/entity/data/table';
import { searchQuery } from '../rest/searchAPI';
import { getTableDetailsByFQN } from '../rest/tableAPI';
import {
  findShardedFamilies,
  getBigQuerySourceLink,
  parseShardName,
} from './TableShardingUtils';

jest.mock('../rest/searchAPI');
jest.mock('../rest/tableAPI');

const family = {
  id: 'family',
  columns: [],
  name: 'events_yyyymmdd',
  fullyQualifiedName: 'demo_service.demo_project.demo_dataset.events_yyyymmdd',
  tableType: TableType.Sharded,
  tableSharding: {
    prefix: 'events_',
    suffixFormat: 'YYYYMMDD',
    shardCount: 2,
    firstShardDate: new Date('2026-01-01'),
    lastShardDate: new Date('2026-01-02'),
    representative: {
      databaseName: 'demo_project',
      schemaName: 'demo_dataset',
      tableName: 'events_20260102',
      shardDate: new Date('2026-01-02'),
    },
  },
} as Table;

beforeEach(() => jest.resetAllMocks());

it.each([
  ['events_20260101', 'events_'],
  ['events20260101', 'events'],
  ['20260101', ''],
  ['events_intraday_20240229', 'events_intraday_'],
  ['events_20260101$20260102', 'events_'],
])('parses the exact native prefix of %s', (name, prefix) => {
  expect(parseShardName(name)?.prefix).toBe(prefix);
});

it.each([
  'events_20260230',
  'events_202601010',
  'events$20260101',
  'events_yyyymmdd',
])('rejects %s', (name) => {
  expect(parseShardName(name)).toBeUndefined();
});

it('keeps nested query and post filters and uses its own bounded first page after rollover', async () => {
  const queryFilter = {
    query: {
      bool: {
        should: [{ term: { 'owners.id': 'owner' } }],
        minimum_should_match: 1,
      },
    },
  };
  const postFilter = { query: { term: { 'tags.tagFQN': 'Demo.Tag' } } };
  (searchQuery as jest.Mock).mockResolvedValue({
    hits: { hits: [{ _source: family }, { _source: family }] },
  });
  (getTableDetailsByFQN as jest.Mock).mockResolvedValue(family);
  const result = await findShardedFamilies(
    'demo_service.demo_project.demo_dataset.events_20260101',
    queryFilter,
    postFilter
  );

  expect(result).toEqual([family]);
  expect(searchQuery).toHaveBeenCalledWith(
    expect.objectContaining({
      pageNumber: 1,
      pageSize: 10,
      postFilter,
      queryFilter: {
        query: {
          bool: {
            must: [
              queryFilter.query,
              { term: { serviceType: 'BigQuery' } },
              { term: { tableType: 'Sharded' } },
              { term: { 'name.keyword': 'events_yyyymmdd' } },
              { term: { 'service.name': 'demo_service' } },
              { term: { 'database.name': 'demo_project' } },
              { term: { 'databaseSchema.name': 'demo_dataset' } },
            ],
          },
        },
      },
    })
  );
});

it('resolves quoted physical identifiers using unquoted catalog names', async () => {
  (searchQuery as jest.Mock).mockImplementation(async ({ queryFilter }) => {
    const terms = queryFilter.query.bool.must;
    const names = Object.assign(
      {},
      ...terms.map(({ term }: { term: Record<string, string> }) => term)
    );
    const matches =
      names['service.name'] === 'demo.service' &&
      names['database.name'] === 'demo.project' &&
      names['databaseSchema.name'] === 'demo.dataset' &&
      names['name.keyword'] === 'events_yyyymmdd';

    return { hits: { hits: matches ? [{ _source: family }] : [] } };
  });
  (getTableDetailsByFQN as jest.Mock).mockResolvedValue(family);

  expect(
    await findShardedFamilies(
      '"demo.service"."demo.project"."demo.dataset"."events_20260101"'
    )
  ).toEqual([family]);
});

it('omits ordinary placeholders and inaccessible verification reads', async () => {
  (searchQuery as jest.Mock).mockResolvedValue({
    hits: { hits: [{ _source: family }] },
  });
  (getTableDetailsByFQN as jest.Mock).mockResolvedValue({
    ...family,
    tableType: TableType.Regular,
  });

  expect(await findShardedFamilies('events_20260101')).toEqual([]);

  (getTableDetailsByFQN as jest.Mock).mockRejectedValue(
    new Error('unavailable')
  );

  expect(await findShardedFamilies('events_20260101')).toEqual([]);
});

it('does not rewrite full text or advanced expressions', async () => {
  expect(await findShardedFamilies('events_20260101 OR owner:demo')).toEqual(
    []
  );
  expect(searchQuery).not.toHaveBeenCalled();
});

it('links to the physical source with encoded identifiers', () => {
  const descriptor = family.tableSharding;

  expect(descriptor).toBeDefined();

  if (!descriptor) {
    throw new Error('Missing shard fixture');
  }
  const link = new URL(
    getBigQuerySourceLink({
      ...descriptor,
      representative: {
        ...descriptor.representative,
        databaseName: 'project+demo',
      },
    })
  );

  expect(link.searchParams.get('project')).toBe('project+demo');
  expect(link.searchParams.get('t')).toBe('events_20260102');
});
