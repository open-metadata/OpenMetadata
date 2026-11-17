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
import useCustomLocation from './useCustomLocation';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn(),
}));

describe('useCustomLocation', () => {
  it('should modify the pathname correctly', () => {
    // Mock the environment variable
    window.BASE_PATH = '/app/';

    // Mock the useLocation hook
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/app/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });

    // Render the hook
    const { result } = renderHook(() => useCustomLocation());

    // Assert the modified pathname
    expect(result.current.pathname).toBe('/home');
  });

  it('should return the original location object', () => {
    // Mock the useLocation hook
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });

    // Render the hook
    const { result } = renderHook(() => useCustomLocation());

    // Assert the original location object
    expect(result.current).toEqual({
      pathname: '/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });
  });

  it('should return the original location object if APP_SUB_PATH is not set', () => {
    // Mock the environment variable
    delete window.BASE_PATH;

    // Mock the useLocation hook
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/app/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });

    // Render the hook
    const { result } = renderHook(() => useCustomLocation());

    // Assert the original location object
    expect(result.current).toEqual({
      pathname: '/app/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });
  });

  it('should return the original location object if APP_SUB_PATH is empty', () => {
    // Mock the environment variable
    window.BASE_PATH = '';

    // Mock the useLocation hook
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/app/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });

    // Render the hook
    const { result } = renderHook(() => useCustomLocation());

    // Assert the original location object
    expect(result.current).toEqual({
      pathname: '/app/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });
  });

  it('should return the original location object if APP_SUB_PATH is not a prefix', () => {
    // Mock the environment variable
    window.BASE_PATH = '/test';

    // Mock the useLocation hook
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/app/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });

    // Render the hook
    const { result } = renderHook(() => useCustomLocation());

    // Assert the original location object
    expect(result.current).toEqual({
      pathname: '/app/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });
  });

  it('should return the updated pathname on second render', () => {
    // Mock the environment variable
    window.BASE_PATH = '/app/';

    // Mock the useLocation hook
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/app/home',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });

    // Render the hook
    const { result, rerender } = renderHook(() => useCustomLocation());

    // Assert the modified pathname
    expect(result.current.pathname).toBe('/home');

    // Mock the useLocation hook
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/app/about',
      search: '',
      hash: '',
      state: null,
      key: 'testKey',
    });

    // Rerender the hook
    rerender();

    // Assert the modified pathname
    expect(result.current.pathname).toBe('/about');
  });
});
