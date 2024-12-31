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
import { render } from '@testing-library/react';
import axios from 'axios';
import React, { useEffect } from 'react';
import { unmountComponentAtNode } from 'react-dom';
import { act } from 'react-dom/test-utils';
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
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    unmountComponentAtNode(container);
    jest.clearAllMocks();
  });

  it('should call abort on cleanup or component unmount', () => {
    const abortMock = jest.fn();

    const TestComponent = () => {
      const { controller } = useAbortController();

      // assign the mock to the abort method of the controller
      controller.abort = abortMock;

      return <div>Testing cleanup</div>;
    };

    render(<TestComponent />, { container });

    act(() => {
      unmountComponentAtNode(container);
    });

    expect(abortMock).toHaveBeenCalled();
  });

  // Test that the signal is passed correctly to Axios for canceling requests
  it('should pass signal to Axios request for cancellation', async () => {
    const TestComponent = () => {
      const { controller } = useAbortController();

      useEffect(() => {
        const fetchData = async () => {
          try {
            await axios.get('/api/test', { signal: controller.signal });
          } catch (error) {
            // Request aborted
          }
        };

        fetchData();
      }, [controller.signal]);

      return <div>Testing Axios request</div>;
    };

    render(<TestComponent />, { container });

    // Simulate the component unmounting to trigger abortion
    act(() => {
      unmountComponentAtNode(container);
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
