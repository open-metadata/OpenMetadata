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
import { useApplicationStore } from './useApplicationStore';
import { useThemeCssVariables } from './useThemeCssVariables';

jest.mock('./useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

const mockTheme = (customTheme: Record<string, string> | undefined) =>
  (useApplicationStore as unknown as jest.Mock).mockImplementation((selector) =>
    selector({ applicationConfig: { customTheme } })
  );

const cssVar = (name: string) =>
  document.documentElement.style.getPropertyValue(name);

describe('useThemeCssVariables', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('writes the configured brand and status colours', () => {
    mockTheme({
      primaryColor: '#123456',
      successColor: '#00aa00',
      warningColor: '#aa8800',
      errorColor: '#aa0000',
      infoColor: '#0088aa',
    });

    renderHook(() => useThemeCssVariables());

    expect(cssVar('--ant-primary-color')).toBe('#123456');
    expect(cssVar('--ant-success-color')).toBe('#00aa00');
    expect(cssVar('--ant-warning-color')).toBe('#aa8800');
    expect(cssVar('--ant-error-color')).toBe('#aa0000');
    expect(cssVar('--ant-info-color')).toBe('#0088aa');
    expect(cssVar('--ant-primary-7')).not.toBe('');
  });

  it('leaves unconfigured status colours to the stylesheet defaults', () => {
    mockTheme({ primaryColor: '#123456' });

    renderHook(() => useThemeCssVariables());

    expect(cssVar('--ant-primary-color')).toBe('#123456');
    expect(cssVar('--ant-success-color')).toBe('');
  });
});
