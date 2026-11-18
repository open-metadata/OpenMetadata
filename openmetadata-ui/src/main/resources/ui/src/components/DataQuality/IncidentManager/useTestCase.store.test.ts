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
import { TestCase, TestCaseStatus } from '../../../generated/tests/testCase';
import { useTestCaseStore } from './useTestCase.store';

describe('useTestCaseStore', () => {
  afterEach(() => useTestCaseStore.getState().reset());

  // A PATCH response leaves out the fields fetched by name, so the header's
  // incident fields and the Last run banner vanished until a reload.
  it('mergeTestCase should keep fields the PATCH response leaves out', () => {
    const loaded = {
      id: 'id',
      name: 'rowCount',
      owners: [],
      incidentId: 'incident',
      testCaseResult: { timestamp: 1, testCaseStatus: TestCaseStatus.Failed },
    } as unknown as TestCase;
    const patched = {
      id: 'id',
      name: 'rowCount',
      owners: [{ id: 'owner', type: 'user' }],
    } as unknown as TestCase;

    useTestCaseStore.getState().setTestCase(loaded);
    useTestCaseStore.getState().mergeTestCase(patched);

    expect(useTestCaseStore.getState().testCase).toEqual({
      ...loaded,
      owners: patched.owners,
    });
  });

  // The server drops a removed field from the PATCH response, so carrying
  // every missing key over would leave a cleared description on screen.
  it('mergeTestCase should drop a field the patch removed', () => {
    const loaded = {
      id: 'id',
      name: 'rowCount',
      description: 'old',
      incidentId: 'incident',
    } as TestCase;

    useTestCaseStore.getState().setTestCase(loaded);
    useTestCaseStore
      .getState()
      .mergeTestCase({ id: 'id', name: 'rowCount' } as TestCase);

    expect(useTestCaseStore.getState().testCase).toEqual({
      id: 'id',
      name: 'rowCount',
      incidentId: 'incident',
    });
  });
});
