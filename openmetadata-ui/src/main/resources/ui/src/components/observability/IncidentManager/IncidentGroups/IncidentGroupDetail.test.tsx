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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  IncidentGroupBy,
  Severities,
  TestCaseIncidentGroup,
} from '../../../../generated/tests/testCaseIncidentGroup';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import { getListTestCaseIncidentStatus } from '../../../../rest/incidentManagerAPI';
import IncidentGroupDetail from './IncidentGroupDetail';

const mockList = getListTestCaseIncidentStatus as jest.Mock;
const mockOnBack = jest.fn();

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatus: jest.fn(),
}));

jest.mock('../../../common/ProfilePicture/ProfilePicture', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <span>avatar</span>),
}));

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

const renderDetail = (group: TestCaseIncidentGroup = GROUP) =>
  render(
    <MemoryRouter>
      <IncidentGroupDetail
        filters={{ status: [], dateField: 'timestamp' }}
        group={group}
        onBack={mockOnBack}
      />
    </MemoryRouter>
  );

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
      paging: { total: 12, after: 'cursor-2' },
    });
  });

  it('should head the view with the group and its summary', async () => {
    await act(async () => {
      renderDetail();
    });

    expect(screen.getByRole('heading', { name: 'orders' })).toBeInTheDocument();
    expect(screen.getByTestId('group-related')).toHaveTextContent(
      '2 label.type-lowercase-plural'
    );
    expect(screen.getByTestId('incident-group-summary')).toHaveTextContent(
      '1 label.incident-lowercase · message.incident-group-seen-range'
    );
  });

  it('should list every incident of the group, a full page at a time', async () => {
    await act(async () => {
      renderDetail();
    });

    expect(screen.getByTestId('incident-row-incident-1')).toBeInTheDocument();
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        originEntityFQN: 'svc.db.shop.orders',
        limit: 10,
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
      '5 label.incident-lowercase-plural'
    );
  });
});
