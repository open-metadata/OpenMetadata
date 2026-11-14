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
import { getApiBaseUrl } from './apiBaseUrl';

describe('API base URL', () => {
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
    [undefined, '/api/v1'],
    [null, '/api/v1'],
    [42, '/api/v1'],
    ['', '/api/v1'],
    ['${basePath}', '/api/v1'],
    ['/', '/api/v1'],
    ['/openmetadata', '/openmetadata/api/v1'],
    ['/openmetadata/', '/openmetadata/api/v1'],
    ['/team/catalog', '/team/catalog/api/v1'],
    ['/team/catalog///', '/team/catalog/api/v1'],
    ['/Team/%E9%9B%AA/', '/Team/%E9%9B%AA/api/v1'],
  ])('uses the complete %p deployment prefix', (value, expected) => {
    Reflect.set(globalThis, 'BASE_PATH', value);

    expect(getApiBaseUrl()).toBe(expected);
  });
});
