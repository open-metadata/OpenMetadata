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
import { TestCase } from '../../../generated/tests/testCase';
import { useTestCaseActions } from './useTestCaseActions';

const buildTestCase = (
  id: string,
  fullyQualifiedName: string,
  extra: Partial<TestCase> = {}
): TestCase =>
  ({
    id,
    name: id,
    fullyQualifiedName,
    ...extra,
  } as unknown as TestCase);

describe('useTestCaseActions', () => {
  it('should expose the two mutation handlers as functions', () => {
    const setTestCase = jest.fn();
    const { result } = renderHook(() => useTestCaseActions({ setTestCase }));

    expect(
      Object.keys(result.current).sort((a, b) => a.localeCompare(b))
    ).toEqual(['handleStatusSubmit', 'handleTestCaseUpdate']);
    expect(typeof result.current.handleTestCaseUpdate).toBe('function');
    expect(typeof result.current.handleStatusSubmit).toBe('function');
  });

  it('should merge only the row matching by id and leave the others untouched on handleTestCaseUpdate', () => {
    const setTestCase = jest.fn();
    const { result } = renderHook(() => useTestCaseActions({ setTestCase }));

    result.current.handleTestCaseUpdate(
      buildTestCase('id-1', 'svc.db.tc1', { name: 'merged-name' })
    );

    expect(setTestCase).toHaveBeenCalledTimes(1);

    const updater = setTestCase.mock.calls[0][0] as (
      prev: TestCase[]
    ) => TestCase[];
    const rowOne = buildTestCase('id-1', 'svc.db.tc1', { name: 'old-name' });
    const rowTwo = buildTestCase('id-2', 'svc.db.tc2');
    const next = updater([rowOne, rowTwo]);

    expect(next[0]).toEqual({
      id: 'id-1',
      name: 'merged-name',
      fullyQualifiedName: 'svc.db.tc1',
    });
    expect(next[0]).not.toBe(rowOne);
    expect(next[1]).toBe(rowTwo);
  });

  it('should merge a partial payload into the existing row rather than replace it', () => {
    const setTestCase = jest.fn();
    const { result } = renderHook(() => useTestCaseActions({ setTestCase }));

    // Payload omits fields the existing row carries; a merge keeps them, a
    // replace would drop them.
    result.current.handleTestCaseUpdate({
      id: 'id-1',
      name: 'merged-name',
    } as unknown as TestCase);

    const updater = setTestCase.mock.calls[0][0] as (
      prev: TestCase[]
    ) => TestCase[];
    const rowOne = buildTestCase('id-1', 'svc.db.tc1', {
      name: 'old-name',
      description: 'keep-me',
    });
    const next = updater([rowOne]);

    expect(next[0]).toEqual({
      id: 'id-1',
      name: 'merged-name',
      fullyQualifiedName: 'svc.db.tc1',
      description: 'keep-me',
    });
  });

  it('should not call the setter when handleTestCaseUpdate receives no data', () => {
    const setTestCase = jest.fn();
    const { result } = renderHook(() => useTestCaseActions({ setTestCase }));

    result.current.handleTestCaseUpdate();

    expect(setTestCase).not.toHaveBeenCalled();
  });

  it('should replace the row matching by fullyQualifiedName and keep the reference of the others on handleStatusSubmit', () => {
    const setTestCase = jest.fn();
    const { result } = renderHook(() => useTestCaseActions({ setTestCase }));

    const updated = buildTestCase('changed-id', 'svc.db.tc1', {
      name: 'replaced',
    });

    result.current.handleStatusSubmit(updated);

    expect(setTestCase).toHaveBeenCalledTimes(1);

    const updater = setTestCase.mock.calls[0][0] as (
      prev: TestCase[]
    ) => TestCase[];
    const rowOne = buildTestCase('id-1', 'svc.db.tc1', { name: 'old-name' });
    const rowTwo = buildTestCase('id-2', 'svc.db.tc2');
    const next = updater([rowOne, rowTwo]);

    expect(next[0]).toBe(updated);
    expect(next[1]).toBe(rowTwo);
  });

  it('should leave the list unchanged when no row matches the submitted fullyQualifiedName', () => {
    const setTestCase = jest.fn();
    const { result } = renderHook(() => useTestCaseActions({ setTestCase }));

    result.current.handleStatusSubmit(buildTestCase('id-x', 'svc.db.no-match'));

    const updater = setTestCase.mock.calls[0][0] as (
      prev: TestCase[]
    ) => TestCase[];
    const rowOne = buildTestCase('id-1', 'svc.db.tc1');
    const rowTwo = buildTestCase('id-2', 'svc.db.tc2');
    const next = updater([rowOne, rowTwo]);

    expect(next[0]).toBe(rowOne);
    expect(next[1]).toBe(rowTwo);
  });
});
