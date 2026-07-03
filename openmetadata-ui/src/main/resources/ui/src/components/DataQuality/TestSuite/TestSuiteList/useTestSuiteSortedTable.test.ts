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
import { act } from 'react';
import { TestSuite } from '../../../../generated/tests/testCase';
import { useTestSuiteSortedTable } from './useTestSuiteSortedTable';

const suite = (name: string): TestSuite =>
  ({ id: name, name, fullyQualifiedName: name } as unknown as TestSuite);

// A "basic" suite whose sortable name must come from
// basicEntityReference.fullyQualifiedName, NOT the top-level fullyQualifiedName
// (deliberately set to a different value to catch a wrong-branch regression).
const basicSuite = (id: string, basicFqn: string): TestSuite =>
  ({
    id,
    name: id,
    basic: true,
    basicEntityReference: { fullyQualifiedName: basicFqn },
    fullyQualifiedName: `top-${basicFqn}`,
  } as unknown as TestSuite);

const renderSorted = (testSuites: TestSuite[]) =>
  renderHook(
    (props: { testSuites: TestSuite[] }) => useTestSuiteSortedTable(props),
    { initialProps: { testSuites } }
  );

describe('useTestSuiteSortedTable', () => {
  it('should expose the documented sort return shape and the four columns', () => {
    const { result } = renderSorted([]);

    expect(result.current.sortDescriptor).toBeUndefined();
    expect(typeof result.current.setSortDescriptor).toBe('function');
    expect(Array.isArray(result.current.sortedData)).toBe(true);
    expect(result.current.columnList).toEqual([
      { id: 'name', name: 'label.name', allowsSorting: true },
      { id: 'tests', name: 'label.test-plural' },
      { id: 'success', name: 'label.success %' },
      { id: 'owners', name: 'label.owner-plural' },
    ]);
  });

  it('should return the injected rows unchanged (same reference) when no sortDescriptor is set', () => {
    const rows = [suite('b'), suite('a'), suite('c')];

    const { result } = renderSorted(rows);

    expect(result.current.sortedData).toBe(rows);
    expect(result.current.sortedData.map((item) => item.fullyQualifiedName)).toEqual(
      ['b', 'a', 'c']
    );
  });

  it('should set the sortDescriptor and sort by name ascending', () => {
    const { result } = renderSorted([suite('b'), suite('a'), suite('c')]);

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'ascending',
      });
    });

    expect(result.current.sortDescriptor).toEqual({
      column: 'name',
      direction: 'ascending',
    });
    expect(result.current.sortedData.map((item) => item.fullyQualifiedName)).toEqual(
      ['a', 'b', 'c']
    );
  });

  it('should sort by name descending when the descriptor direction is descending', () => {
    const { result } = renderSorted([suite('b'), suite('a'), suite('c')]);

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'descending',
      });
    });

    expect(result.current.sortedData.map((item) => item.fullyQualifiedName)).toEqual(
      ['c', 'b', 'a']
    );
  });

  it('should not mutate the injected rows while producing the sorted view', () => {
    const rows = [suite('b'), suite('a'), suite('c')];

    const { result } = renderSorted(rows);

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'ascending',
      });
    });

    expect(result.current.sortedData).not.toBe(rows);
    expect(rows.map((item) => item.fullyQualifiedName)).toEqual(['b', 'a', 'c']);
  });

  it('should leave row order unchanged when sorting by a non-name column', () => {
    const { result } = renderSorted([suite('b'), suite('a'), suite('c')]);

    act(() => {
      result.current.setSortDescriptor({
        column: 'tests',
        direction: 'ascending',
      });
    });

    expect(result.current.sortedData.map((item) => item.fullyQualifiedName)).toEqual(
      ['b', 'a', 'c']
    );
  });

  it('should sort a basic suite by basicEntityReference.fullyQualifiedName, not the top-level fqn', () => {
    const { result } = renderSorted([suite('m'), basicSuite('basic-row', 'a')]);

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'ascending',
      });
    });

    expect(result.current.sortedData.map((item) => item.id)).toEqual([
      'basic-row',
      'm',
    ]);

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'descending',
      });
    });

    expect(result.current.sortedData.map((item) => item.id)).toEqual([
      'm',
      'basic-row',
    ]);
  });

  it('should treat a basic suite with no basicEntityReference as an empty name for sorting', () => {
    const noRef = {
      id: 'no-ref',
      name: 'no-ref',
      basic: true,
      fullyQualifiedName: 'zzz',
    } as unknown as TestSuite;

    const { result } = renderSorted([suite('a'), noRef]);

    act(() => {
      result.current.setSortDescriptor({
        column: 'name',
        direction: 'ascending',
      });
    });

    expect(result.current.sortedData.map((item) => item.id)).toEqual([
      'no-ref',
      'a',
    ]);
  });
});
