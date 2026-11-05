/*
 *  Copyright 2026 Collate.
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
import {
  chartTooltipRows,
  DQTooltipContent,
} from './CustomDQTooltip.component';

describe('DQTooltipContent', () => {
  it('renders the header and one row per series with formatted values', () => {
    render(
      <DQTooltipContent
        header="Jan 01"
        rows={[
          { key: 'rowCount', name: 'rowCount', value: 1200, color: '#111111' },
          { key: 'nullCount', name: 'nullCount', value: 3, color: '#222222' },
        ]}
        valueFormatter={(value) => `${value} rows`}
      />
    );

    expect(screen.getByText('Jan 01')).toBeInTheDocument();
    expect(screen.getByText('Row Count')).toBeInTheDocument();
    expect(screen.getByText('1200 rows')).toBeInTheDocument();
    expect(screen.getByText('3 rows')).toBeInTheDocument();
  });

  it('keeps labels as given when transformLabel is false', () => {
    render(
      <DQTooltipContent
        header="h"
        rows={[{ key: 'a', name: 'rowCount', value: 1 }]}
        transformLabel={false}
      />
    );

    expect(screen.getByText('rowCount')).toBeInTheDocument();
  });
});

describe('chartTooltipRows', () => {
  it('maps chart items to rows and drops gaps', () => {
    expect(
      chartTooltipRows([
        {
          seriesKey: 'insert',
          name: 'Insert',
          value: 4,
          color: '#1',
          dataIndex: 0,
        },
        {
          seriesKey: 'delete',
          name: 'Delete',
          value: null,
          color: '#2',
          dataIndex: 0,
        },
      ])
    ).toEqual([{ key: 'insert', name: 'Insert', value: 4, color: '#1' }]);
  });
});
