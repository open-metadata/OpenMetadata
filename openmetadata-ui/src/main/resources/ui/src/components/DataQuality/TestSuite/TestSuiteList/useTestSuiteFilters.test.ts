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
import { act } from 'react';
import { EntityReference } from '../../../../generated/entity/type';
import {
  DataQualityPageTabs,
  DataQualitySubTabs,
} from '../../../../pages/DataQuality/DataQualityPage.interface';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import observabilityRouterClassBase from '../../../../utils/ObservabilityRouterClassBase';
import { useTestSuiteFilters } from './useTestSuiteFilters';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const mockLocation = { search: '' };

jest.mock('../../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn().mockImplementation(() => mockLocation)
);

jest.mock('../../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('Owner'),
}));

jest.mock('../../../../utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: { getDataQualityPagePath: jest.fn() },
}));

const renderFilters = (tab = DataQualityPageTabs.TEST_CASES) =>
  renderHook(() => useTestSuiteFilters({ tab }));

describe('useTestSuiteFilters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.search = '';
  });

  it('should expose the documented filter return shape for an empty query string', () => {
    const { result } = renderFilters();

    const value = result.current;

    expect(value.params).toEqual({});
    expect(value.searchValue).toBeUndefined();
    expect(value.owner).toBeUndefined();
    expect(value.selectedOwner).toBeUndefined();
    expect(value.ownerFilterValue).toBeUndefined();
    expect(typeof value.handleSearchParam).toBe('function');
    expect(typeof value.handleOwnerSelect).toBe('function');
    expect(typeof value.handleSubTabChange).toBe('function');
  });

  it('should parse a query string with a leading ? into params and expose searchValue/owner', () => {
    mockLocation.search = '?searchValue=abc&owner=xyz';

    const { result } = renderFilters();

    expect(result.current.params).toEqual({ searchValue: 'abc', owner: 'xyz' });
    expect(result.current.searchValue).toBe('abc');
    expect(result.current.owner).toBe('xyz');
  });

  it('should parse a query string without a leading ? into params', () => {
    mockLocation.search = 'searchValue=hello';

    const { result } = renderFilters();

    expect(result.current.params).toEqual({ searchValue: 'hello' });
    expect(result.current.searchValue).toBe('hello');
  });

  it('should JSON.parse the owner param into selectedOwner and derive ownerFilterValue', () => {
    const owner = { name: 'u1', fullyQualifiedName: 'u1' };
    mockLocation.search = QueryString.stringify({
      owner: JSON.stringify(owner),
    });

    const { result } = renderFilters();

    expect(result.current.selectedOwner).toEqual(owner);
    expect(result.current.ownerFilterValue).toEqual({
      key: 'u1',
      label: 'Owner',
    });
    expect(getEntityName).toHaveBeenCalledWith(owner);
  });

  it('should fall back to name for the owner filter key when fullyQualifiedName is absent', () => {
    mockLocation.search = QueryString.stringify({
      owner: JSON.stringify({ name: 'only-name' }),
    });

    const { result } = renderFilters();

    expect(result.current.ownerFilterValue).toEqual({
      key: 'only-name',
      label: 'Owner',
    });
  });

  it('should keep selectedOwner and ownerFilterValue undefined for a malformed owner param', () => {
    mockLocation.search = QueryString.stringify({ owner: 'not-json' });

    const { result } = renderFilters();

    expect(result.current.owner).toBe('not-json');
    expect(result.current.selectedOwner).toBeUndefined();
    expect(result.current.ownerFilterValue).toBeUndefined();
  });

  it('should navigate with the merged stringified query when handleSearchParam is called', () => {
    mockLocation.search = QueryString.stringify({ owner: 'xyz' });

    const { result } = renderFilters();

    act(() => {
      result.current.handleSearchParam('hello', 'searchValue');
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);

    const [arg] = mockNavigate.mock.calls[0];

    expect(QueryString.parse(arg.search)).toEqual({
      owner: 'xyz',
      searchValue: 'hello',
    });
  });

  it('should drop the key from the URL when handleSearchParam is called with an empty value', () => {
    mockLocation.search = QueryString.stringify({
      searchValue: 'stale',
      owner: 'xyz',
    });

    const { result } = renderFilters();

    act(() => {
      result.current.handleSearchParam('', 'searchValue');
    });

    const [arg] = mockNavigate.mock.calls[0];
    const parsed = QueryString.parse(arg.search);

    expect(parsed.searchValue).toBeUndefined();
    expect(parsed.owner).toBe('xyz');
  });

  it('should stringify only the first owner and write it to the URL on handleOwnerSelect', () => {
    const owner1 = {
      id: 'user-1',
      type: 'user',
      name: 'user1',
    } as EntityReference;
    const owner2 = {
      id: 'user-2',
      type: 'user',
      name: 'user2',
    } as EntityReference;

    const { result } = renderFilters();

    act(() => {
      result.current.handleOwnerSelect([owner1, owner2]);
    });

    const [arg] = mockNavigate.mock.calls[0];

    expect(QueryString.parse(arg.search).owner).toBe(JSON.stringify(owner1));
  });

  it('should clear the owner from the URL when handleOwnerSelect is called with no owners', () => {
    mockLocation.search = QueryString.stringify({ owner: 'stale' });

    const { result } = renderFilters();

    act(() => {
      result.current.handleOwnerSelect([]);
    });

    const [arg] = mockNavigate.mock.calls[0];

    expect(QueryString.parse(arg.search).owner).toBeUndefined();
  });

  it('should resolve the sub-tab path from the injected tab and navigate on handleSubTabChange', () => {
    (
      observabilityRouterClassBase.getDataQualityPagePath as jest.Mock
    ).mockReturnValue('/data-quality/test-cases/bundle-suites');

    const { result } = renderFilters(DataQualityPageTabs.TEST_CASES);

    act(() => {
      result.current.handleSubTabChange(
        new Set([
          DataQualitySubTabs.BUNDLE_SUITES,
          DataQualitySubTabs.TABLE_SUITES,
        ])
      );
    });

    expect(
      observabilityRouterClassBase.getDataQualityPagePath
    ).toHaveBeenCalledWith(
      DataQualityPageTabs.TEST_CASES,
      DataQualitySubTabs.BUNDLE_SUITES
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      '/data-quality/test-cases/bundle-suites'
    );
  });

  it('should not navigate when handleSubTabChange is called with an empty selection', () => {
    const { result } = renderFilters();

    act(() => {
      result.current.handleSubTabChange(new Set());
    });

    expect(
      observabilityRouterClassBase.getDataQualityPagePath
    ).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
