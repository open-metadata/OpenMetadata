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
import { MemoryRouter, useLocation } from 'react-router-dom';
import { IncidentGroupBy } from '../../../../generated/tests/testCaseIncidentGroup';
import { listIncidentGroups } from '../../../../rest/incidentManagerAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { IncidentGroupByDropdownProps } from './IncidentGroups.types';
import IncidentGroupsView from './IncidentGroupsView';

const mockListIncidentGroups = listIncidentGroups as jest.Mock;
const mockShowErrorToast = showErrorToast as jest.Mock;

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  listIncidentGroups: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('./IncidentGroupByDropdown', () =>
  jest
    .fn()
    .mockImplementation(({ value, onChange }: IncidentGroupByDropdownProps) => (
      <div>
        <span data-testid="selected-group-by">{value}</span>
        <button
          data-testid="select-owner"
          onClick={() => onChange('owner' as IncidentGroupBy)}>
          owner
        </button>
        <button
          data-testid="select-test-definition"
          onClick={() => onChange('testDefinition' as IncidentGroupBy)}>
          testDefinition
        </button>
      </div>
    ))
);

const LocationSearch = () => {
  const { search } = useLocation();

  return <span data-testid="location-search">{search}</span>;
};

const mockGroups = [
  {
    groupBy: IncidentGroupBy.TestDefinition,
    name: 'columnValuesToBeUnique',
    incidentCount: 5,
  },
];

const renderView = (initialEntry = '/observability/incident-manager') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <IncidentGroupsView>
        <div data-testid="incident-groups-table">Group table</div>
      </IncidentGroupsView>
      <LocationSearch />
    </MemoryRouter>
  );

describe('IncidentGroupsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListIncidentGroups.mockResolvedValue({
      data: mockGroups,
      paging: { total: 5 },
    });
  });

  it('should show the loader until the groups resolve', async () => {
    let resolveGroups: (value: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValue(
      new Promise((resolve) => {
        resolveGroups = resolve;
      })
    );

    renderView();

    expect(screen.getByTestId('incident-groups-loader')).toBeInTheDocument();

    await act(async () => {
      resolveGroups({ data: mockGroups, paging: { total: 5 } });
    });

    expect(
      screen.queryByTestId('incident-groups-loader')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();
  });

  it('should render the group count and the children once loaded', async () => {
    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-count')).toHaveTextContent(
      'label.group-count'
    );
    expect(screen.getByTestId('incident-groups-table')).toBeInTheDocument();
  });

  it('should render the empty state when no group is returned', async () => {
    mockListIncidentGroups.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-empty')).toBeInTheDocument();
    expect(
      screen.queryByTestId('incident-groups-table')
    ).not.toBeInTheDocument();
  });

  it('should render the error state when the fetch fails', async () => {
    mockListIncidentGroups.mockRejectedValue(new Error('failure'));

    await act(async () => {
      renderView();
    });

    expect(screen.getByTestId('incident-groups-error')).toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-count')).toBeEmptyDOMElement();
    expect(
      screen.queryByTestId('incident-groups-table')
    ).not.toBeInTheDocument();
  });

  it('should not raise an error toast for a request that settles after unmount', async () => {
    let rejectGroups: (reason: unknown) => void = jest.fn();
    mockListIncidentGroups.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectGroups = reject;
      })
    );

    const { unmount } = renderView();

    unmount();

    await act(async () => {
      rejectGroups(new Error('failure'));
    });

    expect(mockShowErrorToast).not.toHaveBeenCalled();
  });

  it('should fetch with the default dimension when the URL carries none', async () => {
    await act(async () => {
      renderView();
    });

    expect(mockListIncidentGroups).toHaveBeenCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
    });
    expect(screen.getByTestId('selected-group-by')).toHaveTextContent(
      IncidentGroupBy.TestDefinition
    );
  });

  it('should fetch with the dimension read from the URL', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=table');
    });

    expect(mockListIncidentGroups).toHaveBeenCalledWith({
      groupBy: IncidentGroupBy.Table,
      limit: 10,
    });
    expect(screen.getByTestId('selected-group-by')).toHaveTextContent(
      IncidentGroupBy.Table
    );
  });

  it('should fall back to the default dimension for an unknown URL value', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=unknown');
    });

    expect(mockListIncidentGroups).toHaveBeenCalledWith({
      groupBy: IncidentGroupBy.TestDefinition,
      limit: 10,
    });
  });

  it('should sync the dimension switch to the URL and refire the fetch', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=table&assignee=adam');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-owner'));
    });

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'groupBy=owner'
    );
    // Unrelated filters in the URL survive the switch.
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      'assignee=adam'
    );
    expect(mockListIncidentGroups).toHaveBeenCalledTimes(2);
    expect(mockListIncidentGroups).toHaveBeenLastCalledWith({
      groupBy: IncidentGroupBy.Owner,
      limit: 10,
    });
  });

  it('should not refire the fetch when the selected dimension is picked again', async () => {
    await act(async () => {
      renderView('/observability/incident-manager?groupBy=testDefinition');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-test-definition'));
    });

    expect(mockListIncidentGroups).toHaveBeenCalledTimes(1);
  });
});
