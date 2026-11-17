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
import { getBasePath } from './HistoryUtils';

describe('configured base path', () => {
  const originalBasePath = Object.getOwnPropertyDescriptor(
    globalThis,
    'BASE_PATH'
  );

  afterEach(() => {
    if (originalBasePath) {
      Object.defineProperty(globalThis, 'BASE_PATH', originalBasePath);
    } else {
      Reflect.deleteProperty(globalThis, 'BASE_PATH');
    }
  });

  it.each([
    [undefined, ''],
    [null, ''],
    [42, ''],
    ['', ''],
    ['${basePath}', ''],
    ['/', ''],
    ['////', ''],
    ['/openmetadata', '/openmetadata'],
    ['/openmetadata/', '/openmetadata'],
    ['/team/catalog', '/team/catalog'],
    ['/team/catalog///', '/team/catalog'],
    ['/Team/%E9%9B%AA/catalog/', '/Team/%E9%9B%AA/catalog'],
    ['/team//catalog/', '/team//catalog'],
  ])(
    'normalizes %p to %p without changing path segments',
    (value, expected) => {
      Reflect.set(globalThis, 'BASE_PATH', value);

      expect(getBasePath()).toBe(expected);
    }
  );
});
