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

import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useIncidentManagerListPage } from '../../IncidentManager/useIncidentManagerListPage';
import IncidentManagerPage from './IncidentManagerPage';

const mockUseIncidentManagerListPage = useIncidentManagerListPage as jest.Mock;

jest.mock('../../IncidentManager/useIncidentManagerListPage', () => ({
  useIncidentManagerListPage: jest.fn(),
}));

jest.mock('./IncidentGroups/IncidentGroupsView', () =>
  jest
    .fn()
    .mockImplementation(({ refreshKey }: { refreshKey?: number }) => (
      <div data-testid="incident-groups-view">{refreshKey}</div>
    ))
);

jest.mock('../../IncidentManager/IncidentManagerTable.component', () =>
  jest.fn().mockImplementation(() => <div data-testid="incident-table" />)
);

jest.mock('./IncidentManagerPageWidgets', () =>
  jest.fn().mockImplementation(() => <div data-testid="incident-widgets" />)
);

jest.mock('../../Learning/LearningIcon/LearningIcon.component', () => ({
  LearningIcon: jest.fn().mockImplementation(() => null),
}));

jest.mock('../../common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => null)
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(({ type }: { type: string }) => (
      <div data-testid="error-placeholder">{type}</div>
    ))
);

const listPage = (canView: boolean) => ({
  commonTestCasePermission: { ViewAll: canView, ViewBasic: canView },
  isIncidentPage: true,
  testCaseListData: { data: [], isLoading: false },
  testCasePermissions: [],
  isPermissionLoading: false,
  showPagination: false,
  pagingData: {},
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <IncidentManagerPage />
    </MemoryRouter>
  );

describe('IncidentManagerPage (app mode)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIncidentManagerListPage.mockReturnValue(listPage(true));
  });

  it('should render the widgets, the incident groups and the incident table', () => {
    renderPage();

    expect(screen.getByTestId('incident-widgets')).toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-view')).toBeInTheDocument();
    expect(screen.getByTestId('incident-table')).toBeInTheDocument();
  });

  it('should show the permission placeholder without view access', () => {
    mockUseIncidentManagerListPage.mockReturnValue(listPage(false));

    renderPage();

    expect(screen.getByTestId('error-placeholder')).toHaveTextContent(
      'PERMISSION'
    );
    expect(
      screen.queryByTestId('incident-groups-view')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('incident-table')).not.toBeInTheDocument();
  });

  it('should re-read the groups once per incident changed in the table', () => {
    renderPage();

    expect(screen.getByTestId('incident-groups-view')).toHaveTextContent('0');

    const { onIncidentChange } =
      mockUseIncidentManagerListPage.mock.calls[0][0];

    act(() => onIncidentChange());

    expect(screen.getByTestId('incident-groups-view')).toHaveTextContent('1');

    act(() => onIncidentChange());

    expect(screen.getByTestId('incident-groups-view')).toHaveTextContent('2');
  });

  it('should treat a permission that has not loaded as no view access', () => {
    mockUseIncidentManagerListPage.mockReturnValue({
      ...listPage(true),
      commonTestCasePermission: undefined,
    });

    renderPage();

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });
});
