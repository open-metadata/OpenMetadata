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

import {
  isTestCaseListSynchronized,
  isUnfilteredTestCaseRequest,
  shouldResetTestCaseLoading,
} from './TestSuiteDetailsPage.utils';

describe('TestSuiteDetailsPage.utils', () => {
  describe('isUnfilteredTestCaseRequest', () => {
    it('should accept a request without filters', () => {
      expect(isUnfilteredTestCaseRequest()).toBe(true);
    });

    it('should accept pagination and sorting parameters', () => {
      expect(
        isUnfilteredTestCaseRequest({
          testSuiteId: 'test-suite-id',
          offset: 10,
          sortField: 'name',
        })
      ).toBe(true);
    });

    it('should ignore undefined filter values', () => {
      expect(isUnfilteredTestCaseRequest({ q: undefined })).toBe(true);
    });

    it('should reject a request with an active filter', () => {
      expect(isUnfilteredTestCaseRequest({ q: 'customer' })).toBe(false);
    });
  });

  describe('isTestCaseListSynchronized', () => {
    it.each([
      [undefined, 10, true],
      [10, undefined, true],
      [9, 10, false],
      [10, 10, true],
      [11, 10, true],
    ])(
      'should report indexed total %s against authoritative total %s as synchronized: %s',
      (indexedTotal, authoritativeTotal, expected) => {
        expect(
          isTestCaseListSynchronized(indexedTotal, authoritativeTotal)
        ).toBe(expected);
      }
    );
  });

  describe('shouldResetTestCaseLoading', () => {
    it.each([
      [true, false, true],
      [false, false, false],
      [true, true, false],
      [false, true, false],
    ])(
      'should report request-current %s and keep-loading %s as reset-loading: %s',
      (isCurrentRequest, keepLoading, expected) => {
        expect(
          shouldResetTestCaseLoading(() => isCurrentRequest, keepLoading)
        ).toBe(expected);
      }
    );
  });
});
