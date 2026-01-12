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

import { renderHook } from '@testing-library/react-hooks';
import { buildColumnFqn } from '../utils/CommonUtils';
import { findFieldByFQN, getParentKeysToExpand } from '../utils/TableUtils';
import { useFqnDeepLink } from './useFqnDeepLink';

jest.mock('../utils/TableUtils', () => ({
  findFieldByFQN: jest.fn(),
  getParentKeysToExpand: jest.fn(),
}));

jest.mock('../utils/CommonUtils', () => ({
  buildColumnFqn: jest.fn(),
}));

describe('useFqnDeepLink', () => {
  const mockSetExpandedRowKeys = jest.fn();
  const mockOpenColumnDetailPanel = jest.fn();
  const mockData = [{ fullyQualifiedName: 'test.field' }];
  const tableFqn = 'test_table';

  beforeEach(() => {
    jest.clearAllMocks();
    (getParentKeysToExpand as jest.Mock).mockReturnValue([]);
    (findFieldByFQN as jest.Mock).mockReturnValue(undefined);
    (buildColumnFqn as jest.Mock).mockImplementation(
      (table, col) => `${table}.${col}`
    );
  });

  it('should not trigger anything if columnPart is empty', () => {
    renderHook(() =>
      useFqnDeepLink({
        data: mockData,
        tableFqn,
        columnPart: '',
        setExpandedRowKeys: mockSetExpandedRowKeys,
        openColumnDetailPanel: mockOpenColumnDetailPanel,
      })
    );

    expect(mockSetExpandedRowKeys).not.toHaveBeenCalled();
    expect(mockOpenColumnDetailPanel).not.toHaveBeenCalled();
  });

  it('should trigger deep link logic if columnPart is present', () => {
    const columnPart = 'field';
    const fqn = `${tableFqn}.${columnPart}`;
    (getParentKeysToExpand as jest.Mock).mockReturnValue(['parent.field']);
    (findFieldByFQN as jest.Mock).mockReturnValue({ fullyQualifiedName: fqn });

    renderHook(() =>
      useFqnDeepLink({
        data: mockData,
        tableFqn,
        columnPart,
        setExpandedRowKeys: mockSetExpandedRowKeys,
        openColumnDetailPanel: mockOpenColumnDetailPanel,
      })
    );

    expect(buildColumnFqn).toHaveBeenCalledWith(tableFqn, columnPart);
    expect(getParentKeysToExpand).toHaveBeenCalledWith(mockData, fqn);
    expect(mockSetExpandedRowKeys).toHaveBeenCalled();
    expect(findFieldByFQN).toHaveBeenCalledWith(mockData, fqn);
    expect(mockOpenColumnDetailPanel).toHaveBeenCalledWith({
      fullyQualifiedName: fqn,
    });
  });

  it('should handle decoding of columnPart', () => {
    const columnPart = 'field%20with%20spaces';
    const decodedColumnPart = 'field with spaces';

    renderHook(() =>
      useFqnDeepLink({
        data: mockData,
        tableFqn,
        columnPart,
        setExpandedRowKeys: mockSetExpandedRowKeys,
        openColumnDetailPanel: mockOpenColumnDetailPanel,
      })
    );

    expect(buildColumnFqn).toHaveBeenCalledWith(tableFqn, decodedColumnPart);
  });
});

