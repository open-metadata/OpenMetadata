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
import { render, screen } from '@testing-library/react';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { TableShardingWidget } from './TableSharding';

jest.mock('../../../components/Customization/GenericProvider/GenericContext');

it('renders the current representative without inventing metadata freshness', () => {
  (useGenericContext as jest.Mock).mockReturnValue({
    data: {
      tableType: 'Sharded',
      tableSharding: {
        prefix: 'events_',
        shardCount: 2,
        firstShardDate: '2026-01-01',
        lastShardDate: '2026-01-02',
        representative: {
          databaseName: 'demo_project',
          schemaName: 'demo_dataset',
          tableName: 'events_20260102',
        },
      },
    },
  });
  render(<TableShardingWidget />);

  expect(screen.getByRole('link', { name: 'events_20260102' })).toHaveAttribute(
    'href',
    expect.stringContaining('t=events_20260102')
  );
  expect(screen.getByText('Jan 1, 2026 – Jan 2, 2026')).toBeInTheDocument();
});

it('does not display a sharding widget for an ordinary table', () => {
  (useGenericContext as jest.Mock).mockReturnValue({
    data: { tableType: 'Regular' },
  });
  render(<TableShardingWidget />);

  expect(screen.queryByTestId('table-sharding')).not.toBeInTheDocument();
});
