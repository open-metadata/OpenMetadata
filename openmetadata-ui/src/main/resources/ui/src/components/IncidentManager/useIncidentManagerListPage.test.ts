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
import { renderHook } from '@testing-library/react';
import QueryString from 'qs';
import { useIncidentManagerListPage } from './useIncidentManagerListPage';

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      testCase: {
        ViewAll: true,
        ViewBasic: true,
      },
    },
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({}),
  }),
}));

jest.mock('../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 1,
    paging: { after: '', before: '', total: 25 },
    showPagination: true,
    pageSize: 10,
    handlePageChange: jest.fn(),
    handlePagingChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
  }),
}));

jest.mock('../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentStatusFromSearch: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [], paging: {} })),
  getListTestCaseIncidentByStateId: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  updateTestCaseIncidentById: jest.fn(),
  transitionIncident: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ data: { hits: { hits: [] } } })
    ),
}));

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ hits: { hits: [] } })),
}));

jest.mock('../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('EntityName'),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const mockLocation = { search: '' };

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => mockLocation);
});

describe('useIncidentManagerListPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLocation.search = '';
  });

  it('should read the filters from a query string that keeps its leading ?', () => {
    mockLocation.search = `?${QueryString.stringify({
      testCaseFQN: 'svc.db.tc',
    })}`;

    const { result } = renderHook(() => useIncidentManagerListPage({}));

    expect(result.current.filters).toEqual(
      expect.objectContaining({ testCaseFQN: 'svc.db.tc' })
    );
  });
});
