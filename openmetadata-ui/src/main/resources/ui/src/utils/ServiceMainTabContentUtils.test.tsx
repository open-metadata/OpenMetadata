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
import { render } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  ColumnsType,
  ColumnType,
} from '../components/common/Table/Table.interface';
import { NO_DATA_PLACEHOLDER } from '../constants/constants';
import { ServiceCategory } from '../enums/service.enum';
import { UsageDetails } from '../generated/type/entityUsage';
import { ServicePageData } from '../interface/platform/service.interface';
import { getServiceMainTabColumns } from './ServiceMainTabContentUtils';
import { getUsagePercentile } from './TablePureUtils';

// Mock the `*TableObject` helpers so the columns array only contains the
// columns the function under test defines inline (name + service-category-
// specific ones). Without this the live TableColumn.util imports would pollute
// the array with tag/owner/etc columns that aren't relevant to the assertions.
jest.mock('./TableColumn.util', () => ({
  certificationTableObject: jest.fn().mockReturnValue([]),
  dataProductTableObject: jest.fn().mockReturnValue([]),
  descriptionTableObject: jest.fn().mockReturnValue([]),
  domainTableObject: jest.fn().mockReturnValue([]),
  ownerTableObject: jest.fn().mockReturnValue([]),
  tagTableObject: jest.fn().mockReturnValue([]),
  tierTableObject: jest.fn().mockReturnValue([]),
}));

// Mock `getUsagePercentile` to a deterministic string so assertions don't
// reach into the i18n mock. The bug under test is about which render branch
// fires (placeholder vs. real value), not ordinalize's suffix logic.
jest.mock('./TablePureUtils', () => ({
  getUsagePercentile: jest.fn((pctRank: number) => `PCTILE:${pctRank}`),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

jest.mock('../components/common/DisplayName/DisplayName', () => ({
  __esModule: true,
  default: () => <span data-testid="display-name" />,
}));

const USAGE_COLUMN_TITLE = 'label.usage';

type UsageColumn = Omit<ColumnType<ServicePageData>, 'render'> & {
  render: NonNullable<ColumnType<ServicePageData>['render']>;
};

const isUsageColumn = (
  c: ColumnsType<ServicePageData>[number]
): c is UsageColumn =>
  'dataIndex' in c &&
  typeof c.title === 'string' &&
  c.title === USAGE_COLUMN_TITLE &&
  typeof c.render === 'function';

const findUsageColumn = (): UsageColumn => {
  const columns = getServiceMainTabColumns(
    ServiceCategory.DATABASE_SERVICES,
    undefined,
    undefined,
    undefined,
    true
  );

  const col = columns.find(isUsageColumn);

  if (!col) {
    throw new Error('Usage column was not present in the columns array');
  }

  return col;
};

const renderCell = (node: ReactNode) => render(<>{node}</>).container;

const hasUsageColumn = (columns: ColumnsType<ServicePageData>) =>
  columns.some(isUsageColumn);

describe('getServiceMainTabColumns — Usage column', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes the Usage column for DATABASE_SERVICES when viewUsagePermission is true', () => {
    expect(
      hasUsageColumn(
        getServiceMainTabColumns(
          ServiceCategory.DATABASE_SERVICES,
          undefined,
          undefined,
          undefined,
          true
        )
      )
    ).toBe(true);
  });

  it('omits the Usage column for DATABASE_SERVICES when viewUsagePermission is false', () => {
    // Without ViewUsage the column should not appear at all, so users who
    // can never have received usage data do not see a column whose every
    // row would otherwise read "0th pctile".
    expect(
      hasUsageColumn(
        getServiceMainTabColumns(
          ServiceCategory.DATABASE_SERVICES,
          undefined,
          undefined,
          undefined,
          false
        )
      )
    ).toBe(false);
  });

  it('omits the Usage column for non-DATABASE service categories', () => {
    expect(
      hasUsageColumn(
        getServiceMainTabColumns(
          ServiceCategory.MESSAGING_SERVICES,
          undefined,
          undefined,
          undefined,
          true
        )
      )
    ).toBe(false);
  });

  it('renders NO_DATA_PLACEHOLDER (not "0th pctile") when usageSummary is undefined', () => {
    // Regression: a row whose usageSummary is absent must show the
    // placeholder, never the fabricated "0th pctile" the `?? 0` coercion
    // produced.
    const usageColumn = findUsageColumn();

    const container = renderCell(
      usageColumn.render(undefined, {} as ServicePageData, 0) as ReactNode
    );

    expect(container.textContent).toBe(NO_DATA_PLACEHOLDER);
    expect(getUsagePercentile).not.toHaveBeenCalled();
  });

  it('renders getUsagePercentile(0) — a legitimate 0th-percentile rank — not the placeholder', () => {
    // The fix must not blanket-treat 0 as "no data". A real percentileRank
    // of exactly 0 must still render the rank — conflating "missing" with
    // a real 0 is the original defect.
    const usageColumn = findUsageColumn();

    const container = renderCell(
      usageColumn.render(
        {
          weeklyStats: { percentileRank: 0 },
        } as UsageDetails,
        {} as ServicePageData,
        0
      ) as ReactNode
    );

    expect(container.textContent).toBe('PCTILE:0');
    expect(getUsagePercentile).toHaveBeenCalledWith(0);
    expect(getUsagePercentile).toHaveBeenCalledTimes(1);
  });
});

describe('getServiceMainTabColumns — Name column sorting', () => {
  const sortByName = (rows: Partial<ServicePageData>[]) => {
    const nameColumn = getServiceMainTabColumns(
      ServiceCategory.DASHBOARD_SERVICES
    )[0];
    const sorter = nameColumn.sorter as (
      a: ServicePageData,
      b: ServicePageData
    ) => number;

    return [...(rows as ServicePageData[])].sort(sorter).map((r) => r.id);
  };

  it('sorts by displayName rather than the source-ID name', () => {
    expect(
      sortByName([
        { id: 'b', name: '0121e59d-guid', displayName: 'Sales Report' },
        { id: 'a', name: 'f90a1c2e-guid', displayName: 'Inventory Report' },
      ])
    ).toEqual(['a', 'b']);
  });

  it('falls back to name when displayName is empty', () => {
    expect(
      sortByName([
        { id: 'b', name: 'zeta', displayName: '' },
        { id: 'a', name: 'alpha' },
        { id: 'c', name: '0000-guid', displayName: 'Middle' },
      ])
    ).toEqual(['a', 'c', 'b']);
  });
});
