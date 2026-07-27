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
import {
  isSsoTestLoginPopup,
  SSO_TEST_LOGIN_STORE_PREFIX,
} from './SsoTestLoginPopup';

const setOpener = (value: unknown) => {
  Object.defineProperty(window, 'opener', {
    value,
    configurable: true,
    writable: true,
  });
};

describe('isSsoTestLoginPopup', () => {
  afterEach(() => {
    setOpener(null);
    window.location.hash = '';
    window.localStorage.clear();
  });

  it('should return true only for the test popup (opener + state in the test store)', () => {
    setOpener({});
    window.location.hash = '#id_token=x&state=abc';
    window.localStorage.setItem(`${SSO_TEST_LOGIN_STORE_PREFIX}abc`, '{}');

    expect(isSsoTestLoginPopup()).toBe(true);
  });

  it('should return false for a real callback in the main window (no opener)', () => {
    setOpener(null);
    window.location.hash = '#id_token=x&state=abc';
    window.localStorage.setItem(`${SSO_TEST_LOGIN_STORE_PREFIX}abc`, '{}');

    expect(isSsoTestLoginPopup()).toBe(false);
  });

  it('should return false for a real popup login (state not in the test store)', () => {
    setOpener({});
    window.location.hash = '#id_token=x&state=real-state';

    expect(isSsoTestLoginPopup()).toBe(false);
  });

  it('should return false when there is no state in the URL', () => {
    setOpener({});
    window.location.hash = '#id_token=x';

    expect(isSsoTestLoginPopup()).toBe(false);
  });
});
