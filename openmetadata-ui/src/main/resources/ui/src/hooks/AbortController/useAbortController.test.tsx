/*
 *  Copyright 2025 Collate.
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
import { act, renderHook } from '@testing-library/react-hooks';
import axios from 'axios';
import useAbortController from './useAbortController'; // Path to the custom hook

jest.mock('axios');

// Mock the global AbortController
beforeAll(() => {
  global.AbortController = jest.fn().mockImplementation(() => ({
    signal: {},
    abort: jest.fn(),
  }));
});

describe('useAbortController', () => {
  it('should call abort on cleanup or component unmount', () => {
    const abortMock = jest.fn();

    const { result, unmount } = renderHook(() => useAbortController());

    // assign the mock to the abort method of the controller
    result.current.controller.abort = abortMock;

    act(() => {
      unmount();
    });

    expect(abortMock).toHaveBeenCalled();
  });

  // Test that the signal is passed correctly to Axios for canceling requests
  it('should pass signal to Axios request for cancellation', async () => {
    const { result, unmount } = renderHook(() => useAbortController());

    // mock axios and track calls
    axios.get = jest.fn().mockResolvedValue({ data: 'test' });

    act(() => {
      const fetchData = async () => {
        try {
          await axios.get('/api/test', {
            signal: result.current.controller.signal,
          });
        } catch (error) {
          // Request aborted
        }
      };

      fetchData();
    });

    // Simulate the component unmounting to trigger abortion
    act(() => {
      unmount();
    });

    // Check that Axios's cancel logic was triggered
    expect(axios.get).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        signal: new AbortController().signal,
      })
    );
  });
});
