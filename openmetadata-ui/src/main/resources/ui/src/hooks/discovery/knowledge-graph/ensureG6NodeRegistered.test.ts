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

import { register } from '@antv/g6';
import {
  ensureG6NodeRegistered,
  resetG6NodeRegistrationForTests,
} from './ensureG6NodeRegistered';

jest.mock('@antv/g6', () => ({
  ExtensionCategory: { NODE: 'node' },
  register: jest.fn(),
}));
jest.mock('@antv/g6-extension-react', () => ({ ReactNode: jest.fn() }));

const registerMock = register as jest.MockedFunction<typeof register>;

describe('ensureG6NodeRegistered', () => {
  beforeEach(() => {
    resetG6NodeRegistrationForTests();
    registerMock.mockClear();
  });

  it('registers the react-node extension exactly once', () => {
    ensureG6NodeRegistered();

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(
      'node',
      'react-node',
      expect.anything()
    );
  });

  it('is a no-op on repeated calls', () => {
    ensureG6NodeRegistered();
    ensureG6NodeRegistered();
    ensureG6NodeRegistered();

    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('registers again after resetG6NodeRegistrationForTests', () => {
    ensureG6NodeRegistered();
    resetG6NodeRegistrationForTests();
    ensureG6NodeRegistered();

    expect(registerMock).toHaveBeenCalledTimes(2);
  });
});
