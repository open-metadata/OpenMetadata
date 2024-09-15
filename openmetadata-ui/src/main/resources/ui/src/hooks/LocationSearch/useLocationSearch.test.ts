/*
 *  Copyright 2023 Collate.
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
import qs from 'qs';

import useCustomLocation from '../useCustomLocation/useCustomLocation';
import { useLocationSearch } from './useLocationSearch';

jest.mock('../useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('qs', () => ({
  parse: jest.fn(),
}));

describe('useLocationSearch', () => {
  it('should return an empty object if location search is empty', () => {
    (useCustomLocation as jest.Mock).mockReturnValueOnce({ search: '' });
    (qs.parse as jest.Mock).mockReturnValueOnce({});

    const { result } = renderHook(() => useLocationSearch());

    expect(result.current).toEqual({});
    expect(useCustomLocation).toHaveBeenCalled();
    expect(qs.parse).toHaveBeenCalledWith('', { ignoreQueryPrefix: true });
  });

  it('should parse and return the search query as an object', () => {
    const mockSearch = '?param1=value1&param2=value2';
    const mockParsedQuery = { param1: 'value1', param2: 'value2' };

    (useCustomLocation as jest.Mock).mockReturnValueOnce({
      search: mockSearch,
    });
    (qs.parse as jest.Mock).mockReturnValueOnce(mockParsedQuery);

    const { result } = renderHook(() => useLocationSearch());

    expect(result.current).toEqual(mockParsedQuery);
    expect(useCustomLocation).toHaveBeenCalled();
    expect(qs.parse).toHaveBeenCalledWith(mockSearch, {
      ignoreQueryPrefix: true,
    });
  });

  it('should memoize the result based on location.search', () => {
    (useCustomLocation as jest.Mock).mockReturnValue({
      search: '?param1=value1',
    });

    (qs.parse as jest.Mock).mockReturnValueOnce({ param1: 'value1' });

    const { result, rerender } = renderHook(() => useLocationSearch());

    const initialResult = result.current;

    // Rerender with the same location.search
    rerender();

    // Result should be memoized and remain the same
    expect(result.current).toBe(initialResult);
    expect(useCustomLocation).toHaveBeenCalledTimes(2);
    expect(qs.parse).toHaveBeenCalledTimes(1);
  });
});
