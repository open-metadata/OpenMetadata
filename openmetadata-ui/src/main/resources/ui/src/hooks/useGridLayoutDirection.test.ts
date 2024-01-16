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
import { useTranslation } from 'react-i18next';
import { useGridLayoutDirection } from './useGridLayoutDirection';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockImplementation(() => ({
    i18n: {
      dir: jest.fn(),
    },
  })),
}));

describe('useGridLayoutDirection hook', () => {
  let container: HTMLDivElement;
  let child: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'react-grid-layout';
    document.body.appendChild(container);

    child = document.createElement('div');
    child.className = 'react-grid-item';
    container.appendChild(child);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('should not change direction if isLoading is true', () => {
    renderHook(() => useGridLayoutDirection(true));

    expect(container.getAttribute('dir')).toBeNull();
    expect(child.getAttribute('dir')).toBeNull();
  });

  it('should set direction to ltr for container and i18n direction for children if isLoading is false', () => {
    (useTranslation as jest.Mock).mockImplementationOnce(() => ({
      i18n: {
        dir: jest.fn().mockReturnValue('rtl'),
      },
    }));
    renderHook(() => useGridLayoutDirection(false));

    expect(container.getAttribute('dir')).toBe('ltr');
    expect(child.getAttribute('dir')).toBe('rtl');
  });
});
