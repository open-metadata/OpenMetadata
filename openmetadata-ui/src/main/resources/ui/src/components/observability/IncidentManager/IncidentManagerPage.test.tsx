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
import { MemoryRouter } from 'react-router-dom';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import IncidentManagerPage from './IncidentManagerPage';

const mockUsePermissionProvider = usePermissionProvider as jest.Mock;

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn(),
}));

jest.mock('./IncidentGroups/IncidentGroupsView', () =>
  jest
    .fn()
    .mockImplementation(
      ({ canEditIncidents }: { canEditIncidents: boolean }) => (
        <div
          data-can-edit={String(canEditIncidents)}
          data-testid="incident-groups-view"
        />
      )
    )
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

const withTestCasePermission = (canView?: boolean, canEditStatus = false) =>
  mockUsePermissionProvider.mockReturnValue({
    permissions: {
      testCase:
        canView === undefined
          ? undefined
          : { ViewAll: canView, ViewBasic: canView, EditStatus: canEditStatus },
    },
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
    withTestCasePermission(true);
  });

  it('should render the widgets above the incident groups', () => {
    renderPage();

    expect(screen.getByTestId('incident-widgets')).toBeInTheDocument();
    expect(screen.getByTestId('incident-groups-view')).toBeInTheDocument();
  });

  it('should offer the bulk actions only to who may change incident statuses', () => {
    renderPage();

    expect(screen.getByTestId('incident-groups-view')).toHaveAttribute(
      'data-can-edit',
      'false'
    );

    withTestCasePermission(true, true);
    renderPage();

    expect(screen.getAllByTestId('incident-groups-view')[1]).toHaveAttribute(
      'data-can-edit',
      'true'
    );
  });

  it('should show the permission placeholder without view access', () => {
    withTestCasePermission(false);

    renderPage();

    expect(screen.getByTestId('error-placeholder')).toHaveTextContent(
      'PERMISSION'
    );
    expect(
      screen.queryByTestId('incident-groups-view')
    ).not.toBeInTheDocument();
  });

  it('should treat a permission that has not loaded as no view access', () => {
    withTestCasePermission(undefined);

    renderPage();

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });
});
