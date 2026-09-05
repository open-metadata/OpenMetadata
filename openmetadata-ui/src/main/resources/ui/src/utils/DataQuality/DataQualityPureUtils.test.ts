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
import type { Operation } from 'fast-json-patch';
import type { TestCaseFormType } from '../../components/DataQuality/AddDataQualityTest/AddDataQualityTest.interface';
import type { TestCase } from '../../generated/tests/testCase';
import { createUpdatedTestCasePatch } from './DataQualityPureUtils';

const baseTestCase = {
  name: 'tc',
  description: 'old',
  displayName: 'Old Display',
} as TestCase;

const buildValue = (description: string | undefined): TestCaseFormType =>
  ({
    description,
    displayName: 'Old Display',
  } as TestCaseFormType);

const findDescriptionOp = (ops: Operation[]): Operation | undefined =>
  ops.find((op) => op.path === '/description');

describe('createUpdatedTestCasePatch description branch', () => {
  it('keeps the existing description untouched when showOnlyParameter is true', () => {
    const ops = createUpdatedTestCasePatch({
      testCase: baseTestCase,
      value: buildValue('new'),
      createTestCaseObject: {},
      showOnlyParameter: true,
      isComputeRowCountFieldVisible: false,
    });

    expect(findDescriptionOp(ops)).toBeUndefined();
  });

  it('applies the form description when it is not empty', () => {
    const ops = createUpdatedTestCasePatch({
      testCase: baseTestCase,
      value: buildValue('new'),
      createTestCaseObject: {},
      showOnlyParameter: false,
      isComputeRowCountFieldVisible: false,
    });

    expect(findDescriptionOp(ops)).toEqual({
      op: 'replace',
      path: '/description',
      value: 'new',
    });
  });

  it('removes the description when the form value is empty', () => {
    const ops = createUpdatedTestCasePatch({
      testCase: baseTestCase,
      value: buildValue(''),
      createTestCaseObject: {},
      showOnlyParameter: false,
      isComputeRowCountFieldVisible: false,
    });

    expect(findDescriptionOp(ops)?.op).toBe('remove');
  });
});
