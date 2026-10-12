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

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  IncidentGroupBy,
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import {
  renderWithQueryClient,
  runQueryNotificationsSynchronously,
} from '../../../../test/unit/test-utils';
import IncidentGroupDetail from './IncidentGroupDetail';
import { IncidentGroupFilters } from './IncidentGroups.types';

const mockList = getListTestCaseIncidentStatus as jest.Mock;
const mockOnBack = jest.fn();

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
  updateTestCaseIncidentById: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../rest/permissionAPI', () => ({
  getEntityPermissionByFqn: jest.fn().mockResolvedValue({
    permissions: ['EditStatus', 'EditAll', 'ViewAll'].map((operation) => ({
      operation,
      access: 'allow',
    })),
  }),
}));

jest.mock(
  '../../../DataQuality/IncidentManager/Severity/InlineSeverity.component',
  () => ({
    __esModule: true,
    default: ({ onSubmit }: { onSubmit: (severity?: string) => void }) => (
      <button data-testid="severity-chip" onClick={() => onSubmit('Severity2')}>
        severity
      </button>
    ),
  })
);

jest.mock('../../../common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <span>avatar</span>),
}));

const mockOnIncidentChange = jest.fn();

const GROUP: TestCaseIncidentGroup = {
  groupBy: IncidentGroupBy.Table,
  id: 'table-id',
  name: 'orders',
  fullyQualifiedName: 'svc.db.shop.orders',
  incidentCount: 1,
  severity: Severities.Severity2,
  firstSeen: 1755000000000,
  lastSeen: 1781000000000,
  testDefinitionCount: 2,
};

const mockOnClearFilters = jest.fn();

runQueryNotificationsSynchronously();

const renderDetail = (
  group: TestCaseIncidentGroup = GROUP,
  filters: IncidentGroupFilters = {
    status: [],
    severity: [],
    dateField: 'timestamp',
  }
) =>
  renderWithQueryClient(
    <MemoryRouter>
      <IncidentGroupDetail
        filters={filters}
        group={group}
        onBack={mockOnBack}
        onClearFilters={mockOnClearFilters}
        onIncidentChange={mockOnIncidentChange}
      />
    </MemoryRouter>
  );

jest.mock('../../../../utils/i18next/LocalUtil', () => ({
  ...jest.requireActual('../../../../utils/i18next/LocalUtil'),
  Transi18next: ({
    i18nKey,
    values,
  }: {
    i18nKey: string;
    values: { count: number };
  }) => `${i18nKey}:${values.count}`,
}));

describe('IncidentGroupDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({
      data: [
        {
          id: 'incident-1',
          testCaseResolutionStatusType: TestCaseResolutionStatusTypes.ACK,
          testCaseReference: {
            id: 'case-1',
            type: 'testCase',
            name: 'orders_rows',
            fullyQualifiedName: 'svc.db.shop.orders.orders_rows',
          },
        },
      ],
      paging: { total: 20, after: 'cursor-2' },
    });
  });

  it('should head the view with the group and its summary', async () => {
    await act(async () => {
      renderDetail();
    });

    expect(screen.getByRole('heading', { name: 'orders' })).toBeInTheDocument();
    expect(screen.getByTestId('group-related')).toHaveTextContent(
      'label.type-count'
    );
    expect(screen.getByTestId('incident-group-summary')).toHaveTextContent(
      'label.incident-count:1 · message.incident-group-seen-range'
    );
  });

  it('should say a failed read in place, not as no incidents, and retry it', async () => {
    mockList.mockRejectedValueOnce(new Error('failure'));

    await act(async () => {
      renderDetail();
    });

    expect(
      screen.getByTestId('incident-group-incidents-error')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('incident-list-empty')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.retry' }));
    });

    expect(mockList).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('incident-row-incident-1')).toBeInTheDocument();
  });

  it('should list every incident of the group, a full page at a time', async () => {
    await act(async () => {
      renderDetail();
    });

    expect(screen.getByTestId('incident-row-incident-1')).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        originEntityFQN: 'svc.db.shop.orders',
        limit: 15,
      })
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('next'));
    });

    expect(mockList).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 })
    );
  });

  it('should move focus to the view it opened', async () => {
    await act(async () => {
      renderDetail();
    });

    expect(screen.getByTestId('incident-group-detail-heading')).toHaveFocus();
  });

  it('should go back to the groups from the back button and the breadcrumb', async () => {
    await act(async () => {
      renderDetail();
    });

    fireEvent.click(screen.getByTestId('incident-group-back'));

    expect(mockOnBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('label.incident-manager'));

    expect(mockOnBack).toHaveBeenCalledTimes(2);
  });

  it('should count several incidents in the plural', async () => {
    await act(async () => {
      renderDetail({ ...GROUP, incidentCount: 5, firstSeen: undefined });
    });

    expect(screen.getByTestId('incident-group-summary')).toHaveTextContent(
      'label.incident-count:5'
    );
  });

  it('should say the list is filtered, and clear the filters on request', async () => {
    await act(async () => {
      renderDetail(GROUP, {
        status: [TestCaseResolutionStatusTypes.New],
        severity: [],
        dateField: 'timestamp',
      });
    });

    expect(
      screen.getByTestId('incident-group-detail-filtered')
    ).toHaveTextContent('message.incident-group-filtered');

    fireEvent.click(screen.getByTestId('incident-group-detail-clear-filters'));

    expect(mockOnClearFilters).toHaveBeenCalledTimes(1);
  });

  it('should not flag an unfiltered list', async () => {
    await act(async () => {
      renderDetail();
    });

    expect(
      screen.queryByTestId('incident-group-detail-filtered')
    ).not.toBeInTheDocument();
  });

  it('should re-read its incidents and flag the groups stale after a row change', async () => {
    await act(async () => {
      renderDetail();
    });
    await waitFor(() =>
      expect(screen.getByTestId('severity-chip')).toBeInTheDocument()
    );
    const reads = mockList.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByTestId('severity-chip'));
    });

    expect(mockOnIncidentChange).toHaveBeenCalledTimes(1);
    expect(mockList.mock.calls.length).toBeGreaterThan(reads);
  });
});
