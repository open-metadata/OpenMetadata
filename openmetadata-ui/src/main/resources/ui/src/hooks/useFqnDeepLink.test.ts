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
import { useLocation } from 'react-router-dom';
import { findFieldByFQN, getParentKeysToExpand } from '../utils/TableUtils';
import { useFqnDeepLink } from './useFqnDeepLink';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
}));

jest.mock('../utils/TableUtils', () => ({
  findFieldByFQN: jest.fn(),
  getParentKeysToExpand: jest.fn(),
}));

describe('useFqnDeepLink', () => {
  const mockSetHighlightedFqn = jest.fn();
  const mockSetExpandedRowKeys = jest.fn();
  const mockOpenColumnDetailPanel = jest.fn();
  const mockData = [{ fullyQualifiedName: 'test.field' }];

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocation as jest.Mock).mockReturnValue({ hash: '' });
    (getParentKeysToExpand as jest.Mock).mockReturnValue([]);
    (findFieldByFQN as jest.Mock).mockReturnValue(undefined);
  });

  it('should not trigger anything if hash is empty', () => {
    renderHook(() =>
      useFqnDeepLink({
        data: mockData,
        setHighlightedFqn: mockSetHighlightedFqn,
        setExpandedRowKeys: mockSetExpandedRowKeys,
        openColumnDetailPanel: mockOpenColumnDetailPanel,
      })
    );

    expect(mockSetHighlightedFqn).not.toHaveBeenCalled();
    expect(mockSetExpandedRowKeys).not.toHaveBeenCalled();
    expect(mockOpenColumnDetailPanel).not.toHaveBeenCalled();
  });

  it('should trigger deep link logic if hash is present', () => {
    const fqn = 'test.field';
    (useLocation as jest.Mock).mockReturnValue({ hash: `#${fqn}` });
    (getParentKeysToExpand as jest.Mock).mockReturnValue(['parent.field']);
    (findFieldByFQN as jest.Mock).mockReturnValue({ fullyQualifiedName: fqn });

    renderHook(() =>
      useFqnDeepLink({
        data: mockData,
        setHighlightedFqn: mockSetHighlightedFqn,
        setExpandedRowKeys: mockSetExpandedRowKeys,
        openColumnDetailPanel: mockOpenColumnDetailPanel,
      })
    );

    expect(mockSetHighlightedFqn).toHaveBeenCalledWith(fqn);
    expect(getParentKeysToExpand).toHaveBeenCalledWith(mockData, fqn);
    expect(mockSetExpandedRowKeys).toHaveBeenCalled();
    expect(findFieldByFQN).toHaveBeenCalledWith(mockData, fqn);
    expect(mockOpenColumnDetailPanel).toHaveBeenCalledWith({ fullyQualifiedName: fqn });
  });

  it('should handle special characters in hash', () => {
    const fqn = 'test field with spaces';
    const encodedHash = `#${encodeURIComponent(fqn)}`;
    (useLocation as jest.Mock).mockReturnValue({ hash: encodedHash });

    renderHook(() =>
        useFqnDeepLink({
          data: mockData,
          setHighlightedFqn: mockSetHighlightedFqn,
          setExpandedRowKeys: mockSetExpandedRowKeys,
          openColumnDetailPanel: mockOpenColumnDetailPanel,
        })
    );

    expect(mockSetHighlightedFqn).toHaveBeenCalledWith(fqn);
    expect(findFieldByFQN).toHaveBeenCalledWith(mockData, fqn);
  });
});
